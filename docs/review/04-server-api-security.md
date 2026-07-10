# 04 — API & Security: routes, auth, notifications

Files: `routes/{games,profiles,push,statistics}.ts`, `middleware/auth.ts`,
`utils/{jwt,gameValidation,ipAndDevice}.ts`, `notifications.ts`, `vapid.ts`

## Threat-model preface

This is a friends-and-family game with a deliberate "Netflix profile picker"
trust model (no passwords). That's a legitimate choice — but the app is
internet-deployed (nginx, cook