# Superwhisper-Inspired UI Redesign

## Context

Our settings window and overlay currently work but feel utilitarian compared to Superwhisper's polished, macOS-native aesthetic. This plan uses four Superwhisper screenshots as visual reference to guide a redesign that makes our app feel cleaner, more spacious, and more premium.

**Reference screenshots:** `Screenshot 2026-02-24 at 17.32.06/14/19/26.png`

---

## Design Principles (from reference)

1. **Spacious grouped cards** — Settings are grouped into visually distinct rounded cards with subtle borders, not inline fields
2. **Label-left, control-right** — Toggle rows use a full-width row: label on the left, switch/control on the right
3. **Colored sidebar icons** — Each nav item gets its own accent color, not just a blue highlight on the active item
4. **Top status bar** — A persistent bar showing current microphone and status indicator
5. **Consistent section headers** — Thin uppercase headers above each card group, with generous vertical spacing
6. **Recording overlay toolbar** — Compact bottom bar with labeled actions and keyboard shortcut badges

---

## Changes

### 1. Sidebar: Colored icons + branding footer

**File:** `src/components/sidebar.tsx`

Current: All icons are gray (inactive) or white (active, on blue background). No branding.

Update:
- Give each nav item a distinct icon background color (small rounded square behind the icon, like Superwhisper):
  - General → orange/red
  - Models → blue
  - Hotkeys → gray
  - About → purple
- The icon backgrounds are always visible (not just when active)
- Active nav item: subtle highlight on the row (`bg-white/10` in dark, `bg-black/5` in light) with white text — NOT the current solid blue pill
- Add an app name + version footer pinned to the bottom of the sidebar: `"Text to Code"` with a subtle `v0.1.0` badge

### 2. Top status bar: Microphone indicator

**File:** `src/App.tsx` (MainWindow) + new `src/components/status-bar.tsx`

Current: No top bar. The microphone selector is buried inside General settings.

Add a thin status bar at the top of the main content area (not a separate window):
- Height: ~36px
- Right-aligned: current microphone name + green/gray status dot
- Left-aligned: a small layout toggle icon (placeholder for future use)
- Background: transparent, with a subtle bottom border
- The microphone name is read from preferences (reuse `usePreferences` hook)

### 3. Settings card groups

**Files:** `src/components/panels/general-panel.tsx`, `src/components/panels/hotkeys-panel.tsx`

Current: Sections use a heading + flat controls layout with no visual grouping.

