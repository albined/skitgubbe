# Skitgubbe Improvement Plan

## Scope

This plan covers four approved improvements:

1. Stop Android foreground turn notifications from alerting/spamming while the app is open.
2. Hide the Android top status/notification bar while the user is inside a game, then restore it outside the game.
3. Fix the confirmed Phase 1 end-of-deck/tie bug so Phase 2 starts only when the player who is actually required to act has zero cards.
4. Add a conditional 3-second Phase 1 sprinkle grace window when an online player has a legal sprinkle available.

The changes should preserve the existing server-authoritative game model, move-log replay, reconnection behavior, and the normal fast trick cadence when no sprinkle is possible.

---

## Important invariants

Keep these rules in mind throughout implementation.

### Game/replay invariants

- `packages/server/src/gameLogic.ts` remains the authoritative rules engine.
- A live game reconstructed from its persisted move log must reach the same card ownership and gameplay state as the live room.
- Do not introduce a timer-only gameplay mutation that cannot be reproduced by `packages/server/src/gameReplay.ts`.
- The existing `T` move remains the persisted trick-cleanup event.
- Normal plays/chance/pick-up remain blocked while `trickWinnerId` is pending.
- A Phase 1 sprinkle is the only gameplay action that may be accepted while a Phase 1 trick winner is pending.

### Phase 1 transition invariant

Phase 2 must **not** start merely because some player somewhere has an empty hand.

Phase 2 may start because the deck is exhausted only when:

1. the game is still in Phase 1,
2. the deck is empty,
3. there is no already-resolved trick waiting to be cleared, and
4. the **current active player — the player who is now required to act — has zero cards**.

If this happens in the middle of a normal round or tie-breaker, return the staged Phase 1 table batches using the existing `distributeTablePileBack()` behavior before entering Phase 2.

### Sprinkle grace-window invariant

- The normal Phase 1 cleanup delay stays fast, approximately the current 1 second.
- Use a 3-second delay only if, at the moment a Phase 1 trick becomes resolved, at least one **currently connected player** has at least one legal sprinkle available.
- The presence of the longer delay is intentionally allowed to reveal a small amount of gameplay information. This is a desired feature.
- The 3-second timer is fixed from the time the trick resolves. A sprinkle does **not** restart or extend the timer.
- A sprinkle cannot alter the trick winner because it can only add cards of the same value to that player's already-played batch. Therefore do not add a second "provisional winner" state machine unless testing proves this assumption false.

---

# 1. Android: suppress foreground notification spam

## Confirmed current behavior

`packages/web/capacitor.config.ts` currently configures:

```ts
PushNotifications: {
    presentationOptions: ['badge', 'sound', 'alert']
}
```

On Android, `alert` tells Capacitor to present a received push notification while the app is in the foreground.

The server currently sends a normal FCM notification payload for turn changes. That behavior should stay intact because background notifications are still wanted.

## Recommended change

### File

- `packages/web/capacitor.config.ts`

### Change

Set foreground presentation to an empty list:

```ts
PushNotifications: {
    presentationOptions: []
}
```

Do **not** solve this by suppressing pushes merely because `GameRoom.playerSockets` contains the active player.

A WebSocket can remain connected for some time after an Android app is backgrounded. Treating "socket connected" as "user is looking at the app" risks suppressing a legitimate background turn notification.

Capacitor's foreground presentation setting is the correct layer for this requirement:

- foreground app: push can still be received internally, but no Android notification banner/sound should be presented;
- background/killed app: FCM should still present the turn notification normally.

Keep the existing `pushNotificationReceived` listener in `nativeNotifications.ts`; it may remain a no-op because room state is already updated through the WebSocket while foregrounded.

## Expected product behavior

- App open in a game: no Android system notification or notification sound every time the turn changes.
- App open elsewhere in the foreground: no native system banner for push notifications.
- App backgrounded: turn notifications still appear normally.
- Tapping a background notification still navigates to its existing `route`.

## Verification

On a real Android device:

1. Enable notifications.
2. Open a game and keep Skitgubbe in the foreground.
3. Cause the local player to receive the turn several times.
4. Verify no notification banner, sound, or notification shade entry is produced.
5. Background the app.
6. Cause the local player to receive the turn again.
7. Verify a normal Android notification appears.
8. Tap it and verify the correct room opens.

---

# 2. Android: hide the top status/notification bar in the game

