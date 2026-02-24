# Recording Overlay Pill — Vertical Layout, Bigger, Draggable, Processing Animations

## Context

The previous round of work added three visualization styles and a bigger pill, but two issues remain:
1. When transitioning from recording to processing, the visualization's slow amplitude decay still looks like an active animation — confusing the user about the current state.
2. The pill uses a horizontal layout (dot + viz + label in a row) and the user wants the visualization **above** the label.
3. The pill needs to be **much bigger** than the current 160×36 viz area.
4. The pill is locked to one of 4 preset positions and is completely click-through. The user wants to **freely drag it** to any screen position.

## Approach

### 1. Vertical layout + much bigger pill

Restructure `RecordingPill` from horizontal flex to vertical flex-col:
- **Top**: visualization area (240×56)
- **Bottom**: status row (dot + label)
- Shape: `rounded-2xl` (vertical layout doesn't work as `rounded-full`)
- Text: `text-base` (up from `text-sm`)

### 2. Two modular processing animation modes

Extensible registry (mirrors the visualization registry pattern). When recording stops, the live viz is replaced:

| Mode | Name | Behavior |
|------|------|----------|
| `Pulse` | Pulse Glow | CSS pulsing/breathing glow div replaces the canvas |
| `FrozenFrame` | Frozen Frame | Canvas freezes at last drawn state (no decay), slight opacity reduction |

Add `paused` prop to all visualization components. When `paused=true`, stop interpolating amplitudes — canvas stays frozen.

RecordingPill captures `lastAmplitudesRef` during recording so FrozenFrame has data to freeze on.

### 3. Draggable pill

- Remove `set_ignore_cursor_events(true)` from `lib.rs` — on macOS with `transparent: true`, transparent areas naturally pass through clicks, so only the visible pill intercepts mouse events.
- Keep `focusable: false` so the window never steals keyboard focus.
- On mousedown, call `getCurrentWindow().startDragging()` (Tauri v2 native drag API).
- Listen for `onMoved` event (debounced 500ms) to save position to preferences.
- Add `overlayCustomPosition: { x, y } | null` to preferences. On startup, use custom position if set, else fall back to `OverlayPosition` enum.

### 4. Bigger overlay window

Update window from 380×90 to **340×180** to accommodate the vertical pill layout.

## Implementation Steps

### Step 1: Add new types to preferences

**`src-tauri/src/preferences/mod.rs`**:
- Add `ProcessingAnimation` enum (`Pulse`, `FrozenFrame`) with `Default` impl → `Pulse`
- Add `OverlayCustomPosition` struct (`x: f64`, `y: f64`) with `#[serde(rename_all = "camelCase")]`
- Add to `UserPreferences`:
  - `overlay_processing_animation: ProcessingAnimation` with `#[serde(default)]`
  - `overlay_custom_position: Option<OverlayCustomPosition>` with `#[serde(default)]`

**`src/types/index.ts`**:
- Add `ProcessingAnimation = "Pulse" | "FrozenFrame"`
- Add `OverlayCustomPosition { x: number; y: number }`
- Add both fields to `UserPreferences` interface

### Step 2: Update overlay window size

**`src-tauri/tauri.conf.json`**: Change recording-overlay to `width: 340, height: 180`

**`src-tauri/src/lib.rs`**: Update constants to `overlay_width = 340.0, overlay_height = 180.0`

### Step 3: Make overlay draggable + custom position

**`src-tauri/src/lib.rs`**:
- Remove `let _ = overlay.set_ignore_cursor_events(true);`
- Extract `overlay_custom_position` from prefs before moving into `AppState`
- If `overlay_custom_position` is `Some`, use it for positioning; else fall back to enum calculation

**`src-tauri/capabilities/default.json`**:
- Add `"core:window:allow-start-dragging"` to permissions array

**`src/pages/overlay.tsx`**:
- Import `getCurrentWindow` from `@tauri-apps/api/window`
- Add `handleMouseDown` that calls `getCurrentWindow().startDragging()`
- Wrap `RecordingPill` in a div with `onMouseDown={handleMouseDown}` and `cursor-grab`/`cursor-grabbing`
- Listen for `onMoved` event with 500ms debounce, save `{ x, y }` to preferences via `update_preferences`
- Fetch `processingAnimation` preference alongside `visualization`

### Step 4: Add `paused` prop to visualization components

**`src/components/visualizations/index.ts`**:
- Add `paused?: boolean` to `VisualizationProps`

**`src/components/visualizations/bars.tsx`**:
- Accept `paused` prop, track in `pausedRef`
- When `pausedRef.current` is true: skip amplitude interpolation in `draw()`, canvas stays frozen
- When `paused` is true: don't update `targetAmplitudes` from new `amplitudes` prop

**`src/components/visualizations/sine.tsx`**:
- Same pattern: when paused, stop advancing `timeRef.current` and stop interpolating `currentRms`

**`src/components/visualizations/rainbow.tsx`**:
- Same pattern as bars: skip interpolation when paused

### Step 5: Create processing animation components

**`src/components/processing-animations/pulse.tsx`** (NEW):
- Simple component: renders a div with `animate-pulse-glow` CSS class at the given `width × height`
- Subtle breathing glow with blue tones

**`src/components/processing-animations/frozen-frame.tsx`** (NEW):
- Renders the selected visualization component with `paused={true}` and `opacity: 0.5`
- Props: `width, height, visualization, lastAmplitudes`

**`src/components/processing-animations/index.ts`** (NEW):
- Registry: `PROCESSING_ANIMATIONS` record keyed by `ProcessingAnimation`
- Each entry: `{ name: string; description: string }`

**`src/index.css`**:
- Add `@keyframes pulse-glow` animation and `.animate-pulse-glow` class

### Step 6: Rewrite RecordingPill — vertical layout + processing modes

**`src/components/recording-pill.tsx`**:
- Layout: `flex flex-col items-center` with `rounded-2xl`
- Viz dimensions: `VIZ_WIDTH = 240, VIZ_HEIGHT = 56`
- New props: `processingAnimation?: ProcessingAnimation`
- `lastAmplitudesRef` captures amplitudes while recording
- `renderVisualization()`:
  - Recording → live `VizComponent` with real amplitudes
  - Processing + Pulse → `PulseAnimation`
  - Processing + FrozenFrame → `FrozenFrameAnimation` with `lastAmplitudesRef.current`
- Status row below: dot (w-3 h-3) + label (`text-base`)

### Step 7: Add processing animation picker to General panel

**`src/components/panels/general-panel.tsx`**:
- Add "Processing Animation" section after the Visualization section
- `ProcessingAnimationPicker` component: 2-column grid of selectable cards
- Each card shows name + description, blue border when active
- Updates `overlayProcessingAnimation` in preferences on click

### Step 8: Update tests

**`src/components/recording-pill.test.tsx`**:
- Update `rounded-full` → `rounded-2xl` assertions
- Add `flex-col` assertion
- Test Pulse mode: processing → no canvas, has `.animate-pulse-glow` div
- Test FrozenFrame mode: processing → canvas still present
- Update "keeps visualization area" test for new processing behavior

## Files Summary

| Action | File |
|--------|------|
| Edit | `src-tauri/src/preferences/mod.rs` — add `ProcessingAnimation`, `OverlayCustomPosition`, serde defaults |
| Edit | `src/types/index.ts` — add `ProcessingAnimation`, `OverlayCustomPosition`, update `UserPreferences` |
| Edit | `src-tauri/tauri.conf.json` — overlay 340×180 |
| Edit | `src-tauri/src/lib.rs` — remove click-through, update dims, custom position startup |
| Edit | `src-tauri/capabilities/default.json` — add `core:window:allow-start-dragging` |
| Edit | `src/pages/overlay.tsx` — drag handling, processing animation pref, debounced position save |
| Edit | `src/components/visualizations/index.ts` — add `paused` to `VisualizationProps` |
| Edit | `src/components/visualizations/bars.tsx` — support `paused` prop |
| Edit | `src/components/visualizations/sine.tsx` — support `paused` prop |
| Edit | `src/components/visualizations/rainbow.tsx` — support `paused` prop |
| Create | `src/components/processing-animations/pulse.tsx` |
| Create | `src/components/processing-animations/frozen-frame.tsx` |
| Create | `src/components/processing-animations/index.ts` |
| Edit | `src/index.css` — add `pulse-glow` keyframes |
| Edit | `src/components/recording-pill.tsx` — vertical layout, bigger, processing animation switching |
| Edit | `src/components/panels/general-panel.tsx` — processing animation picker |
| Edit | `src/components/recording-pill.test.tsx` — update for new layout + processing modes |

## Verification

1. `cargo check` — Rust compiles with new preference types
2. `npx tsc --noEmit` — no TypeScript errors
3. `pnpm test` — all tests pass
4. `pnpm tauri dev` — record voice:
   - Overlay pill appears in vertical layout, much bigger
   - Visualization animates above the "Recording" label
   - Stop recording → viz immediately switches to Pulse glow or Frozen Frame (no slow decay)
   - Pill can be dragged to any position on screen
   - Restart app → pill appears at last dragged position
5. Switch processing animation in General settings → test both Pulse and FrozenFrame
6. Switch visualization style → confirm it applies to overlay
