# General Plan for Skitgubbe

### Technology Stack
* **Frontend:** SvelteKit (configured as a PWA with web push notifications)
* **Backend:** Hono running on Bun
* **Database:** SQLite 
* **Authentication:** JWT-based

---

### Architecture
Docker container. Database mounted in volume.
Users select from pre-configured profiles or adds new profile (name, avatar from a set of icons)
Centralized hub for creating or joining game rooms.
Games stay in RAM when multiple players are active, but hibernate to disk if no one is online.
PWA sends native push notifications to offline players when it's their turn.
Lifetime statistics (wins/games played) recorded per individual profile.