## Goal

When the Android app is displaying `/room/[roomId]`, hide only the **top status bar** so the game can use that screen space.

Do not globally hide the bar for the lobby/settings/avatar pages, and do not hide the bottom navigation/gesture bar unless separately requested.

Capacitor 8 already exposes `SystemBars` through `@capacitor/core`; no new package should be necessary.

## Files

Recommended:

- `packages/web/src/lib/platform/runtime.ts` — reuse `isAndroidApp()`.
- Add `packages/web/src/lib/platform/gameSystemBars.ts`.
- `packages/web/src/routes/room/[roomId]/+page.svelte`
- Verify `packages/web/src/routes/layout.css`; only change it if a real device still leaves stale top inset space.

## Add a small platform helper

Suggested shape:

```ts
import { SystemBars, SystemBarType } from '@capacitor/core';
import { isAndroidApp } from './runtime';

export async function hideGameStatusBar(): Promise<void> {
    if (!isAndroidApp()) return;
    await SystemBars.hide({ bar: SystemBarType.StatusBar });
}

export async function showGameStatusBar(): Promise<void> {
    if (!isAndroidApp()) return;
    await SystemBars.show({ bar: SystemBarType.StatusBar });
}
```

Catch/log failures at the caller or inside the helper so a system-bar failure can never prevent room initialization.

## Room lifecycle integration

In `packages/web/src/routes/room/[roomId]/+page.svelte`:

### On mount

- Call `hideGameStatusBar()`.
- Continue `roomState.init()` normally.
- Register a listener for the existing `skitgubbe:native-resume` event and call `hideGameStatusBar()` again on resume. This protects against Android restoring system UI while the app was backgrounded.

### On destroy

- Remove the resume listener.
- Call `showGameStatusBar()`.
- Continue calling `roomState.destroy()`.

Do not set:

```ts
SystemBars: {
    hidden: true
}
```

globally in `capacitor.config.ts`, because that would also hide the status bar on the lobby and other screens.

## Safe-area handling

`layout.css` currently gives native-app `body` padding from `--safe-area-inset-*`.

After hiding the Android status bar, verify on-device that `--safe-area-inset-top` becomes zero and that the game expands upward.

If a stale top gap remains:

- investigate the injected `--safe-area-inset-top` value first;
- prefer a game-route-specific class/variable override;
- do **not** use hard-coded negative margins or device-specific pixel offsets.

## Verification

- Enter a room: top status bar disappears and game fills the released space.
- Background/resume while still in room: status bar remains hidden after resume.
- Navigate back to lobby: status bar returns.
- Bottom Android navigation/gesture area remains normal.
- Browser/PWA behavior is unchanged.

---

# 3. Fix premature Phase 2 transition during Phase 1 ties

## Confirmed bug

There are currently broad checks in `packages/server/src/gameLogic.ts` similar to:

```ts
state.deck.length === 0 &&
state.players.some(
    (p) =>
        p.hand.length === 0 &&
        p.inviteStatus === 'accepted' &&
        !p.hasLeft
)
```

This appears in both:

- `resolveNormalRoundPhase1()`, before starting an initial tie-breaker;
- `resolveTieBreaker()`, before starting another tie-breaker after another tie;

and a similar global-empty-hand condition exists in Phase 1 trick cleanup.

This is too broad.

An unrelated player who has zero cards can cause all staged cards to be returned and Phase 2 to start even though the tied players still have cards and should continue battling for the trick.

## Required rule

Replace "does **any** player have zero cards?" with:

> "Is the player who is **currently required to act** unable to act because the deck is exhausted and their hand is empty?"

## File

- `packages/server/src/gameLogic.ts`

Tests:

- preferably extend `packages/server/tests/gameLogicRegression.test.ts`.

## Add one centralized helper

Do not duplicate slightly different Phase 2 conditions in several functions.

Add a helper with behavior equivalent to:

```ts
function maybeTransitionPhase1BecauseActivePlayerIsOut(state: GameState): boolean {
    if (state.status !== 'playing') return false;
    if (state.phase !== 1) return false;
    if (state.deck.length !== 0) return false;

    // A completed trick must finish its pending cleanup/sprinkle grace period first.
    if (state.trickWinnerId !== null) return false;

    const active = state.players[state.activePlayerIdx];
    if (!active) return false;
    if (active.inviteStatus !== 'accepted') return false;
    if (active.hasLeft || active.isDone) return false;
    if (active.hand.length !== 0) return false;

    logState(state, `${active.name} har inga kort kvar att spela. Fas 2 startar.`);

    if (state.tablePile.length > 0) {
        distributeTablePileBack(state);
    }

    transitionToPhase2(state);
    return true;
}
```

