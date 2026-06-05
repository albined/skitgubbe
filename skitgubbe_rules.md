# SKITGUBBE ENGINE SPECIFICATION

## 1. GAME SETUP

* **Deck:** Standard 52 cards (no jokers). Card values: 2 (lowest) to Ace (highest). Suits only matter in Phase 2.
* **Players:** 1 to 10 players.
* **Starting Hand:** 3 cards per player.
* **Piles & Storage:**
  * **Draw Pile:** Remaining cards, face-down.
  * **Table Pile:** Starts empty. Tracks cards chronologically in **Play Batches** (a batch is any card or sequence played in a single action).
  * **Hidden Trump Storage:** A dedicated slot for the final card drawn from the Draw Pile.

---

## 2. PHASE 1: THE GATHERING

**Goal:** Win tricks to build your hand for Phase 2. 
**Core Rule:** Always maintain a 3-card hand. Whenever you play a card, immediately draw a replacement if the Draw Pile has cards.

### Standard Turn Loop

1. **Lead:** The turn leader plays 1 or more cards of the **same value** face-up to the Table Pile and draws an equal number of replacement cards.
2. **Follow:** In clockwise order, every other player plays 1 or more cards of the **same value** and draws an equal number of replacement cards.
3. **Resolve:** The highest value card wins. The winner moves the entire Table Pile to their personal **Phase 2 Reserve Stack** and leads the next round.
4. **Ties:** If two or more players tie for the highest card:
   * Normal play pauses.
   * Only the tied players play 1 more card (and draw).
   * The highest of these new cards wins the entire pile. Repeat if still tied.

### Special Mechanics

* **The Hidden Trump:** The player who draws the absolute last card from the Draw Pile places it face-down in their **Hidden Trump Storage** (not their active hand).
* **"Strö" (Sprinkling):** A player may "Strö" at any time during the turn loop by dropping one or more cards matching the exact *value* of the card(s) they originally played. This causes an interject in the turns. After sprinkling, they draw replacement cards to maintain their hand, and normal turn order resumes exactly where it paused.

---

## 3. TRANSITION (PHASE 1 to PHASE 2)

**Trigger:** The Draw Pile is empty AND one or more players' hands are empty after a turn loop.

**Actions:**

1. All players pick up their Phase 2 Reserve Stacks to form their new active hands. Any players with cards left over from Phase 1 add those remaining cards to their new Phase 2 hands.
2. The player with the **Hidden Trump** reveals it. The suit of this card officially becomes the **Trump Suit**. The player adds the trump card to their hand and automatically becomes the turn leader for Phase 2.

---

## 4. PHASE 2: THE SHEDDING

**Goal:** Be the first to empty your hand.
**Core Rules:** Strict turn rotation. No out-of-turn plays ("Strö"). You must play a higher value of the same suit OR play a card of the Trump Suit. ALL Trump cards, regardless of value, overpower normal suits.

### Valid Actions (Choose ONE)

* **A. Play a Single Card:** Must be the **same suit** and a **higher value** than the top card, OR any card of the **Trump Suit**. If there is already a Trump card on the table, you must play a **higher value Trump card**. (creates 1 Play Batch). *Note: If the table is empty, you may play any card.*
* **B. Play a Sequence:** Play multiple cards of the **same suit** (or **Trump Suit**) in an unbroken numerical sequence (e.g., 7-8-9 of Hearts). The *lowest* card in your sequence must follow the rules above (higher value matching suit, or a valid Trump play). (creates 1 Play Batch).
* **C. Pick Up (Fail):** If you cannot or choose not to play, you must pick up the **oldest (bottom-most) Play Batch** from the Table Pile and add it to your hand. Your turn ends. The player to your left becomes the new leader, facing the remaining table cards.

### Clearing the Table ("Burning")

**Trigger:** The Table Pile is instantly discarded from the game if the number of distinct **Play Batches** on the table equals the number of active players remaining in the game.
**Resolution:** The player who played the final batch to trigger the clear gets to start a fresh, empty Table Pile.

---

## 5. WIN & LOSE CONDITIONS

* **Escape (Win):** The moment you have 0 cards in your hand during Phase 2, you are safe and exit the game.
* **Game Over:** The game ends when only **one player** remains with cards in their hand.
* **The Loser:** That final player is the Skitgubbe.