Introduce a `<SettingsGroup>` wrapper component (`src/components/settings-group.tsx`):
```
┌──────────────────────────────────────────┐
│  SECTION HEADER (uppercase, small, gray) │
│ ┌──────────────────────────────────────┐ │
│ │  Row: Label ................. Control │ │
│ │──────────────────────────────────────│ │
│ │  Row: Label ................. Control │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

- Outer container: just the section header text
- Inner card: `rounded-xl bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a]`
- Rows separated by a 1px horizontal divider inside the card
- Each row: `px-4 py-3 flex items-center justify-between`

Also create a `<SettingsRow>` component for the label-left, control-right pattern.

### 4. General panel: Reorganize into card groups

**File:** `src/components/panels/general-panel.tsx`

Reorganize the existing sections into grouped cards following Superwhisper's layout:

**Card 1 — "Model"**
- Active Model selector (dropdown)

**Card 2 — "Recording"**
- Recording Mode (Toggle / Push to Talk) — row with dropdown or segmented control
- Recording Hotkey — row with HotkeyRecorder on the right
- Target Window — row with dropdown

**Card 3 — "Input"**
- Microphone — row with dropdown (keep the main selector here, status bar just mirrors it)
- Text Injection Method — row with value label

**Card 4 — "Appearance"**
- Visualization — the 3-column grid picker (keep as-is, inside a card)
- Processing Animation — the 3-column grid picker (keep as-is, inside a card)

Remove the standalone `<h1>` page title — the sidebar already tells you which page you're on. Replace with lighter spacing.

### 5. Hotkeys panel: Card-based shortcut rows

**File:** `src/components/panels/hotkeys-panel.tsx`

Current: Flat list of hotkey bindings.

Reorganize into a single card group:

**Card — "Keyboard Shortcuts"**
- Each row: Action name + description on the left, hotkey recorder + toggle switch on the right
- Match the Superwhisper pattern where each shortcut is its own row with a thin divider
- Show the shortcut key in a `kbd`-styled badge (rounded, subtle background)

### 6. About panel: Match Superwhisper's bottom branding style

**File:** `src/components/panels/about-panel.tsx`

Current: Centered icon + text.

Update to match Superwhisper's feel:
- Keep the centered layout but make it feel more intentional
- Add links: "Check for Updates..." button and "Launch on Login" toggle (move from General if appropriate)
- Application section as a card group:
  - Row: "Version" → "0.1.0"
  - Row: "Check for Updates" → button
  - Row: "Launch at Login" → toggle

### 7. Recording overlay: Bottom toolbar with action badges

**File:** `src/components/recording-pill.tsx`

Current: Stacked layout — visualization on top, status dot + text below.

Redesign to match Superwhisper's overlay (Screenshot 17.32.26):
- Wider, shorter aspect ratio
- Visualization takes most of the height
- Bottom toolbar row with:
  - Left: microphone icon + "Default" (or device name)
  - Right: "Stop" label + hotkey badge (`Space`), "Cancel" label + hotkey badge (`esc`)
- Remove the colored dot indicator — the action labels convey state
- Toolbar background: slightly lighter than the main overlay body, or separated by a thin border

This also requires updating the overlay window size in the Tauri config:
- **File:** `src-tauri/tauri.conf.json` — change recording-overlay from 340×180 to ~480×120

### 8. Global CSS polish

**File:** `src/index.css`

Add utility styles:
- `.kbd` class for keyboard shortcut badges: `inline-flex items-center px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono`
- Smoother scrollbar styling for the main content area (WebKit)
- Subtle selection highlight color matching the blue accent

---

## New Files

| File | Purpose |
|------|---------|
| `src/components/settings-group.tsx` | Reusable card wrapper with section header + divider rows |
| `src/components/status-bar.tsx` | Top bar showing microphone status |

## Modified Files

| File | Changes |
|------|---------|
| `src/components/sidebar.tsx` | Colored icon backgrounds, active style, branding footer |
| `src/App.tsx` | Insert StatusBar above main content |
| `src/components/panels/general-panel.tsx` | Reorganize into SettingsGroup cards |
| `src/components/panels/hotkeys-panel.tsx` | Card-based shortcut rows |
| `src/components/panels/about-panel.tsx` | App info card with version/update/login rows |
| `src/components/recording-pill.tsx` | Bottom toolbar layout |
| `src/components/recording-pill.test.tsx` | Update tests for new toolbar structure |
| `src/index.css` | Add `.kbd`, scrollbar, and selection styles |
| `src-tauri/tauri.conf.json` | Update overlay window dimensions |

## Not Changing

- Visualization canvas components (bars, sine, rainbow) — already working well
- Processing animation components — recently added, no changes needed
- Backend Rust code — purely a frontend visual change
- Model card component — recently updated with company badges, looks good
- Type definitions — no new types needed

## Task List

### Phase 1: Foundation (shared components + global styles)

- [ ] **1.1** Add global CSS utilities to `src/index.css`
  - `.kbd` badge class, WebKit scrollbar styling, selection highlight color
- [ ] **1.2** Create `src/components/settings-group.tsx`
  - `<SettingsGroup title="">` wrapper: section header + rounded card container
  - `<SettingsRow label="" description="">` child: label-left, control-right row with auto-dividers
- [ ] **1.3** Create `src/components/status-bar.tsx`
  - Thin top bar (~36px) showing current microphone name + status dot
  - Reads from `usePreferences` hook

### Phase 2: Sidebar redesign

- [ ] **2.1** Update sidebar nav items with colored icon backgrounds
  - General → orange/red, Models → blue, Hotkeys → gray, About → purple
  - Small rounded square behind each icon, always visible
- [ ] **2.2** Change active nav item style
  - Replace solid blue pill with subtle highlight (`bg-white/10` dark, `bg-black/5` light)
- [ ] **2.3** Add branding footer to sidebar
  - "Text to Code" app name + `v0.1.0` badge pinned to bottom

### Phase 3: Settings panels reorganization

- [ ] **3.1** Refactor General panel into card groups
  - Card 1 "Model": Active Model selector
  - Card 2 "Recording": Recording Mode, Hotkey, Target Window
  - Card 3 "Input": Microphone, Text Injection Method
  - Card 4 "Appearance": Visualization picker, Processing Animation picker
  - Remove standalone `<h1>` page title
- [ ] **3.2** Refactor Hotkeys panel into card-based rows
  - Single "Keyboard Shortcuts" card group
  - Each row: action name + description left, hotkey recorder + toggle right
  - Shortcut keys displayed in `kbd`-styled badges
- [ ] **3.3** Refactor About panel into card layout
  - App icon + name header (keep centered)
  - "Application" card: Version row, Check for Updates row, Launch at Login toggle row

### Phase 4: Wire status bar into main layout

- [ ] **4.1** Update `src/App.tsx` MainWindow
  - Insert `<StatusBar />` between sidebar and scrollable content
  - Adjust layout so status bar sits at top of the content column

### Phase 5: Recording overlay redesign

- [ ] **5.1** Redesign `recording-pill.tsx` to toolbar layout
  - Wider, shorter aspect ratio
  - Visualization fills top area
  - Bottom toolbar: mic icon + device name (left), Stop + `Space` badge, Cancel + `esc` badge (right)
  - Remove colored status dot
- [ ] **5.2** Update overlay window dimensions in `src-tauri/tauri.conf.json`
  - Change recording-overlay from 340×180 to ~480×120
- [ ] **5.3** Update `recording-pill.test.tsx` for new structure
  - Adjust selectors/assertions for toolbar layout
  - Add tests for new action labels and hotkey badges

### Phase 6: Verification

- [ ] **6.1** `npx tsc --noEmit` — TypeScript compiles cleanly
- [ ] **6.2** `pnpm test --run` — all tests pass
- [ ] **6.3** `cargo check --manifest-path src-tauri/Cargo.toml` — Rust compiles
- [ ] **6.4** Manual visual review of each panel against reference screenshots