Exact naming can differ, but keep the condition centralized.

## Remove the incorrect global checks

In `resolveNormalRoundPhase1()`:

- remove the `players.some(p.hand.length === 0...)` branch that immediately returns cards and starts Phase 2;
- determine the tied IDs;
- start the tie-breaker normally;
- set `activePlayerIdx` to the first tied player;
- call the new helper;
- if that active tied player has cards, the tie continues.

In `resolveTieBreaker()`:

- remove the equivalent global-empty-hand branch;
- after another tie, update `tiedPlayerIds`;
- set `tieBreakerStartPileSize`;
- set the first newly tied player active;
- call the new helper.

## Call the helper whenever Phase 1 chooses the next player who must act

Update `progressPhase1Turn()`.

### Normal round rotation

After calculating and assigning the next non-skipped player:

```ts
state.activePlayerIdx = nextIdx;
```

immediately call the helper.

If that new active player has zero cards and the deck is empty, Phase 2 starts at that point.

### Tie-breaker rotation

When:

```ts
const nextTiedId = state.tiedPlayerIds[subRoundPlays];
state.activePlayerIdx = ...
```

call the helper immediately afterward.

### Initial/repeated tie

Call it immediately after assigning the first tied player as active, as described above.

### Completed unique trick

Do **not** transition before the pending trick cleanup.

In `applyClearTrick()`:

1. clear `trickWinnerId`;
2. clear `tablePile` / `tablePilePlayers` as today;
3. call the centralized active-player Phase 2 helper;
4. only if no transition occurred, continue the existing skipped-player handling.

This ensures a trick that has a winner gets its normal cleanup/sprinkle window before Phase 2 can start.

## Regression tests

Add explicit pin tests.

### Test A — reproduce the reported bug

Three players:

- A has `K` plus at least one extra card.
- B has `K` plus at least one extra card.
- C has one lower card only.
- Deck is empty.

Sequence:

1. A plays K.
2. B plays K.
3. C plays their final lower card, leaving C with zero cards.

Expected:

- `phase === 1`;
- `tieBreakerActive === true`;
- `tiedPlayerIds` contains A and B;
- active player is A (first tied contender);
- table pile remains staged;
- no `distributeTablePileBack()` / Phase 2 transition occurs merely because C is empty.

This test should fail against the current buggy implementation and pass after the fix.

### Test B — transition when the tied active player truly cannot continue

Same structure, but A has only the K and therefore has zero cards when the A/B tie begins.

Expected after C completes the original round:

- A becomes the player required to play the first tie-breaker card;
- A has zero cards and deck is empty;
- Phase 2 starts;
- staged table cards are returned through the existing return/distribution behavior.

### Test C — repeated tie ignores unrelated empty player

Construct:

- A and B tie in the original round;
- C becomes empty but is not in the tie;
- A and B tie again in the first tie-breaker;
- A and B still each have another card.

Expected:

- still Phase 1;
- another A/B tie-breaker begins;
- C being empty does not trigger Phase 2.

### Test D — unique trick winner is empty

Deck empty; A wins a normal trick with A's final card.

Expected immediately after the final play:

- Phase 1 still active;
- `trickWinnerId === A`.

After `applyClearTrick()`:

- because A is still the active player and now has zero hand cards, Phase 2 begins.

### Test E — normal rotation reaches an empty player

During a non-tied Phase 1 round, a play advances the turn to a player with zero cards while the deck is empty.

Expected:

- transition happens exactly when that player becomes active;
- not earlier because some other non-active player was empty.

---

# 4. Conditional 3-second online sprinkle grace window

## Desired gameplay behavior

When a Phase 1 trick has a unique winner:

- normally keep the current fast cleanup cadence;
- but if at least one connected player currently has a legal sprinkle card for one of their own staged batches, leave the table available for **3 seconds** before cleanup;
- during those 3 seconds, valid sprinkle moves are still accepted;
- normal plays/chance actions remain blocked;
- after the timer expires, the trick clears normally.

The longer pause intentionally acts as a small gameplay tell: players may infer that somebody online has a possible sprinkle.

