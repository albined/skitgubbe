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
  logs, validated inputs), **not** to an internet threat model. The one known
  gap here — WS `join` identity being client-asserted (review 02 §1) — was
  closed by P-1 (2026-07-16): the session cookie is verified at WS upgrade and
  the client-sent `playerId`/`name`/`color` are ignored.

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

## Leaving mid-game (resolved 2026-07-16, D-1)

An **accepted** player who leaves a `playing` game is marked `hasLeft = true`.
They **stay in the roster** (rendered grayed-out, with a "Lämnade" badge) but
are **skipped forever** by the turn rotation, and the cards they were holding
(hand + reserve stack) are **discarded**. Any batches they had already staged
on the table are pulled back out so a departed player can never win a trick or
end up holding the turn (`removeLeftPlayerCards`). If a departure leaves fewer
than two players still able to act, the game ends.

Bots were removed entirely (D-1): the old "leave → bot takeover" path and the
standalone `botPlayer.ts` are gone. `isBot` no longer exists; `hasLeft` is the
replacement flag.

## Confirmed legacy (safe to clean up)

- The `waiting` game status and the "join as regular player when
  `status === 'waiting'`" path in `applyJoin` — remnants of the lobby era.
  Games are created directly in `playing` (commit ac542f8 started this
  cleanup; review 01 §3 tracks finishing it).
- Naming note: `lobbyState.svelte.ts` / `components/lobby/` on the web side
  refer to the **home screen** (profile picker + game list), not the removed
  pre-game lobby. Rename or keep, but don't confuse the two.
