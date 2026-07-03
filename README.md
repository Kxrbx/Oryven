# Oryven

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

Re-brand Oryven to a different name: see the v0.4.0 CHANGELOG entry for the
full touch-list — the change spans `productName` and `identifier` in
`src-tauri/tauri.conf.json`, the crate name + lib name in
`src-tauri/Cargo.toml`, `name` in `package.json`, the `<title>` in
`index.html`, and every brand string in `src/`. The Tauri directory and
registry uninstall key are derived from these fields; user data will move
to a new on-disk path on rename.
