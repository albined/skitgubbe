---
trigger: model_decision
description: when styling components, creating UI menus, or modifying styles
---

Always adhere to the repo's established casino felt & premium luxury aesthetic when creating or editing components:

### 1. Color Palette & Backgrounds
* **Modals & Overlays:** Matte dark charcoal/brown backgrounds (`linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(35, 30, 25, 0.9) 100%)`).
* **Gold Highlights:** Premium metallic gold accents (`#ffe89e`, `#d4af37`, `#fbbf24`, `#b88728`).

### 2. Panel & Modal Layouts
* **Borders:** Use sharp/rectangular corners (`border-radius: 0 !important;`) and gold gradient borders:
  ```css
  border: 2px solid;
  border-image: linear-gradient(to bottom right, #ffe89e, #b88728, #4a3b22, #1a1a1a) 1;
  ```
* **Inner Boxes:** Avoid nesting borders inside panels ("box-in-a-box" look). Apply `.premium-inner-box` which sets:
  ```css
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  ```

### 3. Controls & Buttons
* **Gold Trimmed Button:** `.gold-trimmed-btn` uses a matte gradient background and a sharp gold gradient border. Hover shifts background, adds an outer gold shadow, and active scales it down to `0.95`.

### 4. Typography
* **Data Panels & Log Streams:** Monospace (`Fira Code`, `Courier New`) to represent raw values, status changes, and cards.
* **Headers & Text Buttons:** Modern high-end sans-serif (`Outfit`, `Inter`) or high-contrast serif for headings.