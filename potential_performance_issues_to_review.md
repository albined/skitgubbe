# Performance Issues requiring Review

This file documents performance issues in the Skitgubbe project that involve architectural decisions or complex coordinate/state logic, making them suitable for manual review rather than automatic fixing.

---

## 1. Card Transitions: FLIP Animation Layout Thrashing

* **File:** [cardTransitions.svelte.ts](file:///home/albin/egna_proj/skitgubbe/packages/web/src/lib/state/cardTransitions.svelte.ts)
* **Lines of Interest:** [captureCardRects()](file:///home/albin/egna_proj/skitgubbe/packages/web/src/lib/state/cardTransitions.svelte.ts#L87-L121)

### Context & Mechanism
To implement the flying card FLIP transitions, the coordinator captures the original bounding rectangles of cards when a state update arrives, before Svelte updates the DOM.
To get the "base" layout position (ignoring active card lift/offset transforms):
1. **Write:** It temporarily strips the `.playing-fly-up` class from elements.
2. **Read:** It queries `el.getBoundingClientRect()` on all cards.
3. **Write:** It restores the class to those elements.

### The Problem
Because step 1 modifies classes (causing style changes), step 2's `getBoundingClientRect()` call forces the browser to synchronously compute styles and layout (recalc style/layout reflow) on every single update. In a fast-paced multiplayer game where other players play cards or animations finish, this causes micro-stuttering.

### Potential Solutions to Review
* **Mathematical coordinates:** Calculate card positions mathematically (like the hand card layout coordinates) rather than querying DOM rects.
* **Separated render layer:** Use a separate overlay layer dedicated exclusively to animating/flying cards, keeping cards in the hand and table static, eliminating the need to toggle active CSS styles during measurements.
* **Deferred measuring:** Schedule measuring after DOM mutation ticks or using requestAnimationFrame.

---

## 2. Event-Loop Blocking Synchronous Database Queries

* **File:** [db.ts](file:///home/albin/egna_proj/skitgubbe/packages/server/src/db.ts)
* **Lines of Interest:** All database queries using the `bun:sqlite` `Database` wrapper.

### Context & Mechanism
The server application uses Bun's built-in SQLite driver. This driver runs all queries and transactions synchronously on the Javascript main event loop thread.

### The Problem
While SQLite is exceptionally fast for simple lookups, complex queries (such as aggregate statistics queries, access log queries, and list operations) block Bun's single-threaded event loop. If multiple rooms are active and database size grows, synchronous DB requests will delay response times for all other concurrent WebSockets and HTTP requests.

### Potential Solutions to Review
* **Worker Threads:** Offload SQLite operations to background worker threads using Bun's standard `Worker` API to keep the main event loop free.
* **Async DB Client:** Migrate to an external PostgreSQL database or a client with asynchronous driver support.
* **Query Caching:** Cache intensive statistics calculations in memory and invalidate them only on game completion.