## Why this does not need a new provisional-winner state

A legal sprinkle only adds cards whose value matches the value of a batch that the sprinkling player already laid.

Therefore it cannot change the rank/value used to determine the already-computed trick winner.

Keep:

```ts
state.trickWinnerId
```

as the resolved winner during the grace period.

Do not invent a separate persisted `provisionalTrickWinnerId` unless a future rule changes sprinkle so that it can alter the winning value.

The table already remains present until the existing `T` cleanup move, so visually the cards can stay on the table for the longer window.

## Files

Server:

- `packages/server/src/gameLogic.ts`
- `packages/server/src/gameRoom.ts`
- `packages/server/src/gameReplay.ts`

Client:

- `packages/web/src/lib/state/roomState.svelte.ts`

Tests:

- `packages/server/tests/sprinkle.test.ts`
- `packages/server/tests/gameReplay.test.ts`
- `packages/server/tests/roomLifecycle.test.ts` or a focused new GameRoom timer test file
- `packages/web/tests/roomState.test.ts`

## 4.1 Allow Phase 1 sprinkle while a winner is pending

### `gameLogic.ts`

`canSprinkle()` currently rejects:

```ts
if (state.trickWinnerId !== null) {
    return { ok: false, reason: 'A trick winner is pending.' };
}
```

Remove/replace that restriction.

A valid Phase 1 sprinkle should remain legal while:

- `state.phase === 1`;
- the corresponding own table batch still exists;
- the selected cards match that batch value;
- the game is still playing.

If `trickWinnerId` points to a player who has left, either reject pending-window sprinkles or otherwise ensure no newly sprinkled cards are credited to a departed winner. Do not silently recreate a departed winner's reserve stack.

## 4.2 Credit late sprinkled cards to the already-resolved trick winner

Today, `resolveNormalRoundPhase1()` / `resolveTieBreaker()` already add the table cards to the winner's `reserveStack` when the winner is determined, before `T` clears the table.

Do not perform a risky broad refactor of this ownership timing just to implement the grace window.

Instead, in `applySprinkle()`:

1. remove the sprinkled cards from the sprinkling player's hand;
2. append them to that player's staged table batch as today;
3. if `state.trickWinnerId !== null`, locate the pending trick winner;
4. append **only the newly sprinkled cards** to that winner's `reserveStack`;
5. draw replacements as today.

Do not append the whole table pile again. The original table cards were already credited when the trick winner was resolved.

This keeps current trick ownership semantics intact and minimizes regressions around player departures.

## 4.3 Detect whether any connected player can sprinkle

### `gameRoom.ts`

Add a helper such as:

```ts
private hasOnlineSprinkleOpportunity(): boolean
```

Requirements:

- only return true in Phase 1;
- only relevant when `trickWinnerId !== null`;
- iterate currently connected player IDs from `this.playerSockets`;
- ignore sockets whose profile is not an actual player in `state.players`;
- ignore pending/left players;
- inspect the server's real, unmasked hand;
- return true if at least one hand card would pass `canSprinkle(state, playerId, [card.id])`.

Using one card at a time is sufficient for opportunity detection because if a player can legally sprinkle a multi-card group of a value, at least one card of that same value is also a legal sprinkle.

Prefer calling the authoritative `canSprinkle()` helper rather than reimplementing its value/batch rules inside `GameRoom`.

## 4.4 Choose cleanup delay once, when the trick resolves

Replace timer magic numbers with named constants, for example:

```ts
const PHASE1_TRICK_CLEANUP_MS = 1_000;
const PHASE1_SPRINKLE_GRACE_MS = 3_000;
const PHASE2_TRICK_CLEANUP_MS = 500;
```

In `scheduleTrickCleanupTimeout()`:

- Phase 2 => 500 ms, unchanged.
- Phase 1 + online legal sprinkle opportunity => 3000 ms.
- Phase 1 + no online legal sprinkle => 1000 ms, unchanged.

Evaluate this once when the trick winner first becomes pending.

Do **not** restart the timer when a sprinkle arrives.

The current `commitMove()` structure already helps with this:

- first resolving move: `trickWasPending === false`, so timer is scheduled;
- sprinkle during the pending trick: `trickWasPending === true`, so no new timer is scheduled.

Preserve that property.

## 4.5 Client: keep sprinkle controls usable during the grace period

