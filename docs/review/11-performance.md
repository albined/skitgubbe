# 11 — Performance (cross-cutting)

Scale reality check: this is a turn-based card game for ≤10 players per room.
The server is single-threaded Bun; SQLite is local. **Nothing here is a
throughput problem today** — these are the things that would bite first *if*
the game got popular or a room got pathological, ordered by likelihood.

## Server hot paths

### 🟠 P1 — 1. Full replay + N× `structuredClone` on every reconnect
`GameRoom.getSanitizedStatesRange` (gameRoom.ts:387) rebuilds the entire game
from move 0 and `structuredClone`s the full `GameState` once per emitted state
(up to ~11) per reconnecting client. On a flaky mobile connection (frequent
reconnects — and the client retries every 3s, 06 §2) this replays the whole
match repeatedly. Cheap mitigations: cache the folded state per seq, cap the
replay window by move count, and reuse one `foldMoves` iterator (01 §1).

### 🟠 P1 — 2. Redundant `MAX(seq)` query per broadcast recipient
`getSanitizedStateForPlayerId` calls `dbOps.getNextMoveSeq()` (a SQL
aggregate) for the master state (gameRoom.ts:315) — invoked per unique
playerId per `broadcastState`. `state.seq` is already maintained in memory;
use it. Removes a DB round-trip from the hottest path (every move → broadcast
to every player). (Also 02 §12, 03 §4.)

### 🟡 P2 — 3. `structuredClone` of full state per unique viewer per broadcast
`getSanitizedState` deep-clones the whole state, then masks. With 10 players
that's 10 deep clones of `{players, deck, tablePile, discardPile, logs...}`
per broadcast, several times per turn. The per-playerId **cache** in
`broadcastState` (gameRoom.ts:516) already dedups identical viewers — good —
but each *distinct* viewer still clones everything including the 80-entry
`logs` array and the full deck. Consider masking into a fresh object rather
than clone-then-overwrite (you overwrite deck/discard/hands anyway).

### 🟡 P2 — 4. Sync DB writes in the WS message path
Every move does synchronous `saveMove` + `updateGameStatus` (a transaction)
inline before broadcasting. Fine for SQLite locally, but it's on the event
loop; a slow disk stalls *all* rooms. WAL (03 §1) reduces fsync cost. Not
worth async-ifying at this scale, just note it.

## Client / bundle

### 🟠 P1 — 5. ~4.3k lines of avatar code + 2MB+ of assets on the critical path
- `avatarFeatures.ts` (2096 loc of SVG strings) and `avatar/+page.svelte`
  (2201 loc) ship as JS. The feature data should be lazy/JSON so the lobby
  and room don't pay for the avatar builder (07 §1).
- `static/notice_board_hq.png` is **3.7MB**; `bg-large.avif/webp` ~400KB
  each; `/cards` is ~1MB of SVGs. Verify the 3.7MB PNG isn't referenced on
  first paint (there's a 100KB `notice_board.webp` — ensure the HQ PNG is
  only a design-asset source, not shipped/requested). Serve responsive sizes;
  the HQ source shouldn't reach clients.
- Render-blocking external font + unpkg script (07 §2, 08) delay first paint.

### 🟡 P2 — 6. Confetti + FLIP animation cost
`canvas-confetti` fires per-escape and the `cardIn`/`cardOut` transitions run
transform arithmetic per card per state change. On low-end phones a 13-card
hand re-animating on every `stateUpdate` (new `newCardRelativeIndices` map,
`captureCardRects` doing `querySelectorAll('[data-card-id]')` + forced
`getBoundingClientRect` reflow on every message — gameRoom broadcast → client
`captureCardRects`) is a layout-thrash risk. `captureCardRects`
(roomState.ts:802) reads bounding rects for **every** card element on every
state message — that's a synchronous reflow proportional to cards on screen,
every broadcast. Batch reads, or only capture when an animation will actually
run.

### 🟡 P2 — 7. `unreadChatCount` / `markChatsAsRead` spread over full array
`Math.max(...this.chatMessages.map(m => m.id))` (roomState.ts:901) spreads the
entire chat array as function args — O(n) and can hit the argument-count limit
for very long chats. Track `maxId` incrementally. (Also 06 §8.)

## 🔵 P3

- `getGamesForProfile` / archived query do multi-join per lobby load; fine
  with the index recommended in 03 §3.
- `logs` array capped at 80 (good) but cloned in full per viewer per
  broadcast (see §3).
- `getLegalPlays` powerset-ish sequence generation is bounded by hand size;
  irrelevant.
- Autoplay powerset (06 §6) — bounded, negligible.

## Summary

The two worth doing proactively: **(a) stop querying `MAX(seq)` per
broadcast** (trivial, pure win) and **(b) trim the avatar/asset weight off the
critical path** (biggest real user-facing perf lever — first paint). The
reconnect-replay cost matters only if reconnect storms happen, which the
no-backoff client (06 §2) makes more likely — fix that too.
