# 05 — Shared Package: rules, types, cardCodec

Files: `packages/shared/src/{rules,types,cardCodec,index}.ts`
Cross-referenced against `skitgubbe_rules.md` (the engine spec).

## Rule-correctness audit (code vs spec)

Went through the spec clause by clause. **The core rules are implemented
faithfully.** Notable confirmations:
- Phase 1 same-value plays, tie-breaker sub-rounds, draw-to-3 replacement,
  hidden-trump-on-last-card — all present and match.
- Phase 2 suit-higher / trump-beats-any / higher-trump-over-trump, sequences
  (lowest card must satisfy the follow rule), pick-up-oldest-batch, burning
  when batches == active players — all match.

Issues found below. (One initial suspicion — a phase-2 burn stall — was
**disproven by a probe test**; see P2 §2a.)

## 🟠 P1

### 1. `cardsFromString`/`intToCard` accept NaN silently → delayed crash
`intToCard` (cardCodec.ts:20) guards `n < 0 || n > 51` but **`NaN` passes
both** (all comparisons with NaN are false). `deckFromString('x,y')` →
`parseInt` → NaN → `SUITS_ORDER[NaN]` = undefined → `SUITS_MAP[undefined]` →
throws on `.symbol`, deep in decode with a useless message. Since decoded
decks come from the DB (`initial_deck`, move `cards`), a single corrupted row
crashes room construction for that game with no diagnostic. Add
`Number.isInteger(n)` to the guard and throw a message naming the bad token.

## 🟡 P2

2a. **Burn threshold uses a different "active" definition than rotation
   (verified correct, but a smell)** — `gameLogic.ts:71` uses
   `players.filter(p => !p.isDone || tablePilePlayers.includes(p.id)).length`
   while `progressPhase2Turn`/`checkGameOverOrProgress` use just `!p.isDone`.
   I suspected the escape-mid-trick case could stall the trick; **a probe test
   disproved it** — the escaping player's batch stays on the table, so they're
   counted, and the burn fires exactly when batch count equals the number of
   distinct contributors (game continues correctly). Not a bug; but two inline
   definitions of "active player" that merely happen to agree are a latent
   trap. Define `activeCount(state)` once, use it in both places, and keep the
   probe scenario as a permanent regression test.

3. **`isValidPlay` carries four dead parameters** — `handCards`, `isTie`,
   `tiedIds`, `playerId` are never read (phase-1 branch ignores tie args;
   phase-2 ignores all four). They inflate every call site
   (`isValidPlay(seq, handCards, table, 2, false, [], '', tSuit)` appears
   3× in `getLegalPlays` alone). Trim the signature to
   `isValidPlay(selected, table, phase, trumpSuit)`; it removes noise and the
   temptation to think tie-state matters to validity (it doesn't — tie plays
   are validated the same as normal phase-1 plays).

4. **`value: string` on `Card`** (types.ts:4) — the value is one of 13 known
   literals; typing it `type CardValue = '2'|...|'A'` would let
   `getValueNumeric` (which returns `indexOf(...)+2`, i.e. **1 for an unknown
   value**) be caught at compile time instead of silently ranking a bad card
   below a 2. The `'?'` mask sentinel (gameRoom.ts) is the reason it's
   `string`; encode the mask as a separate `MaskedCard` type or a nullable
   value so real cards stay strict.

5. **`getValueNumeric` returns 1 for unknown values** rather than throwing.
   Combined with (4) this is how the debug `'Kn'/'D'` cards (02 §10) rank as
   1 instead of erroring. A `-1`/throw contract would surface encoding drift.

6. **`shuffle` and the inline Fisher-Yates in `gameRoom.ts` /`db.ts`** are
   three copies of the same algorithm. `shuffle` is exported from shared —
   use it everywhere (the others operate on `string[]`/`Player[]`, so make
   `shuffle` generic `<T>(a: T[]): T[]`).

## 🔵 P3

- `getLegalPlays` builds `suitGroups` but then also sorts each group again
  inside the loop; minor redundant work, irrelevant at 3–13 cards.
- `VALUES_ORDER`/`SUITS_ORDER` are the single source for both ranking and
  codec indexing — good, but a reordering of `SUITS_ORDER` silently changes
  the on-disk card encoding (cardToInt = suitIdx*13+valIdx). Add a comment:
  "changing these arrays breaks all persisted games." High-blast-radius
  constant with no warning.
- `index.ts` re-exports everything with `*` — fine, but means the `'?'`
  masking sentinel and internal order constants are public API.

## ✅ Good

- **Deterministic integer card codec** (0–51 = suitIdx*13+valIdx) with a
  full round-trip test over all 52 cards. Compact persistence, and the test
  actually covers the invariant. Textbook.
- Rules are genuinely shared (server validation + bot + client all import
  `isValidPlay`/`getLegalPlays`) — no rule is implemented twice across the
  client/server boundary. This is the single most important thing to get
  right in a client/server card game, and it's right.
- `getLegalPlays` correctly enumerates contiguous same-suit subsequences of
  length ≥2 plus singles — a clean generator the bot relies on.
- Test suite covers phase-1 same-value, tie-breaker, phase-2 suit/trump
  precedence. Good nucleus (gaps noted in 09).