`roomState.svelte.ts` currently blocks sprinkle in two places when `trickWinnerId` is present.

### `isStroValid`

Remove only the condition that requires:

```ts
!this.gameState.trickWinnerId
```

Keep all existing checks that:

- phase is 1;
- cards are selected;
- all selected cards share a value;
- the local player already has a matching-value batch on the table.

### `checkDropValidity()`

The sprinkle branch currently begins approximately:

```ts
if (state.phase === 1 && !state.trickWinnerId) {
```

Change it so Phase 1 sprinkle validation also runs while a trick winner is pending.

Do **not** change `isHumanTurn`.

`isHumanTurn` should continue to require no pending trick winner so regular play/chance cannot occur during the grace period.

Result:

- normal action controls are frozen;
- sprinkle selection/button/drag remains usable;
- the table remains visible;
- cleanup still happens when the timer expires.

## 4.6 Replay support is mandatory

### Current problem

`gameReplay.ts` currently auto-clears any pending trick before applying the next persisted move.

A newly valid move sequence can now be:

```text
P ... -> trick winner becomes pending
R     -> late sprinkle during grace window
T     -> timer clears trick
```

If replay auto-clears before `R`, the table disappears and the replayed sprinkle becomes invalid.

### Required replay change

Change the pre-move pending-trick behavior so `R` can be replayed before the cleanup.

Recommended shape:

```ts
const shouldAutoClearPendingTrick =
    state.trickWinnerId !== null &&
    move.move_type !== 'R' &&
    move.move_type !== 'T';

if (shouldAutoClearPendingTrick) {
    applyClearTrick(state);
}
```

Then:

- `R` is applied against the still-present pending trick;
- `T` explicitly performs the cleanup;
- old behavior for unrelated subsequent actions is retained.

Verify historical move logs still replay successfully.

## 4.7 Timer/race semantics

Document and test these behaviors:

- If a sprinkle WebSocket message is processed before the cleanup timer callback, it is included.
- If the cleanup timer fires first, the table is cleared and the later sprinkle is rejected naturally because no matching staged batch exists.
- JavaScript/Bun event-loop serialization means no lock is needed for this cutoff.
- A sprinkle does not extend the 3 seconds.
- If an eligible player disconnects after the 3-second window begins, do not shorten the timer; keep behavior predictable.
- If no one is eligible when the winner resolves, use the normal 1-second delay. A player connecting afterward does not retroactively restart a fresh 3-second window.

## Tests for the grace window

### Server rule test — pending sprinkle accepted

Update the current sprinkle test that expects rejection while `trickWinnerId` is pending.

New expected behavior:

- valid matching sprinkle succeeds;
- `trickWinnerId` remains unchanged;
- active player remains unchanged;
- newly sprinkled cards appear in the correct table batch;
- newly sprinkled cards are also added to the pending winner's reserve stack;
- replacement draw behavior remains correct.

### Server rule test — invalid pending sprinkle still rejected

While a winner is pending:

- wrong card value => rejected;
- player has no matching own table batch => rejected;
- Phase 2 => rejected.

### Online-opportunity detection

Build a Phase 1 pending-trick room.

Case 1:

- player A is in `playerSockets`;
- A has a matching sprinkle card;
- expected: online sprinkle opportunity is true / selected delay is 3000 ms.

Case 2:

- A has the matching card but is not connected;
- expected delay is normal 1000 ms.

Case 3:

- A connected but no matching card;
- normal 1000 ms.

Case 4:

- Phase 2;
- always 500 ms.

Prefer testing an extracted delay-selection helper instead of adding multiple real 3-second sleeps to the test suite.

### Fixed-window test

Resolve a Phase 1 trick with an online sprinkle opportunity.

- schedule 3-second cleanup;
- perform a valid `R`;
- verify a second cleanup timer is not created/restarted;
- original timer remains authoritative.

### Replay pin test

Create/replay a move sequence where:

1. Phase 1 final normal/tie-break play establishes `trickWinnerId`.
2. An `R` move is persisted before `T`.
3. `T` clears the trick.

Assert the replayed final state matches the expected live state, including:

- winner reserve-stack card count/IDs;
- sprinkler hand/replacement cards;
- table cleared after T;
- same phase;
- same active player;
- same `seq`.

### Client tests

Update/add `packages/web/tests/roomState.test.ts`:

