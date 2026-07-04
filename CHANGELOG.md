# Changelog

All notable changes to Oryven are documented here. Versions follow [Semantic Versioning](https://semver.org/).

## [0.5.7] - 2026-07-04

Patch release that hardens the recurring-task logic on top of the v0.5.4 baseline. Ticking a repeating task now always spawns the next occurrence (even when the original has no due date), changing a task's due date re-derives any day-of-month dependencies, and un-ticking a repeating task cleans up its auto-spawned next instance — while preserving user edits so an unintentional click is fully reversible.

### Changed
- **Recurring tasks without a due date no longer silently die.** Ticking a "Every day" / "Every week" / "Every month" reminder that was created without a specific date now anchors the next step to today, so the repeating pattern continues instead of completing the task and leaving no successor. The v0.5.4 floor-on-today behavior is preserved — overdue instances still skip missed occurrences — by threading a `baseDate` option through `nextOccurrence()` and falling back cleanly when the task itself has no anchor date.
- **Monthly `dayOfMonth` follows the date.** Editing the due date of a recurring `{kind: "monthly"}` task (with or without explicit `dayOfMonth`) now re-normalizes the recurrence rule through `normalizeTaskPatch`. The patch path fires when *either* `recurrence` *or* `dueDate` is in the update, so the monthly step and the current date stay phase-locked and a Jan 31 task pushed to Feb keeps clamping correctly.
- **Un-ticking a recurring task cleans up its auto-spawned next instance.** Toggling a task from completed back to open drops the *direct* child that `toggleTask` previously spawned, but only when that child still matches what auto-spawn would have produced. The new `isPristineAutoSpawn(child, parent)` helper compares title / description / priority / project id / labels / subtasks count / comments count *and* requires `child.dueDate === nextOccurrence(parent)`. Any user edit — including rescheduling the auto-spawned child — preserves it, so un-ticking never silently discards work.
- **`isSameRecurringLine` simplifies to a single series-id check.** The previous five-branch comparison (matching `id` / `parentRecurrenceId` / `recurrenceId` against the active task and the series id) collapsed to one line: `recurrenceSeriesId(candidate) === seriesId`. `recurrenceSeriesId` already resolves every member of a chain back to the original task's id via `recurrenceId ?? parentRecurrenceId ?? id`, so the simplification is equivalent and easier to reason about.

### Notes
- Pure logic tightening; no schema version bump; no Rust API change; no React API change. `state.json` round-trips through the v0.5.6 → v0.5.7 binary cleanly. Series ids (`recurrenceId`) and the parent lineage (`parentRecurrenceId`) are unchanged, so existing chain membership is preserved across the upgrade — tasks migrated under the v0.5.4 `recurrenceId ?? parentRecurrenceId ?? id` fallback load unchanged.
- This release is published as `Oryven_0.5.7_x64-setup.exe` and `Oryven_0.5.7_x64_en-US.msi`. Tauri Windows registry `DisplayVersion` updates to `0.5.7` post-install.

## [0.5.6] - 2026-07-04

Patch release focused on data safety, local-first security, and repo quality.

### Changed
- **Saved empty task lists now restore correctly.** Oryven no longer treats a valid saved state with zero tasks as a first launch, so projects, labels, settings, theme, and layout survive after all tasks are cleared.
- **Delete confirmation is enforced.** The `confirmBeforeDelete` setting now protects task deletion from both the task detail panel and the keyboard shortcut path.
- **Date logic uses local calendar days consistently.** Header, Sidebar, QuickAdd, and list grouping now share local-date helpers instead of UTC string slices, preventing around-midnight counter drift.
- **Invalid manual dates are rejected.** Strict `YYYY-MM-DD` parsing now rejects impossible dates instead of accepting `NaN-NaN-NaN`.
- **Tauri security is tightened.** The app now ships with an explicit CSP, removes remote Google Fonts, drops the unused dialog plugin, and narrows the default capability to `core:default`.
- **Dependency and quality checks updated.** Vite and the React plugin are upgraded, dev audit findings are cleared, and `npm run check` now runs typecheck, production build, and production audit.
- Release artifacts are expected as `Oryven_0.5.6_x64-setup.exe` and `Oryven_0.5.6_x64_en-US.msi`; the Tauri Windows registry `DisplayVersion` should update to `0.5.6` post-install.

## [0.5.5] - 2026-07-04

Patch release that corrects the Windows app icon crop.

### Changed
- **Desktop icon width fixed.** The Oryven mark is horizontally recropped so the visible logo fills the icon canvas instead of leaving wide invisible margins on the left and right.
- **Windows icon bundle regenerated.** Tauri PNG/ICO assets were regenerated from the corrected source logo and embedded into the rebuilt installer.
- This release is published as `Oryven_0.5.5_x64-setup.exe` and `Oryven_0.5.5_x64_en-US.msi`. Tauri Windows registry `DisplayVersion` updates to `0.5.5` post-install.

## [0.5.4] - 2026-07-04

Patch release that hardens repeating tasks.

### Changed
- **Recurring dates are now clamped correctly.** Monthly repeats handle end-of-month dates like January 31 without overflowing into March, and yearly repeats handle leap-day tasks by landing on February 28 in non-leap years.
- **Overdue repeats skip missed occurrences.** Completing an overdue repeating task creates the next actionable future instance instead of immediately recreating another overdue task.
- **Repeating series now have stable lineage.** New and migrated recurring tasks share a `recurrenceId`, so repeated complete/uncomplete cycles do not create duplicate future instances.
- **Future instances are cleaner.** Spawned occurrences keep task metadata, labels, priority, project and recurrence, but reset completion state and subtask checks, and start with fresh comments.
- **Persisted state migration added.** Existing `state.json` files without `recurrenceId` load safely and are normalized on the next save.
- This release is published as `Oryven_0.5.4_x64-setup.exe` and `Oryven_0.5.4_x64_en-US.msi`. Tauri Windows registry `DisplayVersion` updates to `0.5.4` post-install.

## [0.5.3] — 2026-07-04

Patch release that fixes horizontal Kanban navigation and refreshes desktop icon handling.

### Changed
- **Kanban board is now grabbable.** Dragging the empty board/column surface pans horizontally when the columns overflow, while task dragging stays isolated to the card drag handle.
- **Kanban horizontal scrollbar remains usable.** The board reserves space above the bottom QuickAdd overlay so the scrollbar is not covered.
- **Desktop icon investigation.** The desktop shortcut points to the installed `oryven.exe` icon resource; the currently displayed mark is the icon embedded in the installed EXE, not an old shortcut target.
- This release is published as `Oryven_0.5.3_x64-setup.exe` and `Oryven_0.5.3_x64_en-US.msi`. Tauri Windows registry `DisplayVersion` updates to `0.5.3` post-install.

## [0.5.2] — 2026-07-04

Patch release focused on the Kanban and Calendar views after an Impeccable product-UI audit.

### Changed
- **Kanban interaction model tightened.** Cards now separate opening, dragging, and completion controls instead of mixing all actions into one draggable surface. Empty project columns stay visible so tasks can be dropped into any project lane.
- **Calendar keyboard support added.** Month grid cells now support roving focus with arrow keys, Home/End, PageUp/PageDown, and Enter/Space to open the first task on the focused day.
- **Calendar and Kanban accessibility pass.** Added clearer ARIA labels, focus states, and non-nested interactive controls for task chips/cards.
- **View styling polished.** Denser Kanban cards, clearer empty drop lanes, sticky Calendar day headers, stable cell sizing, and better narrow-width overflow behavior.
- This release is published as `Oryven_0.5.2_x64-setup.exe` and `Oryven_0.5.2_x64_en-US.msi`. Tauri Windows registry `DisplayVersion` updates to `0.5.2` post-install.

## [0.5.1] — 2026-07-04

Patch release that tightens the Oryven brand mark across the app and Windows surfaces. The canonical `assets/Oryven logo.svg` now uses a cropped viewBox around the actual logo geometry, removing the excess transparent margin from the previous icon render. The same recropped SVG is used for the WebView2 favicon and the in-app Sidebar mark, and the Windows PNG/ICO bundle assets are regenerated from it.

### Changed
- **Logo source recropped.** `assets/Oryven logo.svg` now uses `viewBox="-260.98 -226.92 1061.78 1061.78"` so the mark fills the icon canvas much more tightly without distorting the paths.
- **In-app brand mark updated.** The Sidebar inline SVG uses the same viewBox as the canonical asset.
- **Windows icon assets regenerated.** `src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.ico}` were regenerated from the recropped SVG so the EXE, installer, taskbar, Start Menu, and MSI/NSIS surfaces all share the updated mark.
- This release is published as `Oryven_0.5.1_x64-setup.exe` and `Oryven_0.5.1_x64_en-US.msi`. Tauri Windows registry `DisplayVersion` updates to `0.5.1` post-install.

## [0.5.0] — 2026-07-04

The same database, four different lenses. This release adds a multi-view system to Oryven: every persisted task is now renderable as **List, Kanban, Calendar,** or **Table** without duplicating the underlying data. The previous List layout is preserved verbatim as the first view mode; the three new layouts join it. A new `viewMode` field in the persisted state remembers the user's preferred layout across launches. The existing filter surface (Inbox / Today / Upcoming / All / Completed / project / label / search) is orthogonal — every view mode renders the same filtered set of tasks through its own lens.

### Added
- **ViewMode type and `viewMode` state.** New `"list" | "kanban" | "calendar" | "table"` union exported from `@/types`. `viewMode` lives in `AppState` with a `DEFAULT_VIEW_MODE = "list"` initial value. `setViewMode(mode)` action is a pure setter — it intentionally does NOT close the detail panel, so users can re-render the same filter in a different layout without losing context.
- **ViewModeSwitcher segmented control.** Four icon-only buttons in the Header, one per view mode. Active mode is highlighted with the accent; tooltip on hover shows the layout name plus the `Ctrl/Cmd Alt <digit>` shortcut. The segmented control is `role="radiogroup"` with each button `role="radio" aria-checked` so screen readers announce the current layout and the option list correctly.
- **Four view components under `src/components/views/`**, all driven by the same `filterTasksForView` helper so they never disagree on what "the current filter" contains:
  - **List** (the original `TaskList`): the only view with full @dnd-kit/sortable drag-to-reorder within day-groups; the others are read-mostly (Kanban lets you move between columns).
  - **Kanban**: one column per project plus an "Inbox" column for tasks without a project. Drag a card across columns to change its `projectId` via the store's `moveTask` action. A `DragOverlay` renders a tilted preview card while dragging.
  - **Calendar**: 6-week month grid (Monday-start, locale-aware). Today is highlighted with an accent-soft fill + accent ring. Click a day cell to focus it. Tasks without a due date surface in a "No date" strip at the top. Month nav (← / →) + a "Today" snap button.
  - **Table**: compact, sortable grid with seven columns (✓ / Title / Project / Labels / Due / Priority / Status). Click any column header to toggle sort; null values (no project, no due date) sort to the end regardless of direction.
- **Shared `filterTasksForView` helper in `src/utils/viewFilter.ts`.** The filter / sort logic that used to live as a private function inside `TaskList.tsx` is now exported. All four views import the same function so they show bit-identical task sets. `bucketByProject` rides along for the Kanban columns.
- **Keyboard shortcuts `Ctrl/Cmd Alt 1..4`.** Switch view modes by number. Documented in Settings → Keyboard under a "View layouts" divider so the layout switchers read as their own grouping. The shortcuts avoid `Ctrl/Cmd 1..5` (browser tab switching) and `Ctrl/Cmd Shift 1` (extension collisions) by sitting on the Alt plane.
- **ViewModeSwitcher keyboard shortcut resolver `viewModeForHotkey(n)`** in `src/components/ViewModeSwitcher.tsx` — statically exhaustive for 1..4, returns `null` for any out-of-range digit. App.tsx registers each combo explicitly (no loop) so the shortcut engine has a static handler table; the lookup is guaranteed to find a match in `VIEW_MODE_DEFS` for every registered digit, so the call sites use a non-null assertion rather than a defensive `?? viewMode` fallback.

### Schema
- **`PersistedAppState.viewMode?: ViewMode` (additive, optional).** Existing `state.json` files load unchanged — the field is `undefined` until first save after the upgrade, and the store's `DEFAULT_VIEW_MODE = "list"` covers that case. **The on-disk envelope gains one optional field; no version bump required** because the new field is purely additive and the load path is forward-compatible.
- **`ViewMode` union exported from `src/types.ts`** alongside `VIEW_MODES: ViewMode[]` and `DEFAULT_VIEW_MODE: ViewMode` so the rest of the app can iterate and reference them without re-declaring literals.
- **Forward-compatible state load.** `loadState()` in `src/lib/tauri.ts` runs every loaded state through a `normalizePersistedState` helper that coerces unknown `viewMode` values (e.g. a state file written by an earlier build that shipped a now-removed view) to `undefined`, so the active button in the switcher always highlights and the dispatcher never falls through to a stale branch. Old state files round-trip through the new binary cleanly.

### Changed
- **`TaskList.tsx` refactored to consume the shared `filterTasksForView`.** The private `filterForView` function is gone. The group-by-day math for Today / Upcoming views and the dnd-kit reorder handlers stay local to `TaskList` because no other view needs them.
- **Header gains a `ViewModeSwitcher` cell** to the left of the New Task button. Compact segmented control: 30×28px per button, 2px gutter, hairline border, hover surfaces to `var(--surface-hover)`, active surfaces to `var(--surface-active)` with an accent color + 1px hairline-strong halo. Tooltip on each button shows the layout name + the corresponding `Ctrl/Cmd Alt <digit>` shortcut.
- **App.tsx gains a `ViewDispatcher`** that switches on `viewMode` and renders the matching view component. The `viewMode` state is persisted in the same debounced save call as the rest of the persisted state, so the user's preferred layout survives restarts.
- **Settings → Keyboard list** documents the four view-mode shortcuts under a small "View layouts" divider that visually separates them from the navigation / task-selection chords above.

### Notes
- **No new icons added to the icon set.** Each view's icon is rendered from `lucide-react` (`List`, `LayoutGrid`, `CalendarDays`, `Table2`) and rendered as an inline SVG at 15px. The Tauri bundle binaries (NSIS + MSI) keep the canonical `assets/Oryven logo.svg` mark on every surface.
- **QuickAdd placement.** The bottom-of-pane QuickAdd input renders inside every view's wrap, so `Ctrl/Cmd N` jumps focus into the same input regardless of which layout the user is on. The new-task input is the only affordance that crosses view boundaries — every other view-specific affordance (drag-to-move on Kanban, click-to-open chips on Calendar, click-to-open rows on Table) is a per-view interaction.
- **Cross-view consistency guarantee.** Because all four views call `filterTasksForView(view, tasks, projects, labels, sortMode)` with the same arguments, the user's counts (inbox, today, upcoming, all, completed) stay identical as they flip through view modes. The Header counter — the only "live" count that depends on the filter — is unaffected by view mode and continues to show the same `X tasks` string in every layout.
- **Pure additive feature.** No Rust API change. No React API change beyond the new exports. No removal of any prior capability. `state.json` round-trips through `0.4.2 → 0.5.0` unchanged; new installs read the optional `viewMode` field as `undefined` and the store fills in `DEFAULT_VIEW_MODE = "list"` lazily.
- This release is published as `Oryven_0.5.0_x64-setup.exe` and `Oryven_0.5.0_x64_en-US.msi`. Tauri Windows registry `DisplayVersion` updates to `0.5.0` post-install.

## [0.4.2] — 2026-07-04

Patch release that ships the `scripts/uninstall-and-install.ps1` state-preservation fix from the v0.4.1 post-release hotfix as a real downgrade-safe artifact. v0.4.1 installers bundled before the fix could wipe `%APPDATA%\app.oryven.desktop\state.json` during in-place upgrades because the v1+ orchestrator skipped the pre-uninstall snapshot that the working `scripts/install-v0.4.0.ps1` reference had. Verified end-to-end on this host: a 0.4.1 → 0.4.2 in-place upgrade walked uninstall → install → restore without any data loss; the post-install `state.json` was byte-identical to the pre-install snapshot.

### Added
- **`scripts/uninstall-and-install.ps1` §4.5 `PRESERVE state.json BEFORE uninstalling`.** Atomic-copies `%APPDATA%\app.oryven.desktop\state.json` to a timestamped `%TEMP%\oryven-state-backup-preserved-<ts>.json` via the same `.tmp + Move-Item -Force` pattern `lib.rs::save_state` uses. Guarded by `-not $FreshInstall -and -not $SkipUninstall -and $prior -and $uninstallWillRun` so re-runs at the same target / idempotent early-exits / no-prior installs never accumulate stale TEMP backups.
- **`scripts/uninstall-and-install.ps1` §7.5 `RESTORE state.json AFTER install settlement`.** Counterpart to §4.5. If the install left the canonical AppData path missing or size-mismatched, the snapshot is restored atomically. If the installed size already matches the backup, `STATE_PRESERVED_PAST_INSTALL` is logged and the unnecessary write is skipped.

### Notes
- For v0.4.x → v0.4.x polish upgrades there is no `schema_version` change, so the size-equality heuristic is sufficient. A future contribution that bumps the state envelope must revisit this logic — size-equality alone would clobber the installer's freshly-migrated state with the pre-install snapshot. A schema-version-aware comparator is the obvious next step when the constraint relaxes.
- **Side-effect of the bump on installer artifacts.** NSIS installer + MSI now read `Oryven_0.4.2_x64-setup.exe` / `Oryven_0.4.2_x64_en-US.msi`. Tauri Windows registry `DisplayVersion` updates to `0.4.2` post-install.
- **Note on downstream distribution.** The NSIS installer does NOT bundle the `scripts/` directory — only the frontend dist `src-tauri\target\release` binary + bundle resources. So the orchestrator fix ships to humans running `git pull`-then-install, but does not auto-apply to a host that downloaded only the NSIS installer. A future installer-side rollback-safety feature (e.g. an `IFEO`-style settings-store snapshot before uninstall) would close that gap.
- This release is published as `Oryven_0.4.2_x64-setup.exe` and `Oryven_0.4.2_x64_en-US.msi`.

## [0.4.1] — 2026-07-04

A brand-mark polish patch. The canonical brand asset is now `assets/Oryven logo.svg` and is read by every surface (NSIS / MSI installer resources, WebView2 favicon, in-app Sidebar mark, MSI tile, taskbar pinned tile, Start Menu tile). No behavioural change; no schema version bump; pure visual polish.

### Changed
- **Rasters regenerated from the new canonical SVG.** `npx tauri icon "assets/Oryven logo.svg" --output src-tauri/icons` produces `src-tauri/icons/{32x32,128x128,128x128@2x}.png` plus the multi-res `icon.ico`. Identical colours + geometry as the source SVG, so EXE resource, MSI tile, taskbar pinned tile, and Start Menu tile all render the same mark.
- **In-app brand mark updated.** `src/components/Sidebar.tsx`'s `sidebar-brand` cell now inlines the two new `<path>` elements from the source SVG (filled `#4a69d3`) inside the existing `.brand-mark` 18×18 flex box. The `aria-hidden` wrap is preserved so the adjacent `<span class="brand-label">Oryven</span>` remains the accessible name for the parent button — no double-ARIA.
- **WebView2 favicon now mirrors the same SVG.** `public/favicon.svg` (Vite-copied from `assets/Oryven logo.svg`) is referenced via `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` in `index.html`. The WebView2 favicon now reads as the canonical brand mark, matching the OS-level surfaces.
- **Canonical brand source relocated to `assets/`.** `Oryven logo.svg` moved from project root into `assets/Oryven logo.svg` so non-code assets live in a clearly-purposed subfolder; the regen command and CHANGELOG references update accordingly. `src-tauri/icons/.gitignore` now whitelists the four canonical PNG/ICO files (32x32.png, 128x128.png, 128x128@2x.png, icon.ico) and ignores everything else — a future `npx tauri icon` regen cannot bloat the working tree with platform-specific extras (`icon.icns`, `android/`, `ios/`, `Square*.png`, `StoreLogo.png`).
- **`scripts/generate-icons.ps1` retired.** The PowerShell + System.Drawing helper that drew the prior filled-circle-with-hole mark with `[System.Drawing.SolidBrush]` is gone. The canonical regen path is now a single `npx tauri icon` invocation against `assets/Oryven logo.svg`.

### Notes
- Pure visual polish; no schema version bump; no Rust API change; no React API change. `state.json` round-trips through `0.4.1` installers unchanged. Re-installing on top of `0.4.0` is an in-place upgrade; user data (tasks, projects, labels, theme, settings, persisted state.json) is preserved.
- This build's verify gate is `scripts/uninstall-and-install.ps1 -TargetVersion 0.4.1` — the v1+ parameterized orchestrator that supersedes `scripts/install-v0.4.0.ps1` now that Oryven is already installed; the v0.4.0-specific script remains the Stride→Oryven transition path for legacy hosts.
- Published as `Oryven_0.4.1_x64-setup.exe` and `Oryven_0.4.1_x64_en-US.msi`.

### Notes (post-release hotfix)
- **`scripts/uninstall-and-install.ps1` had a state-preservation gap that wiped user `state.json` during in-place upgrades.** The v0.4.0-specific orchestrator (`scripts/install-v0.4.0.ps1`) had a `MIGRATE state.json BEFORE uninstalling` step that atomic-copied the legacy Stride state.json into the new identifier path. The generic v1+ orchestrator (`uninstall-and-install.ps1`) skipped this entirely, so calling `-TargetVersion 0.4.1` over a 0.4.0 install let Tauri's NSIS uninstaller purge `%APPDATA%\app.oryven.desktop\` and the new install landed with no `state.json`. Observed on this host: pre v0.4.0 state.json (4,699 bytes, MD5 `A3C17199DF2B23C4674BC3117FE193D9`) was lost during the 0.4.0→0.4.1 transition. Recovered from the Stride-era `%TEMP%\stride-state-backup-pre-oryven-install.json` backup (4,698 bytes, MD5 `8F83A8834D00C99DD4D182F0FBDFE09A`) — any user edits made after the v0.4.0 install are unrecoverable but the bulk of the data is back.
- **Two new sections in `uninstall-and-install.ps1` close the gap.** §4.5 `PRESERVE state.json BEFORE uninstalling` snapshot-copies `%APPDATA%\app.oryven.desktop\state.json` to a timestamped `%TEMP%\oryven-state-backup-preserved-YYYYMMDD_HHmmss.json` via the same atomic `.tmp + Move-Item -Force` pattern lib.rs::save_state uses, but only when an uninstall will actually run (skipped for `FreshInstall`, `SkipUninstall`, the idempotent `ALREADY_AT_OR_ABOVE_TARGET` early-exit, no-prior, or no-resolved-uninstall-command cases). §7.5 `RESTORE state.json AFTER install settlement` reverse-copies the snapshot if the new install left `%APPDATA%\app.oryven.desktop\state.json` missing or size-mismatched; if the installed size already matches the backup, it logs `STATE_PRESERVED_PAST_INSTALL` and skips the unnecessary copy. Future in-place upgrades (e.g. v0.4.1 → v0.4.x) now round-trip user data transparently. Sanity-rerun on this host (already at 0.4.1) hit the `ALREADY_AT_OR_ABOVE_TARGET` early-exit as expected — the snapshot step did not fire because no uninstall was scheduled.
- **Suggested downstream bump to v0.4.2** so the fixed orchestrator ships to other hosts. Local workflow on this box is already protected by the in-tree fix; the version bump is purely for downstream reinstalls.

## [0.4.0] — 2026-07-04

The app formerly known as Stride is now Oryven — end-to-end. This release renames the user-visible brand, the Tauri identifier, the cargo crate, the install directory, the registry entry, the binary name, the localStorage key, and the bundled seed copy. A `scripts/install-v0.4.0.ps1` orchestrator copies user data from the old path to the new one **before** uninstalling Stride, so the upgrade is invisible: tasks, projects, labels, theme, settings, and the persisted `state.json` survive the rename. There is no schema change, no Rust API change, and no React API change; the React components only see different strings.

### Renamed
- **Product brand.** `productName` `Stride` → `Oryven` in `src-tauri/tauri.conf.json`. Visible in the window title, sidebar brand label, Settings `About` panel, Settings panel subtitle ("Tune how Oryven feels…"), Data-section description ("Where Oryven writes your tasks…"), Appearance hint ("Switch any time. Oryven remembers."), HTML `<title>`, README header, the cargo crate description, the bundled Tauri `bundle.longDescription`, and the seed-data first task ("Welcome to Oryven"). `src/types.ts` document comment also updated.
- **Tauri identifier.** `app.stride.desktop` → `app.oryven.desktop`. This is the breaking change that drives everything else: the AppUserModelID, the WebView2 secure origin, the registry uninstall key path, *and* the on-disk path Tauri resolves via `app.path().app_data_dir()` for `state.json`.
- **Cargo crate & library.** `[package].name` `stride` → `oryven` and `[lib].name` `stride_lib` → `oryven_lib` in `src-tauri/Cargo.toml`. `src-tauri/src/main.rs` updated to call `oryven_lib::run()`. `src-tauri/Cargo.lock` rewritten accordingly.
- **Bundle binary.** `stride.exe` → `oryven.exe` (Tauri derives the exe name from the cargo crate name). The bundled `app.stride.desktop.exe` is also replaced by `app.oryven.desktop.exe` on disk for callers that prefer the Tauri identifier form.
- **Bundled installers.** NSIS: `Stride_0.X.Y_x64-setup.exe` → `Oryven_0.4.0_x64-setup.exe` (Tauri uses `productName` for the installer's prefix). MSI: `Stride_0.X.Y_x64_en-US.msi` → `Oryven_0.4.0_x64_en-US.msi`.
- **npm package name.** `stride-app` → `oryven-app` in `package.json` and `package-lock.json`.
- **localStorage fallback key.** `stride.appstate` → `oryven.appstate` in `src/lib/tauri.ts`. This is the dev-mode-only path (real users save through the Rust IPC + `state.json`), but the rename avoids stale data showing up during developer reloads.
- **Install location.** `%LOCALAPPDATA%\Programs\Stride\` → `%LOCALAPPDATA%\Programs\Oryven\`. Tauri's NSIS installer derives the install directory from `productName`.
- **Install scripts and verifier.** `scripts/verify-current-install.ps1` rewritten to look for `Oryven` / `app.oryven.desktop` instead of `Stride` / `app.stride.desktop`. `scripts/install-v0.4.0.ps1` is a new orchestrator that handles the migration.

### State migration (run automatically by `scripts/install-v0.4.0.ps1`)
1. Stop any running `stride.exe` / `app.stride.desktop.exe` (graceful, then force after 2 s).
2. Locate the legacy Stride install in the registry (HKCU + HKLM, both 64-bit and WOW6432Node roots, `DisplayName` matching `^Stride(\s|$)`).
3. Locate the legacy `state.json` at `%APPDATA%\app.stride.desktop\state.json` if present.
4. Create `%APPDATA%\app.oryven.desktop\` and **copy** the legacy `state.json` into it. This happens *before* the uninstall so even if the legacy NSIS uninstaller purges `%APPDATA%\app.stride.desktop\`, our copy in the new location is intact.
5. Run the legacy Stride uninstall silently (using the registry's `QuietUninstallString`, fallback `UninstallString`, fallback `<InstallDir>\Uninstall.exe /S`).
6. POLL-verify the legacy `DisplayName=Stride` registry key is gone; log WARN if a stale entry persists but proceed (the user gets the Oryven installer either way).
7. Run the Oryven `NSIS /S` install and **poll** `%LOCALAPPDATA%\Programs\Oryven\Uninstall.exe`'s `LastWriteTimeUtc` for three stable 500 ms samples — the canonical "install settled" signal.
8. Run `scripts/verify-current-install.ps1` (now Oryven-aware) to confirm `DisplayVersion=0.4.0` and the binary path.

### Known subtleties
- **WebView2 secure origin changes when the identifier changes.** Tauri 2 partitions the WebView2 storage by app AUMID/identifier, so any data the frontend put in `localStorage` *before* the rename lives in a different partition than the one Oryven reads from. Real users save through the Rust `save_state` IPC + `state.json`, so this only matters for dev-mode portable testing. The fallback key was renamed as a hygiene matter; no real user data lives there.
- **Old `Stride` registry entries can co-exist briefly with Oryven's** if the uninstaller's silent flag masked a failure. The install script logs a WARN, polls the registry, and proceeds — Oryven's installer creates a parallel entry regardless of whether the legacy one is gone.
- **MS Edge / Teams / WebView2 caching the legacy origin.** First launch of Oryven may briefly show a "loading" state before the WebView2 partition initializes under the new identifier. This is purely cosmetic and resolves on the next launch.

### Notes
- This release is published as `Oryven_0.4.0_x64-setup.exe` and `Oryven_0.4.0_x64_en-US.msi`. Re-running the installer over an existing `0.3.x` install goes through the state-migration path described above.
- Reinstall-via-direct-copy fallback: if `state.json` is at `%APPDATA%\app.stride.desktop\` and `%APPDATA%\app.oryven.desktop\` is empty, copy manually (no schema conversion needed — the on-disk envelope is identical between Stride v0.3.x and Oryven v0.4.0).
- Pure rename + migration; no schema version bump; no Rust API change; no React API change. `state.json` round-trips between Stride v0.3.7 and Oryven v0.4.0 byte-for-byte.
- **Icon set regenerated for Oryven (post-release polish).** `scripts/generate-icons.ps1` was updated alongside v0.4.0 so the next `npm run tauri:build` automatically picks up the Oryven mark on EXE resources, MSI tile, and taskbar pinned tile. The script now ships a multi-resolution `icon.ico` (PNG-in-ICO, six sizes 16/32/48/64/128/256) so Windows 11 Start Menu + multi-DPI Explorer renderers see a sharp mark at every context. Inner-hole ratio bumped from 0.26 to 0.30 so the OS mark matches the in-app brand SVG exactly. Solid colour accent unchanged so EXE/MSI/taskbar/in-app brand mark read as the *same* mark across all four surfaces. Post-regen assertion confirms all four files exist + sit within sane byte bands.
- **Legacy install-script retirement.** `scripts/detect-stride-install.ps1` (Stride-only detector) and `scripts/uninstall-and-install-v0.2.0.ps1` (v0.2.0 one-shot orchestrator) retired once the identifier change settled. Replaced by `scripts/detect-oryven-install.ps1` (read-only Oryven detector with optional legacy-Stride presence diagnostics for migration spot-checks) and `scripts/uninstall-and-install.ps1` (version-parameterized generic orchestrator that supersedes `install-v0.4.0.ps1` for v1+).
- **Brand mark refreshed to the new `Oryven logo.svg`.** The user's SVG — two interlocking paths filled `#4a69d3` — now ships as the canonical mark on every surface. Raster icons (`src-tauri/icons/32x32.png`, `128x128.png`, `128x128@2x.png`, multi-res `icon.ico`) are regenerated from the SVG via `npx tauri icon "Oryven logo.svg" --output src-tauri/icons` (so EXE resource, MSI tile, taskbar pinned tile, and Start Menu tile all read the exact same mark). Same SVG is copied to `public/favicon.svg` and referenced via `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` in `index.html` so the WebView2 favicon matches the brand. The in-app brand mark in `src/components/Sidebar.tsx` was replaced inline with the same two `<path>` elements so EXE, MSI, taskbar, WebView2 favicon, and in-app sidebar read as the same logo. `scripts/generate-icons.ps1` retired; the regen flow is now a single `npx tauri icon` invocation against the project-root SVG.

### Notes
- This release is published as `Oryven_0.4.0_x64-setup.exe` and `Oryven_0.4.0_x64_en-US.msi`. Re-running the installer over an existing `0.3.x` install goes through the state-migration path described above.
- Reinstall-via-direct-copy fallback: if `state.json` is at `%APPDATA%\app.stride.desktop\` and `%APPDATA%\app.oryven.desktop\` is empty, copy manually (no schema conversion needed — the on-disk envelope is identical between Stride v0.3.x and Oryven v0.4.0).
- Pure rename + migration; no schema version bump; no Rust API change; no React API change. `state.json` round-trips between Stride v0.3.7 and Oryven v0.4.0 byte-for-byte.

## [0.3.7] — 2026-07-04

A one-predicate reconciliation patch. Audit ran across `src/components/Sidebar.tsx`, `src/components/Header.tsx`, and `src/components/TaskList.tsx` for the Upcoming and All-tasks views; confirmed one real bug and zero additional scope drift.

### Fixed
- **Header's "Upcoming" counter over-reported future-scheduled tasks.** `src/components/Header.tsx`'s `describeView()` filtered `open && dueDate > today` — with no upper bound. So a state with 5 tasks due this week and 3 more due Aug 30 / Sep 14 / Nov 1 would show the badge claiming **"8 scheduled"**, while Sidebar's "Upcoming" badge correctly said **"5"** (it used the 7-day upper bound) and the Upcoming pane rendered exactly those 5 tasks. The badge / counter / pane would visibly disagree on every render whenever a future-scheduled task existed. Fixed by introducing the `in7DaysISO` computation alongside the existing `todayISO` and applying the unified predicate **"open tasks scheduled strictly after today and within the next 7 calendar days"** (`open && dueDate !== null && today < dueDate <= today+7`) — bit-identical to the Sidebar/TaskList filters. Today itself still belongs to the Today view, not Upcoming, and tasks past the 7-day window remain visible in All-tasks but stay out of Upcoming.
- **Tiny hardening on the Today overdue filter.** Was `open(t) && t.dueDate && t.dueDate < todayISO`; now `open(t) && t.dueDate !== null && t.dueDate < todayISO`. No behaviour change (the truthy `dueDate &&` was already rejecting `null` since YYYY-MM-DD strings never equal empty), but the new form is unconditional about what "no due date" means. The Header's split `X today · Y overdue` summary is *intentionally* still richer than the merged Sidebar badge — the sum equals the unified `<= today` count used by Sidebar and TaskList, so the badge and the pane still agree.

### Audit verified-consistent (no change needed)
- **Today** — Sidebar / TaskList / TodayWidget already share `dueDate <= today && open` since v0.3.4. Header keeps the informative `today · overdue` split; the sum equals the unified count.
- **Inbox** — `open && !projectId` everywhere.
- **All tasks** — `open` everywhere.
- **Completed** — `completed` everywhere.

### Notes
- This release is published as `Stride_0.3.7_x64-setup.exe` and `Stride_0.3.7_x64_en-US.msi`. Re-running the installer over an existing `0.3.x` install performs an in-place upgrade; existing tasks, projects, labels, theme, settings, and the persisted `state.json` are preserved untouched. Pure UI consistency fix; no schema or Rust change.

## [0.3.6] — 2026-07-04

The TodayWidget becomes a real, clickable popover. The little "4 / 3 today" card in the sidebar no longer just navigates to the Today view — it now opens a panel anchored to its right that surfaces the actual tasks partitioned into three buckets (overdue, due today, completed today), with click-through to each task's detail view and a footer button that jumps to the full Today list. Pure UX feature; no schema, no Rust, no persistence change — `state.json` round-trips through `npx tauri build` unchanged.

### Added
- **Rich popover on the TodayWidget.** Clicking the widget toggles a 340px card portaled to `document.body` and anchored to the right edge of the sidebar widget (the sidebar is the leftmost column, so the popover extends right into the main pane). Card breaks down into three independent bucket sections:
  - **Overdue** — open tasks with `dueDate < today`, sorted oldest first so the most-neglected tasks bubble up. Each row carries a small warm-tinted date chip ("2 days ago", "Mon, Jun 30") so users can spot overdue rows at a glance.
  - **Due today** — open tasks with `dueDate === today`. Each row carries an accent-tinted "today" chip that visually matches the active accent ring.
  - **Completed today** — closed tasks with `completedAt` starting today, sorted most-recent first ("fresh wins"). Body is struck through to read as already-done, hovering lifts the strikethrough brightness so the row never feels like dead text.
  - Empty buckets show an em-dash `—` placeholder rather than disappearing, so the user always sees the same three-bucket shape and can rely on its position.
  - An overall empty-state copy block ("Nothing scheduled today. Open day — use it deliberately or just breathe.") when the entire today's plan is empty, using a small `<ListChecks />` motif.
- **Click-through to task detail.** Clicking any row in any bucket calls `openDetail(taskId)` and closes the popover. The user lands in the right-rail detail view for that task without an intermediate navigation; the existing `/today` view is unaffected. Task rows use `e.stopPropagation()` so they don't double-fire as "click-outside" close.
- **Open Today view footer button.** Replaces the v0.3.5 "widget click = navigate" affordance in case the user still wants the list view — the popover's footer button calls `setView({ kind: "today" })` and closes the panel. It's disabled when none of the buckets have anything in them (so the affordance disappears in lockstep with the empty-state copy).
- **Active state while open.** The widget card picks up a subtle `is-open` modifier (accent-soft background, hairline-strong border) while the popover is mounted, mirroring the active-state treatment already used on the Sidebar nav-items — so the user can see at a glance that they're inside a panel tied to that card.
- **`<ArrowUpRight />` and `<ListChecks />` icons added to the lucide-react import list.**

### Click-outside / focus / keyboard
- **Window click-outside closes the popover.** Uses `mousedown` so a drag operation inside the popover that ends with `mouseup` outside doesn't close it before the click resolves. Trigger element (`[data-tw-trigger]`) is exempt — clicking the widget itself toggles, so it's not a click-outside.
- **`Esc` closes the popover.** Uses `stopImmediatePropagation()` (not `stopPropagation`) so opening the popover doesn't also fire ModalRoot's own Esc listener if a modal is stacked behind. Same fix that landed in v0.2.2 for the SortPopover.
- **Focus returns to the widget button on close** via a teardown effect that captures the trigger element by `data-tw-trigger` and `focus({preventScroll: true})`. Keyboard users land back where they triggered the popover, not stranded at `document.body`.
- **Bucket list has `max-height: 200px; overflow-y: auto`** so a deeply-loaded Today plan doesn't grow the panel past the viewport — the user scrolls within each bucket rather than the whole window scrolling.

### Visual treatment
- **Pop-in animation.** `.tw-popover.pop-in` carries a 160ms `cubic-bezier(0.2, 0.7, 0.2, 1)` fade + 4px translate-Y + 0.985 scale-in. Mirrors the same global `pop-in` contract used by SortPopover and ModalRoot. Falls back gracefully to instant display for users with `prefers-reduced-motion` (the transform settles at the keyframe end-state).
- **Each bucket has a colored leading dot.** Overdue gets `var(--danger)`, Due today gets `var(--accent)` with a 2px accent-soft halo ring so it reads as "active", Completed today gets `var(--text-faint)` — the bucket label acquires a small visual identity without needing a row-level icon.
- **Bucket headers use the established 10px uppercase / `0.08em` letter-spacing chip treatment** — same look as Activity / Comments / Sub-tasks headers in the right rail of TaskDetail, so the panel doesn't feel like a new vocabulary.
- **Hover, focus, and active states on rows match the rest of the app.** `var(--surface-hover)`, `var(--focus-ring)` on `:focus-visible`, and a 0.992 active scale to feel "button-y" without competing with the simulated tactile press on the widget card itself.

### Notes
- This release is published as `Stride_0.3.6_x64-setup.exe` and `Stride_0.3.6_x64_en-US.msi`. Re-running the installer over an existing `0.3.x` install performs an in-place upgrade; existing tasks, projects, labels, theme, settings, and the persisted `state.json` are preserved untouched.

## [0.3.5] — 2026-07-04

A small UX-polish patch that exposes the TodayWidget's underlying breakdown on hover, so users get the big-numeral pair *and* its decomposition in one glance without having to click through to the Today view to inspect it.

### Added
- **Hover tooltip on the TodayWidget.** The button now carries a `title` attribute that previews the same scope's decomposition in the exact format the user requested: `"3 due · 2 done · 1 open"` using the `·` separator already used by the EmptyState hint copy. When the day's plan is empty, the title quietly switches to `"No tasks due today"` so the user doesn't see a meaningless "0 due · 0 done · 0 open" string.
  - `dueToday` is unchanged — total scope (overdue + today, open OR completed).
  - `doneToday` is unchanged — completed subset of the same scope.
  - **`openToday` is new** — derived as `dueToday - doneToday`. Always ≥ 0 because both values come from the same filtered set (the v0.3.x scope reconciliation guarantees this).
  - Native `title` attribute chosen over a custom React tooltip because (a) it's free, (b) it matches the same hover-preview pattern used by Activity rows / meta-date chips / recurring-badge throughout the app, and (c) the existing `aria-label` continues to carry the action description for screen readers — the two don't compete. Sighted users get the breakdown on hover; assistive tech gets the action statement.

### Notes
- Pure UX; no state and no schema changes. `state.json` is preserved verbatim through re-install.
- Published as `Stride_0.3.5_x64-setup.exe` and `Stride_0.3.5_x64_en-US.msi`.

## [0.3.4] — 2026-07-04

A reconciliation patch that gives the app one definition of "today" instead of three. UX-only change — `state.json` round-trips through the v0.3.x schema unchanged.

### Fixed
- **Three Today counts told inconsistent stories.** `Sidebar Today` showed `open(t) && t.dueDate === today` (strict equality, no overdue); `TaskList today view` showed `open(t) && t.dueDate <= today` (overdue + today, the productivity-app convention); `TodayWidget` mixed two scopes (numerator = sparkline's completed-today count, denominator = strict `dueDate === today`). v0.3.3 already fixed the widget's internal math, but the three counters still disagreed: a task overdue yesterday could be visible in the Today list, missing from the Sidebar count, and absent from the widget. Collapsed them all to one definition — **`today` = `dueDate <= today`** (overdue + today). Sidebar nav count uses the open subset; TodayWidget numerator + denominator reference the same full set (open OR completed); TaskList view already used this scope.
- **Sparkline semantics unchanged on purpose.** The widget's 7-bar sparkline continues to measure *completion activity per day*, regardless of when each completed task was due. It's a complementary signal to the constrained-scope big-numeral pair — "you crushed it today" vs. "you finished X of your Y today-planned items" — not a redundant one.

### Notes
- Migrating from v0.3.3 is in-place; `state.json` is preserved untouched.
- Published as `Stride_0.3.4_x64-setup.exe` and `Stride_0.3.4_x64_en-US.msi`.

## [0.3.3] — 2026-07-04

A one-block bugfix to the Today widget. UX-only patch; the sparkline is unchanged.

### Fixed
- **Today widget displayed numerator > denominator.** The widget's big-numeral pair read like "4 / 3 today" on a state where the user had only 3 tasks *due* today but had completed 4 tasks *on* today (some due yesterday, some due tomorrow). Mathematically impossible — the app claimed the user did more than they planned. Root cause in `src/components/TodayWidget.tsx`: the `doneToday` numerator was the sparkline's completed-today count (which measures *completion activity* regardless of due-date), while the `dueToday` denominator was a strict `dueDate === today` count. Two different scopes. The fix filters once for `dueDate === today` and counts both numerator and denominator against that same set, guaranteeing `doneToday ≤ dueToday` and reading as an honest "X of the Y tasks on your plate for today are done."

### Notes
- Sparkline semantics intentionally unchanged. It continues to measure *completion activity per day*, regardless of when each completed task was due — a complementary productivity signal to the big-numeral pair, not a redundant one.
- Purely presentational; the persisted state (`state.json`) is not touched. Re-running the installer over v0.3.2 replaces the binary only.
- Published as `Stride_0.3.3_x64-setup.exe` and `Stride_0.3.3_x64_en-US.msi`.

## [0.3.2] — 2026-07-04

A one-line CSS bugfix. CSS-only patch, no schema change, no Rust change, no JS change. Re-install on top of an existing v0.3.1 install brings the visual checkbox back to its intended behavior.

### Fixed
- **Checkboxes rendered as ticked by default.** A user reported that *every* task in the app appeared checked on first launch — both existing seed/persisted tasks and new tasks created via QuickAdd. Root cause was a structurally invalid CSS selector in `src/components/Checkbox.css`:
  ```css
  /* before */
  .check .check {
    color: var(--text-inverse);
    opacity: 0;
    transform: scale(0.5);
  }
  ```
  The `.check .check` selector means "a `.check` element nested inside another `.check` element" — but the lucide `<Check className="check" />` icon renders as a flat `<svg>` with no descendants, so the rule never matched any element. The `opacity: 0` declaration never fired, so the check icon was rendered at the lucide default `opacity: 1` for every checkbox — checked or unchecked — with `strokeWidth={3}` making the tick bold enough to read as "done" against the empty square. Replaced the dead selector with the descendant form `.checkbox .check` (a `.check` icon inside any checkbox button) that actually matches; the override rule `.checkbox.checked .check` continues to win via specificity and pops the icon back to opacity 1 / scale 1 when the box is checked. Transition was moved into the default rule so the unchecked → checked pop is animated either direction.

### Notes
- Purely visual; no state, no schema, no Rust compilation difference. Re-running the installer over a v0.3.1 install replaces `app.stride.desktop.exe` only — `state.json` is preserved unchanged.
- Published as `Stride_0.3.2_x64-setup.exe` and `Stride_0.3.2_x64_en-US.msi`.

## [0.3.1] — 2026-07-04

A focused patch release that closes the Comments slot in the right rail that v0.3.0 reserved with placeholder copy. The rail now hosts a real, working Comments feature: a tiny embedded thread on each task, edit / delete affordances per comment, and a Ctrl + Enter submit hotkey that learns from the empty-state coaching the rest of the app uses.

### Added
- **`Comment` type and `comments?: Comment[]` on `Task`.** `Comment = { id, body, createdAt }`. `comments` is optional, so `state.json` from any prior v0.x install loads unchanged — simply renders zero comments until at least one is posted.
- **Three new store actions** on the existing Zustand store: `addComment(taskId, body)` (trims input, no-ops on empty, ISO timestamp), `updateComment(taskId, cid, { body })` (also trims), `deleteComment(taskId, cid)`. All three update only the affected task, so unchanged tasks don't re-key on comments edition and reactivity stays surgical.
- **Comments rail section.** Replaces the v0.3.0 placeholder copy. Each comment renders as a soft-tinted card with the relative-from-now timestamp in the top-left (via the existing `formatRelativeFrom()` helper, with the absolute timestamp as a tooltip), and per-comment edit + delete affordances in the top-right (revealed on hover, force-shown via `:focus-within` for keyboard discoverability). Edit mode swaps the body for a textarea + Cancel/Save footer; Cancel simply closes the form, Save trims and re-binds. Submit uses either an explicit "Comment" button or `Ctrl/Cmd + Enter` (matches the pattern already used in the project / label editors).
- **Inline kbd hint** under each new-comment textarea: `[Ctrl] + [Enter]` rendered as real `<kbd>` chips with a `+` separator, matching the .kbd treatment used throughout Settings → Keyboard and the EmptyState hints.
- **`<Pencil />` icon added to the lucide-react import list** for the per-comment edit affordance.

### Schema
- `Task` interface gained `comments?: Comment[]`. Purely additive (optional field) → existing `state.json` files load and render cleanly.

### Notes
- This release is published as `Stride_0.3.1_x64-setup.exe` and `Stride_0.3.1_x64_en-US.msi`. Re-running the installer over an existing v0.3.0 install performs an in-place upgrade; existing tasks, projects, labels, theme, settings, and prior emoji markers are preserved. New `comments` field round-trips through the persisted state.

## [0.3.0] — 2026-07-04

A focused identity-lift release, shaped by the most concrete pieces of user feedback collected after 0.2.x shipped: the sidebar feels inert, the task rows all look the same, and the task detail modal looks like a form rather than a workspace. Three Tier-S moves land together, each chosen for a disproportionate identity/feel return at low scope risk.

### Added
- **Today widget at the top of the sidebar.** A compact, always-visible card that sits between the search trigger and the views nav (and only renders when the sidebar is expanded). Left half: a big-numeral pair *done / total* in tabular nums, with a small "today" caption beneath. Right half: a 7-bar sparkline, one bar per day for the past week; today's bar uses `--accent` at full opacity, the rest ramp by completion count. Click anywhere on the card → jump directly to the Today view. `role="button"`, `aria-label="View today's tasks — N of M done"`. Bar heights use a square-root curve so a sparse week still shows visible bars but a busy day still dominates.
- **Right rail in TaskDetail.** The task detail modal is now a true two-column workspace instead of a single-column form. The header ("Task" / close) and the footer (due-date pill / Delete) span both columns. The main column keeps the title row, description, and meta rows (priority / due date / project / labels / recurrence). A new 240px right rail hosts:
  - **Sub-tasks** (moved out of the main column so the description has more visual breathing room; same behavior and same `:focus-visible` ring treatment as before).
  - **Activity** (new): a compact list of three lifecycle beats — *Created* (relative-from-now), *Completed* (only when the task is done, with the absolute timestamp as a tooltip), and *Updated now*. Uses a new `formatRelativeFrom()` helper in `src/utils/dates.ts` that scales gracefully from "just now" through "5m ago" / "3h ago" / "Mon" / "Aug 5" / "Aug 5, 2025" and falls back to "in 5m" / "in 3h" for future timestamps.
  - **Comments** placeholder: a real slot with copy "Comments land here in v0.4. For now, drop notes into the description." — the rail's third column is reserved for the next release, not a TODO.
- **Project marker: color dot + optional emoji tile.** Every project now carries an optional single emoji from a curated 18-emoji library (🚀 🎯 📚 💼 🏠 🎨 💪 ✨ 🔥 🌱 💡 🎵 🛠️ 📝 📅 📦 🌐 🧠, plus a "no marker" tile for projects that prefer a classic color dot). The new `<ProjectMarker />` component renders a small 16px colored tile (per-color soft tint background, emoji centered on a platform-native color-emoji font stack) when an emoji is set, or falls back to a 6px `<ColorDot />` so existing projects render identically. The picker is `role="radiogroup"` so it reads correctly to screen readers. Picked emojis render on Windows (Segoe UI Emoji), macOS (Apple Color Emoji), and Linux (Noto Color Emoji) identically.

### Schema
- `Project` interface gained `emoji?: string` (single emoji, optional, defaults to empty). Existing `state.json` files load unchanged — `emoji` is read with a graceful fallback to the previous plain color-dot render. New projects created from the updated ProjectEditor round-trip the emoji through `createProject()` → serialized state → re-hydration cleanly.

### Changed
- **TaskDetail card widened** from 560px → 740px to host the rail without crowding the main column. Below 640px viewport, the rail collapses under the main column with a top hairline divider (preserved mobile readability).
- **ProjectEditor's subtitle copy** updated from "Color it, name it, then drop tasks in." to "Pick a marker, color it, name it — then drop tasks in." so the new picker is discoverable from the open flow.
- **`createProject()` now accepts an optional `emoji` field** alongside `name` and `color`. Pre-existing call sites are type-safe.

### Notes
- This release is published as `Stride_0.3.0_x64-setup.exe` and `Stride_0.3.0_x64_en-US.msi`. Re-running the installer over an existing 0.2.x install performs an in-place upgrade; existing tasks, projects, labels, theme, settings, and `state.json` are preserved. Pre-v0.3.0 projects re-render with a plain color dot (no emoji), since their persisted state never had an `emoji` field.

## [0.2.3] — 2026-07-03

A pure polish pass. No new features, no schema bump. Every interaction now shares the same motion rhythm, the same focus-visible treatment, the same kbd-chip typography, and the Settings modal renders without layout overflow.

### Fixed
- **Settings → "Lists & sorting" layout bug.** The "Default sort" row previously rendered four sort modes as a cramped 2×2 grid. Inside the 446px pane, `.settings-row`'s `1fr auto` columns left only ~72px for `Default / sort` plus its wrapped description, while the sort grid's `min(360px, 100%)` column forced every card's hint text to overflow its border (e.g. *Smart* bled into the Due-date column, *Alphabetical* was cut mid-word at *Predictable ta[s]*). Replaced the grid with a vertical radio-list picker — each sort mode now gets the full pane width, hints fit on one line, and the row's label/description no longer wrap word-by-word.

### Improved
- **Active indicator treatment.** Removed the banned `border-left: >1px` colored accent stripe (a known anti-pattern for "selected" state). All active affordances now use a *full* `border` + accent-soft background + filled inner mark + (where appropriate) a trailing `<Check>` icon. The Settings rail active item, the segmented control active item, **and** the new sort picker row all consistently read as "on" without relying on a single thin colored bar.
- **Real radio semantics on the sort picker.** `role="radiogroup"` + each row `role="radio"` + `aria-checked`. Arrow keys can switch in future iterations; for now the rows are buttons with proper a11y.
- **Keyboard list.** Every shortcut inside the Settings → Keyboard view is a real `<kbd>` chip with a `+` separator (was plain text with ` · `). Hovering the row brightens the chips so the relevant shortcut stands out.
- **EmptyState coaching.** "Press `Ctrl N` to add a task · `Ctrl ,` for settings" now renders as real `<kbd>` chips with proper `+` separators, not as plain-text gibberish. The hint is a `React.ReactNode` so future shortcuts can render real keys.

### Accessibility
- **`:focus-visible` rings everywhere.** Every interactive element in Settings, TaskDetail, CommandPalette, EmptyState, and the Header icon-btn now shows a true outline focus ring on keyboard navigation. Mouse clicks no longer trigger a ring; Tab navigation always does.
- **`:focus-within` on grouped inputs.** The command palette search bar now lights up its entire boundary when its child input is focused, not just the input itself.
- **Discoverable delete buttons.** TaskDetail's per-subtask delete (`.subtask-del`) and per-label remove (`.label-chip-inline .remove-label`) now force `opacity: 1` on focus so keyboard users don't need to mouse-hover to find them.
- **Contrast-safe active labels.** The active picker row used to tint the *label text* with `--accent-hover` sitting on `--accent-soft` over `--bg`. On the light theme that combination read poorly under 4.5:1. Reverted the label to `--text` + bumped weight; the visual "active" signal is already carried by the border, radio dot, and trailing check.

### Typography & rhythm
- **`text-wrap: pretty`** adopted across long-form descriptions and hint copy (Settings hints, TaskDetail description/body copy, CommandPalette item titles, EmptyState body). Wraps now break on word boundaries instead of mid-word.
- **`text-wrap: balance`** on section titles and the EmptyState title only — keeps narrow headlines from orphaning a single word on line two.
- **Color harmonization of section hints.** Settings → Appearance / Behavior / Data / etc hints moved from `--text-muted` to `--text-subtle` for guaranteed ≥4.5:1 contrast on every active theme.

### Motion
- **App-wide 140ms transition standard.** Every hover/state-change transition (background, border, color, opacity, transform where spatial) is now 140ms `ease` or `ease-out`. Previously the codebase mixed 100/120/140/160ms. One-shot entry/exit animations (`fade-in`, `slide-in-right`, `pop-in`, `fade-up`) keep their own durations.
- **Settings section entrance.** Switching sections in the left rail triggers a 220ms `cubic-bezier(0.2, 0.7, 0.2, 1)` `fade-up` (4px translate-Y → 0, 0 → 1). The animation is visibility-gating safe — content is fully present without animation, so users with `prefers-reduced-motion` see the same content instantly with no movement.
- **Modal sort popover** now lifts to 140ms like everything else.

### Refactor
- **`.kbd` chip class added to `globals.css`.** One canonical chip rule (`--surface-elevated` bg, `--hairline-strong` border, `font-feature-settings: "calt" 0`, `user-select: none`, 140ms hover). The Settings keyboard list (`.settings-kbd`) and the Header inline keys (`kbd.kbd-inline`) continue to render their component-specific variants; the new `.kbd` is the baseline used by `.EmptyState` and `.CommandPalette` foot.
- **EmptyState's `hint` field widened** from `{ text: string }` to `React.ReactNode`, with a tiny `<KbdGroup keys={[...]} />` helper to render `Ctrl + N` style clusters.

### Notes
- This release is published as `Stride_0.2.3_x64-setup.exe` and `Stride_0.2.3_x64_en-US.msi`. Re-running the installer over an existing `0.2.x` install performs an in-place upgrade; existing tasks, projects, labels, theme, and the v2-schema settings from `0.2.2` are preserved unchanged.

## [0.2.2] — 2026-07-03

### Added
- **Settings modal.** New full-screen settings panel with six sections: Appearance (theme + accent intensity), Lists & sorting (default sort mode + week starts on), Behavior (delete confirmation toggle), Data (storage path readout, double-tap "Reset all data" with 6s disarm), Keyboard (every shortcut documented live), and About. Opened from the top-right header (now a real ⚙ Settings trigger, replaced the dead `…`), from `Ctrl/Cmd ,`, or via `Ctrl/Cmd K → "Open settings…"`. Settings persist across launches.
- **Functional Sort button.** The previously dead sort icon in the header now opens an anchored popover with four persistent modes: *Smart* (default — manual order then soonest due), *Due date* (grouped by overdue / today / upcoming), *Alphabetical*, and *Manual*. The chosen mode is stored in settings and survives restarts. Workflow: `TaskList` now reads `sortMode` from settings rather than a hardcoded constant. Outside clicks, `Esc` (isolated via `stopImmediatePropagation` + `preventDefault` so it doesn't double-fire ModalRoot's own Esc listener), and arrow-key widget focus are all handled.
- **Shared hook library under `src/hooks/`.** `useBodyScrollLock(active)` (module-level ref-count: first lock saves `body.style.overflow`, last unlock restores it) and `useEscapeToClose(active, onClose)` (`stopImmediatePropagation` + ref-pattern onClose) so Settings, ModalRoot, and TaskDetail don't drift. Replaces the per-modal effect duplicates that previously could leave `body.style.overflow === "hidden"` forever after a modal close.
- **Reset all data** is a real double-tap confirmation, not a `confirm()` dialog. First click arms the button (label flips to "Click again to confirm", autofocuses it). If you don't tap again within 6 seconds, the arm silently disarms.
- **Command palette entries.** New "Open settings…" and four sort-mode entries (`Sort: Smart`, `Sort: Due date`, `Sort: Alphabetical`, `Sort: Manual`) made discoverable from the palette.
- **Empty state coaching.** The empty Inbox / empty project / empty completed views now surface "Press `Ctrl N` to add a task · `Ctrl ,` for settings" so available shortcuts are obvious from the first launch.
- **Keyboard chip on the Settings trigger** in the header (`Ctrl/Cmd ,`) so the button has a discoverable affordance instead of being an opaque icon.

### Fixed
- **Dead `…` button in the top-right of the header.** Replaced with a real Settings trigger. `aria-label="Settings"`, kbd chip shows the shortcut, click and `Ctrl/Cmd ,` both open the new modal.
- **Dead Sort button.** Replaced with a functional popover; the chosen mode now sticks. Default changed from a hidden constant to the user's selected `sortMode`.
- **Sort-mode menu wasn't accessible.** Items now use `role="menuitemradio"` + `aria-checked`; segmented controls in the settings modal are `role="radiogroup"` + each button `role="radio"` + `aria-checked` (correct ARIA for single-select groups, replacing the previously-misused `role="tablist"` / `role="tab"` / `aria-selected`).
- **Esc stopped at the wrong layer.** Pressing `Esc` while the sort popover was open used to also close the modal beneath it, because plain `stopPropagation` does *nothing* for separate `window` listeners — only `stopImmediatePropagation` does. Fixed.
- **Persistence migration.** Schema bumped `1 → 2`. Old installs are upgraded in-memory on launch (`settings ?? DEFAULT_SETTINGS`), so first launch on a v0.2.1 install won't crash or wipe tasks. New settings written thereafter are saved under the v2 schema.
- **Theme shortcut changed off `Ctrl/Cmd ,`.** `Ctrl/Cmd ,` now opens Settings (the conventional binding on every desktop OS). Theme moved to `Ctrl/Cmd Shift L`, also surfaced in the live keyboard list inside Settings.

### Polish
- `.modal-card` was capped at `440px`. Settings needs more real estate, so `ModalRoot` now applies `.modal-card.large` only when `modal.kind === "settings"`. Width uses `clamp(440px, 100%, 720px)` — collapses on narrow viewports instead of overflowing the `.modal-root` padding.
- SortPopover anchors under the button, repositions on resize / scroll, fades in (`pop-in` reuse). Active sort mode is rendered with both an accent border and a check icon (previously relied on a banned left-stripe anti-pattern).
- Kbd hint chip on the Settings trigger matches the existing pattern used for `Ctrl/Cmd K` elsewhere in the UI.
- `CommandPalette` sorted entries no longer duplicate view-switch actions that already have `g i` / `g t` / `g u` chord shortcuts.

### Notes
- This release is published as `Stride_0.2.2_x64-setup.exe` and `Stride_0.2.2_x64_en-US.msi`. Re-running the installer over an existing `0.2.x` install performs an in-place upgrade; existing tasks, projects, labels, theme, and *new settings* are preserved. Schema version bumps `1 → 2` and is migrated in-memory on first launch of a v1 install.

## [0.2.1] — 2026-07-03

### Fixed
- **Task Detail is now a true overlay modal.** Previously TaskDetail rendered as a side panel — `.app` switched its grid from 2-column to 3-column (`248px 1fr 380px`) when a task was opened, putting the editor alongside the task list. It now renders via React Portal into `document.body`, with a 6px blurred backdrop, z-index 9998, a 560px centered card, and proper `pop-in` entrance animation. The body's third column was removed because it is no longer needed.
- **Scroll-lock leak when stacking modals.** When TaskDetail and ModalRoot were both open, the second modal's body-scroll-lock captured `prev = "hidden"` (the first lock's value) and the second cleanup later *restored* `"hidden"`, leaving the page permanently scroll-locked after both closed. Replaced the per-effect `prev`-capture pattern in both modals with a ref-counted `useBodyScrollLock(active)` hook in `src/hooks/useBodyScrollLock.ts`: only the *first* lock saves the previous overflow, and only the *last* unlock restores it.
- **Esc key race on overlapping window listeners.** TaskDetail and ModalRoot both register `window keydown` listeners for Escape. `e.stopPropagation()` (used previously) does *nothing* for two separate listeners on `window` — only `stopImmediatePropagation()` does. Pressing Esc inside a modal used to also close the command palette unexpectedly. Replaced with a shared `useEscapeToClose(active, onClose)` hook that uses `stopImmediatePropagation()` correctly.
- **Focus on task open.** When a task is now opened, the contentEditable title is auto-focused with the caret placed at the end. Users can start typing the new title immediately without an extra click.
- **`useEffect` cleanup on modal close correctly restores body scroll** even when the modal is unmounted via the server-side persistence cycle.

### Refactored
- `src/components/ModalRoot.tsx` and `src/components/TaskDetail.tsx` now share `useBodyScrollLock` and `useEscapeToClose` from `src/hooks/`. No more per-component duplication of the same effects.
- `src/App.tsx` no longer needs the `data-detail` attribute or `layoutKey` (which only existed to force-remount `area-main` when the detail panel toggled).

### Notes
- This release is published as `Stride_0.2.1_x64-setup.exe` and `Stride_0.2.1_x64_en-US.msi`. Re-running the installer over an existing 0.2.0 install performs an in-place upgrade; existing tasks, projects, labels, and theme preferences are preserved.

## [0.2.0] — 2026-07-03

### Fixed
- **Modal layering.** Project / label editors now render via a React Portal into `document.body` so they always sit on top of the interface regardless of any ancestor stacking context. Modal z-index bumped from 200 → 9999, deeper compound shadow, 6px backdrop blur, body scroll-lock while open, and force-receive backdrop clicks.
- **Single-letter text truncation in task rows.** A sneaky CSS Grid bug: `TaskRow.css` declared exactly 4 columns (18 / 18 / 10 / 1fr), but the priority `<ColorDot />` was rendered conditionally. When the priority dot was absent (completed tasks, or any task without a priority), `.task-row-body` collapsed into the 10-pixel slot and crushed the title down to a single glyph. Fixed by unconditionally reserving the third grid cell with an `aria-hidden` placeholder when the dot isn't drawn.

### Improved
- **Search trigger in the sidebar.** "Search" placeholder no longer clips, and the `Ctrl K` shortcut pill stays visible at all sidebar widths. `min-width: 0` chain added; kbd has `flex-shrink: 0`.
- **Task row meta chips.** Project / label chips now render on a single line — `white-space: nowrap; flex-shrink: 0` prevents character-by-character wrapping on narrow windows.
- **Task descriptions.** Single-line `…` ellipsis instead of mid-character cuts. Removed the redundant JS-side `truncate()` that was producing a double ellipsis.
- **Quick-add input.** The keyboard hint (`↩ to add`) gracefully fades out when you start typing; the placeholder stays legible.
- **Modal:** cleaner entrance animation (reuses the global `fade-in` keyframe), stronger shadow lift, polished close button.
- **Empty states.** Refined radial-gradient icon backdrop; "Ctrl N to add a task" hint chip on the empty Inbox / empty project views.
- **Detail panel.** X-button on each label chip so you can untag a task without opening the popover; smoother popover scale-in; better meta-row hover with sliding caret.
- **Density & rhythm.** Sidebar 244px → 56px collapsed, header 54px, tighter day-group headings, refined typography hierarchy with Inter Tight.
- **Accessibility.** Focus rings now keyboard-only (`:focus-visible`); `prefers-reduced-motion` blanket-disables non-essential motion respect for OS-level reduced-motion preference.

### Changed
- Layout: removed redundant `.app` background-image gradient (children render their own surfaces; one less paint).
- Removed dead CSS rule `.tasklist-day-label.overdue` (TSX never applied an `overdue` className).
- Removed dead `icon?` field on EmptyState's `describe()` return type (TSX never rendered it).
- `.area-header` transparent bottom border removed (it's not visible).
- React-namespace reliance on `EmptyState.tsx` `icon?` field retired in favour of plain `text` strings.

### Notes
- This release is published as `Stride_0.2.0_x64-setup.exe` and `Stride_0.2.0_x64_en-US.msi`. Re-running the installer over an existing 0.1.x install performs an in-place upgrade while preserving `%APPDATA%\app.stride.desktop\state.json`.

## [0.1.0]

Initial release. Stride is a minimalist, beautiful todo & project management desktop app for Windows, based on Tauri 2 + React 18 + TypeScript + Vite.

### Added
- Tauri 2 + React 18 + TypeScript + Vite scaffolding. Rust backend exposes a tiny CRUD surface (`load_state`, `save_state`) with atomic write to `%APPDATA%\app.stride.desktop\state.json` and a `localStorage` fallback for portable/dev runs.
- Multi-project sidebar with smart counts (Inbox, Today, Upcoming, All, Completed, plus per-project and per-label lists).
- Full task CRUD: create, edit (double-click row), complete, delete; per-task sub-tasks; per-task labels with color dots; per-project assignment; recurring rules (daily / weekly / monthly) with dedup-by-`parentRecurrenceId`; priorities (1–4) shown as colored dots only — "show, don't tell".
- Quick add (Ctrl/Cmd N) with natural-language date parsing (`tomorrow`, `next friday`, `in 3 days`, `Jul 10`) and `@label` and `+project` and `!1..!4` priority tokens. Live preview chips show inferred project, labels, priority, date.
- Drag-and-drop reorder using `@dnd-kit/sortable`. Drag a task to a different project sidebar entry to move it across projects. Multi-scope reorder math (per-project and per-day groups).
- Command palette (Ctrl/Cmd K) — fuzzy match across tasks, projects, labels, views, and ~10 utility actions (toggle theme, new project, new label, etc.).
- Keyboard shortcuts — Ctrl/Cmd K, Ctrl/Cmd B, Ctrl/Cmd N, Ctrl/Cmd comma, plus Vim-style chord shortcuts (`g i`, `g t`, `g u`, `g a`, `g c`) for view navigation; Esc closes palette + modal + detail.
- Right-side detail panel with inline title editing, description textarea, project picker popover, label picker popover, date picker popover (presets + manual `YYYY-MM-DD`), recurrence picker popover, priority picker, sub-task editor, delete.
- Light / dark themes via CSS custom properties.
- Show-don't-tell color philosophy: priorities and projects/labeled items use color dots and rhythm, never text labels like "P1: Urgent".
- Persisted view, theme, sidebar collapsed state, last-opened task detail.
- Seed data on first launch so the app never feels empty: a "Welcome to Stride" task with a discover-the-shortcuts description, three starter projects (Personal / Work / Side projects), four labels (Urgent / Reading / Errand / Someday), a Today task and an Upcoming task.

### Fixed
- Day-group reorder did not regress group boundaries.
- Recurring-task completion no longer spawns duplicate occurrences when an instance is toggled multiple times (deduped via `parentRecurrenceId`).
- Quick-add was previously rendered twice in the layout — collapsed to a single instance.
- Tauri capability requested `create-webview-window` without needing it; tightened to `core:default` + `dialog:default`.
