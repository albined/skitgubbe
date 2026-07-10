# 06 — Web Client State: roomState, cardDragState, lobbyState

Files: `packages/web/src/lib/state/*.svelte.ts`

Context: Svelte 5 runes classes. `RoomState` (1216 loc) is the client's WS
client + game-state mirror + animation controller + chat controller all in
one class. `CardDragState` (297) is a well-scoped drag/drop machine.
`LobbyState` (487) is REST-backed lobby/profile/notifications.

## 🟠 P1

### 1. `RoomState` is four responsibilities in one 1216-line class
It owns: (a) WebSocket connection + reconnect, (b) the synchronized
`gameState` mirror, (c) all FLIP/card-fly animation math (`cardIn`/`cardOut`
are ~120 loc each of transform arithmetic), and (d) chat bubbles + catch-up
queue. These have different change-rates and testabilities. The animation
transition functions especially are pure geometry that could live in a
`cardTransitions.ts` module taking a small context, shrinking the class by
~300 loc and making the WS/state-sync core reviewable. This is the #1
maintainability item on the client.

### 2. Reconnect has no backoff and no cap
`onclose` (roomState.ts:523) always reschedules `connectWebSocket()` after a
flat 3000ms, forever. A server that's down or rejecting (e.g. after the WS
auth fix in 04 §3 starts returning 401-equivalent closes) produces an
infinite 3s reconnect loop from every open tab — a self-inflicted thundering
herd on restart. Add exponential backoff (3s → cap ~30s) with jitter, and
stop after the tab is hidden/unloaded.

### 3. Client trusts server masking but also self-filters — divergence risk
The masking sentinel is the string `'?'` (server sets `value:'?'` for hidden
cards). The client checks `!localPlayer.hand.some(c => c.value === '?')`
(roomState.ts:434) to decide "do I have my real hand yet." This couples client
logic to a server-side magic string with no shared constant. If the server
ever changes the mask (see 05 §4 recommending a `MaskedCard` type), this
silently breaks reconnect card-animation. Export a shared
`HIDDEN_CARD_VALUE`/`isMasked(card)` from `packages/shared`.

## 🟡 P2

4. **The end-game animation is a 5-deep nested `setTimeout` tower**
   (roomState.ts:206-238) with **no stored timer handles** — none are in
   `activeTimeouts`, so `destroy()` can't cancel them. If the component
   unmounts mid-animation (navigation, or state flips to a new game), these
   fire against a torn-down state. Same for `addAnimatingCardIds`'
   `setTimeout` (line 797) and `copyRoomUrl` (845). Route every `setTimeout`
   through a tracked-handle helper so `destroy()` is actually complete.

5. **`$state<any>` on shared shapes** — `globalSkitgubbe`, and in `LobbyState`
   nearly every field (`profiles`, `games`, `activeProfile`,
   `allPlayersStats`...) is `any` or `any[]`. These are server DTOs that
   already have types server-side. Define shared response types (or infer
   from the route handlers) so a server field rename surfaces in the client
   at compile time. Right now client/server DTO drift is invisible.

6. **Autoplay enumerates all card subsets (2^n)** — `triggerAutoplay`
   (roomState.ts:641) builds the powerset of each value-group. Capped by hand
   size so fine in practice, but it re-implements play enumeration that
   `getLegalPlays` (phase 2) / a phase-1 helper already express. Reuse shared
   logic; don't maintain a third play-finder (server bot + isValidPlay +
   this).

7. **localStorage seq/chat-id are per-room and never GC'd** — keys
   `skitgubbe_last_seq_${roomId}`, `skitgubbe_last_seen_chat_id_${roomId}`,
   and `push_synced:${profileId}:${endpoint}` accumulate forever. Minor, but
   a heavy user's localStorage grows unboundedly. Prune on game-end / list
   trim.

8. **Chat message list is unbounded in memory** — `chatMessages.push`
   (roomState.ts:498) never trims; a long game with active chat grows the
   array and every `unreadChatCount`/`markChatsAsRead` does `Math.max(...map)`
   over the whole thing (O(n) spread, can hit call-stack limits at extreme
   sizes). Cap client-side to the last N.

9. **`init()` fires 4 sequential awaited fetches** (LobbyState.init:73) —
   `checkAuth` (which itself calls `loadGames` + `loadCurrentSkitgubbe`), then
   `loadProfiles`, then `loadCurrentSkitgubbe` **again**, then
   `initNotifications`. `loadCurrentSkitgubbe` runs twice, and the
   independent ones could be `Promise.all`'d. Lobby cold-load is slower than
   needed.

## 🔵 P3

- `RoomState.godMode`/`allowDevSettings` client flags gate dev actions, but
  the *server* is the real gate (02 §8) — keep them in sync or the debug
  menu shows buttons that error.
- `checkDropValidity` and `isPlayableGroup` (roomState.ts:715, 757) are near
  duplicates (same sprinkle + isValidPlay logic, different return shape).
  Fold one into the other.
- `cardIn` infers "is this a chance play" by **substring-matching Swedish log
  text** (`log.includes('chanced')` — roomState.ts:1112, and note the log is
  actually written as "chansade" in gameLogic, so this English check may
  never match for the non-local branch). Animation keyed on log strings is
  fragile; drive it off structured state (a `lastMoveType` field) instead.
- `preventNextClick` 100ms `setTimeout` fallback (cardDragState.ts:162) is a
  classic click-after-drag race patch; works, but a pointer-capture approach
  would be cleaner.
- `selectProfile` duplicates the push-sync block from `initNotifications`
  verbatim — extract `syncPushSubscription()`.

## ✅ Good

- **`CardDragState` is genuinely well-designed** — clear pointer state
  machine, 8px drag threshold, run-detection for phase-2 sequences,
  double-click-to-play, drag-vs-click disambiguation. Scoped, single
  responsibility, readable. Model for how the rest could be split.
- `destroy()` exists and cancels the timers it knows about (the gap is the
  untracked ones, §4) — the intent is right.
- Reconnect replay handling (queueing live `stateUpdate`s during replay,
  dedup by seq — roomState.ts:409-420) is subtle and correctly done.
- `loadGames` re-entrancy guard (`isFetchingGames`) prevents overlapping
  fetches. Small, thoughtful.
- Optimistic drag-play with `droppedCardRects`/`pendingPlayOffsets` capture
  for seamless FLIP into the server-confirmed state is impressive UX
  engineering.