- valid sprinkle selection is considered valid even when `trickWinnerId` is set;
- normal `isHumanTurn` remains false while `trickWinnerId` is set;
- drag/drop validity can return `'sprinkle'` during pending Phase 1;
- normal `'play'` cannot be returned during a pending trick.

---

# Implementation order

Use this order to reduce debugging ambiguity.

## Step 1 — Add regression tests for the confirmed Phase 1 bug

Create the failing tests for section 3 before modifying `gameLogic.ts`.

The reported tie test must fail on the current code first.

## Step 2 — Centralize and fix Phase 1 -> Phase 2 eligibility

Implement the active-player-only transition helper.

Remove the broad global empty-hand checks.

Run all server tests.

## Step 3 — Change sprinkle rule semantics

Allow sprinkle during a pending Phase 1 trick and credit late sprinkled cards to the already-resolved winner.

Update sprinkle unit tests.

## Step 4 — Make replay understand `R` before `T`

Change `gameReplay.ts`.

Add the replay pin test before touching timer duration.

This is important: do not deploy a timer window that can produce move logs the replay engine cannot reconstruct.

## Step 5 — Add conditional timer selection

Implement online legal-sprinkle detection in `GameRoom`.

Use 3 seconds only when warranted.

Add timer-selection and no-restart tests.

## Step 6 — Enable pending-trick sprinkle controls on the client

Update `isStroValid` and `checkDropValidity`.

Do not loosen normal-turn validation.

## Step 7 — Android foreground push behavior

Set `presentationOptions: []`.

Build/sync Android and verify foreground vs background delivery.

## Step 8 — Android room status bar

Add route-scoped SystemBars hide/show behavior.

Verify safe-area layout on a real device.

## Step 9 — Full verification

Run:

```bash
bun run test:server
bun test
bun run check
bun run lint
bun run build:mobile
bun run mobile:sync
```

For Android-specific verification also run the repository's appropriate debug/doctor flow, for example:

```bash
bun run android:doctor
bun run android:debug
```

Fix all new lint/type/test failures before considering the work complete.

---

# Acceptance checklist

## Android notifications

- [ ] No system turn notification appears while the Android app is foregrounded.
- [ ] Background turn notifications still work.
- [ ] Notification tap routing still works.

## Android game fullscreen

- [ ] Top status bar is hidden inside a room.
- [ ] Top status bar returns after leaving the room.
- [ ] Resume does not unexpectedly restore it while still in the room.
- [ ] Bottom system navigation/gesture bar is not hidden.
- [ ] No unexplained safe-area gap remains.

## Phase 1 tie / Phase 2 logic

- [ ] An unrelated zero-card player cannot abort an A/B tie.
- [ ] Repeated ties continue while the next tied player has a card.
- [ ] Phase 2 begins when the actual active player has zero cards and the deck is empty.
- [ ] If this happens mid-round/tie, staged cards are returned through the existing distribution path.
- [ ] A resolved trick is allowed to finish cleanup before Phase 2 transition.

## Sprinkle grace window

- [ ] No eligible connected sprinkler => existing ~1s Phase 1 cleanup.
- [ ] Eligible connected sprinkler => ~3s cleanup.
- [ ] Eligible but offline player => no 3s delay.
- [ ] Valid sprinkle works while `trickWinnerId` is pending.
- [ ] Normal play/chance stays blocked during that period.
- [ ] Sprinkle does not change/reset the winner.
- [ ] Newly sprinkled cards are owned by the pending winner after cleanup.
- [ ] Sprinkle does not restart the timer.
- [ ] `P ... -> R -> T` replay is deterministic.
- [ ] Reconnect/replay still reconstructs the same final state.

---

# Explicit non-goals / avoid these shortcuts

- Do not suppress turn pushes based only on `playerSockets`; background Android sockets can remain alive.
- Do not globally hide Android system bars for the whole app.
- Do not hide the bottom navigation bar unless separately requested.
- Do not transition to Phase 2 using `players.some(p => p.hand.length === 0)`.
- Do not add a 3-second delay to every Phase 1 trick.
- Do not restart the 3-second timer after each sprinkle.
- Do not allow normal play/chance while `trickWinnerId` is pending.
- Do not add a new persisted provisional-winner state unless absolutely necessary.
- Do not permit live `R`-before-`T` sequences without updating replay logic.
- Do not duplicate Phase 1 transition rules in several functions; centralize the active-player eligibility check.
