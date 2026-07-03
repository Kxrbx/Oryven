# Stride

A minimalist Windows-native todo and project management app.

- **Stack:** Tauri 2 (Rust) + React 18 + TypeScript + Vite
- **Storage:** Local JSON file in your app data directory (no cloud, no telemetry)
- **Visual philosophy:** "Show, don't tell" — priority, project, and status are conveyed through color and visual rhythm, not labels.

Run in dev:

```
npm install
npm run tauri:dev
```

Build a release `.exe` for Windows:

```
npm run tauri:build
```

Rename the app: change `productName` in `src-tauri/tauri.conf.json` and `name` in `package.json`.
