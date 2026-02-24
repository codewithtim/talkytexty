# Recording Overlay Pill — Bigger, Consistent Size, Multiple Visualizations

## Context

The recording overlay pill (the floating indicator during voice recording) is too small, shrinks when transitioning from recording to processing (because the soundwave disappears), and only has one visualization style. The user wants a bigger pill, consistent dimensions across states, and three selectable visualization styles with a visual preview picker in the General settings panel.

## Current State

- **RecordingPill** (`src/components/recording-pill.tsx`): pill-shaped container with status dot + optional soundwave + label. Soundwave only renders during recording, causing the pill to shrink during processing.
- **Soundwave** (`src/components/soundwave.tsx`): canvas-based, 32 bars, single color (#3b82f6), smooth interpolation via requestAnimationFrame. Used at width=120, height=28.
- **Overlay window** (`tauri.conf.json`): 300×80px, transparent, always-on-top, non-focusable.
- **Preferences** (Rust `UserPreferences`): has `overlay_position` and `overlay_opacity` but no visualization style field.

## Approach

### 1. Three visualization styles — extensible architecture

Create a `VisualizationStyle` type and a registry pattern so new styles can be added by creating a component and adding an entry.

| Style ID | Name | Description |
|---|---|---|
| `"bars"` | Classic Bars | Current 32-bar visualizer. Single color, variable opacity. |
| `"sine"` | Layered Waves | 3 overlapping flowing sine waves (blue, purple, pink), semi-transparent, reacting to amplitude with different frequencies/phases. |
| `"rainbow"` | Rainbow Bars | Same bar layout but each bar colored from a gradient spectrum (blue → purple → pink → orange). |

All three implement the same props interface: `{ amplitudes: number[]; width: number; height: number }`.

### 2. Consistent pill size

The soundwave area stays allocated in both recording and processing states. During processing, show a gentle pulsing/breathing animation in the same space instead of removing it.

### 3. Bigger pill + overlay window

Increase the soundwave area to **width=160, height=36**. Increase the overlay Tauri window to **380×90px** to accommodate the larger pill.

### 4. Preference storage

Add `overlay_visualization` field to `UserPreferences` on both Rust and TypeScript sides. Default: `"bars"`.

### 5. Settings UI — visual picker in General panel

Add a visualization style selector to the General panel with a **visual preview card** for each option. Each card shows a small live-ish canvas preview of the style so users can see what they're picking.

## Implementation Steps

### Step 1: Add `VisualizationStyle` type and preference field

**`src/types/index.ts`** — Add type:
```ts
export type VisualizationStyle = "bars" | "sine" | "rainbow";
```

Add to `UserPreferences` interface:
```ts
overlayVisualization: VisualizationStyle;
```

**`src-tauri/src/preferences/mod.rs`** — Add enum and field:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VisualizationStyle {
    Bars,
    Sine,
    Rainbow,
}

// In UserPreferences struct:
pub overlay_visualization: VisualizationStyle,

// In Default impl:
overlay_visualization: VisualizationStyle::Bars,
```

### Step 2: Refactor existing Soundwave into `SoundwaveBars`

**`src/components/visualizations/bars.tsx`** (NEW)

Move the current `Soundwave` component logic here, renamed to `SoundwaveBars`. Same 32-bar canvas rendering with single color + variable opacity. Props: `{ amplitudes: number[]; width: number; height: number }`.

### Step 3: Create `SoundwaveSine` visualization

**`src/components/visualizations/sine.tsx`** (NEW)

Canvas-based. Draws 3 overlapping sine wave curves:
- Wave 1: blue (`#3b82f6`), base frequency
- Wave 2: purple (`#8b5cf6`), 1.5× frequency, phase offset
- Wave 3: pink (`#ec4899`), 2× frequency, different phase offset

Each wave's amplitude is modulated by the RMS/average of the input amplitudes array. Waves are drawn with `globalAlpha` ~0.5 so they blend where they overlap. Uses the same smooth interpolation approach as the bars visualizer (requestAnimationFrame + easing).

### Step 4: Create `SoundwaveRainbow` visualization

**`src/components/visualizations/rainbow.tsx`** (NEW)

Same 32-bar layout as `SoundwaveBars`, but each bar's color is sampled from a gradient:
- Bar 0: `#3b82f6` (blue)
- Bar ~10: `#8b5cf6` (purple)
- Bar ~20: `#ec4899` (pink)
- Bar ~31: `#f97316` (orange)

Use HSL interpolation across the bar indices for smooth color transitions. Same amplitude logic and easing as the classic bars.

### Step 5: Create visualization registry

**`src/components/visualizations/index.ts`** (NEW)

Export a registry mapping style IDs to components and metadata:
```ts
import type { VisualizationStyle } from "@/types";

export { SoundwaveBars } from "./bars";
export { SoundwaveSine } from "./sine";
export { SoundwaveRainbow } from "./rainbow";

export const VISUALIZATIONS: Record<VisualizationStyle, {
  name: string;
  component: React.ComponentType<{ amplitudes: number[]; width: number; height: number }>;
}> = {
  bars: { name: "Classic Bars", component: SoundwaveBars },
  sine: { name: "Layered Waves", component: SoundwaveSine },
  rainbow: { name: "Rainbow Bars", component: SoundwaveRainbow },
};
```

### Step 6: Update `RecordingPill`

**`src/components/recording-pill.tsx`** — Changes:

1. Accept new prop: `visualization: VisualizationStyle`
2. Increase soundwave area: width=160, height=36
3. **Always render the visualization area** (fixed-width container) regardless of recording/processing state
4. During recording: render the selected visualization component with live amplitudes
5. During processing: render the same visualization component but with zeroed/decaying amplitudes (the smooth interpolation will naturally animate the bars/waves down to rest), plus show the processing spinner/pulse over it
6. Remove the conditional `{isRecording && ...}` — replace with always-present container

### Step 7: Update `OverlayPage`

**`src/pages/overlay.tsx`** — Changes:

1. Fetch the visualization preference (via `invoke("get_preferences")` on mount, or listen for a preference-changed event)
2. Pass `visualization` prop to `RecordingPill`

Since the overlay is a separate Tauri window, it needs its own way to get the preference. Fetch once on mount via `invoke("get_preferences")` and store in state.

### Step 8: Increase overlay window size

**`src-tauri/tauri.conf.json`** — Update recording-overlay window:
```json
"width": 380,
"height": 90
```

**`src-tauri/src/lib.rs`** — Update the overlay positioning constants (currently hardcoded 300×80) to use 380×90.

### Step 9: Add visual picker to General panel

**`src/components/panels/general-panel.tsx`** — Add a "Visualization" section:

- Section header: "Visualization"
- Three cards in a horizontal row, each containing:
  - A small canvas preview (80×32px) showing a static/animated sample of the style using fake amplitude data
  - The style name below ("Classic Bars", "Layered Waves", "Rainbow Bars")
  - Active card has blue border/highlight, others have default border
- Clicking a card calls `updatePreferences` with the new `overlayVisualization` value

The preview canvases reuse the same visualization components at a smaller size with synthetic amplitude data to show what the style looks like.

### Step 10: Delete old `Soundwave` component

**`src/components/soundwave.tsx`** — Delete after all references are migrated to the new `visualizations/` modules.

### Step 11: Update tests

**`src/components/recording-pill.test.tsx`** — Update:
- Add `visualization="bars"` prop to all test renders
- Update the "hides soundwave when not recording" test — canvas should now ALWAYS be present (consistent size)
- Add test for each visualization style rendering

**`src/components/soundwave.test.tsx`** — Migrate to test the new `SoundwaveBars` component from `visualizations/bars.tsx`. Mostly a path change.

## Files Summary

| Action | File |
|--------|------|
| Edit | `src/types/index.ts` — add `VisualizationStyle` type + `UserPreferences` field |
| Edit | `src-tauri/src/preferences/mod.rs` — add `VisualizationStyle` enum + field + default |
| Create | `src/components/visualizations/bars.tsx` — classic bars (moved from soundwave.tsx) |
| Create | `src/components/visualizations/sine.tsx` — layered sine waves |
| Create | `src/components/visualizations/rainbow.tsx` — rainbow gradient bars |
| Create | `src/components/visualizations/index.ts` — registry + re-exports |
| Edit | `src/components/recording-pill.tsx` — bigger, consistent size, visualization prop |
| Edit | `src/pages/overlay.tsx` — fetch visualization preference, pass to pill |
| Edit | `src-tauri/tauri.conf.json` — overlay window 380×90 |
| Edit | `src-tauri/src/lib.rs` — update overlay positioning constants |
| Edit | `src/components/panels/general-panel.tsx` — add visual style picker |
| Delete | `src/components/soundwave.tsx` — replaced by visualizations/bars.tsx |
| Edit | `src/components/recording-pill.test.tsx` — update for new props/behavior |
| Edit | `src/components/soundwave.test.tsx` — migrate to test bars.tsx |

## Verification

1. `pnpm tauri dev` — record voice, overlay pill appears at new larger size
2. Switch visualization style in General panel — preview cards show each style
3. Record again — overlay uses the newly selected style
4. Stop recording — pill stays same size, visualization gracefully fades to rest during processing
5. Test all three styles: Classic Bars, Layered Waves, Rainbow Bars
6. `pnpm test` — updated tests pass
7. `npx tsc --noEmit` — no type errors
