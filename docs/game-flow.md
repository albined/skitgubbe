# Skitgubbe — Intended Game & Invite Flow

Owner-authored intent (recorded 2026-07-13). This is the source of truth for
*how the app is supposed to behave*; if code or review docs disagree with
this file, this file wins until it's explicitly changed.

## Trust model

- **Self-hosted, LAN-only. Never exposed to the internet.**
- Profiles are a Netflix-style picker: no passwords, anyone can select any
  profile. This is **honor-based by design**.
- The **sign-in log** (with device/location info) is the accountability
  mechanism: impersonation is possible but leaves a trace.
- Security work is held to "good practice" (no leaking credentials into
  logs, validated inputs), **not** to an internet threat model. One known
  gap worth closing: WS `join` identity is client-asserted, which lets
  someone act as another profile *without* a sign-in-log entry — that
  bypasses the trace the honor model depends on (review 02 §1).

## Game creation & invite lifecycle (current design)

There is **no lobby/ready-up step**. The old flow (lobby → everyone accepts
→ game starts) was removed; leftovers of it are legacy (see below).

1. **Create:** the host picks invitees and creates the game. The game starts
   **immediately** in `playing` status. Invitees get a push notification.
2. **Invitees are presumed players:** every invited profile is placed in the
   turn rotation right away with `inviteStatus: 'pending'`.
3. **Turn reaches a pending invitee:** the game **waits** for them. This is
   intentional — not a stall or deadlock. They can resolve it at any time:
   - **Accept** (`POST /api/games/:roomId/accept`): it is still their turn.
     They are dealt `min(3, deck.length)` cards and play normally from then
     on.
   - **Decline / removal** (`POST` decline route, or host removes them):
     they are removed from the rotation and the turn passes to the next
     player.
4. **Round-resolution thresholds count pending invitees** on purpose: a
   round cannot resolve while a presumed player hasn't acted.

### Known edge to verify

- Accepting when the deck is empty deals 0 cards, leaving an accepted player
  in rotation with an empty hand. Whether this can wedge the game is
  unverified — needs a probe/regression test (review 02 §6 residuals).

## Leaving mid-game (⚠️ open decision)

Today, an **accepted** player who leaves a `playing` game is converted to a
**bot** (`isBot = true`) and the server auto-plays their turns
(`botPlayer.ts`); the UI shows a 🤖 badge. The standalone "play against
bots" feature was removed — this takeover path is the only bot code left.

**Undecided:** keep bot takeover as the leave-mid-game behavior, or remove
bots entirely and pick a different behavior (e.g. treat the leaver like a
decline). Until decided, `botPlayer.ts` and `isBot` are **live code, not
legacy** — do not delete them as cleanup.

## Confirmed legacy (safe to clean up)

- The `waiting` game status and the "join as regular player when
  `status === 'waiting'`" path in `applyJoin` — remnants of the lobby era.
  Games are created directly in `playing` (commit ac542f8 started this
  cleanup; review 01 §3 tracks finishing it).
- Naming note: `lobbyState.svelte.ts` / `components/lobby/` on the web side
  refer to the **home screen** (profile picker + game list), not the removed
  pre-game lobby. Rename or keep, but don't confuse the two.
