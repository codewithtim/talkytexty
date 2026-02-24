# Add "Typing Parrot" 8-bit Processing Animation

## Context

The app has two processing animations (Pulse, FrozenFrame) shown while transcription runs after recording stops. We're adding a third: an 8-bit pixel-art parrot typing on a keyboard, rendered as a canvas animation.

## Changes

### 1. Add `TypingParrot` variant to types

**`src/types/index.ts`** — extend union:
```
export type ProcessingAnimation = "Pulse" | "FrozenFrame" | "TypingParrot";
```

**`src-tauri/src/preferences/mod.rs`** — add variant to enum:
```rust
pub enum ProcessingAnimation {
    Pulse,
    FrozenFrame,
    TypingParrot,
}
```

### 2. Create the animation component

**`src/components/processing-animations/typing-parrot.tsx`** (new file)

Canvas-based 8-bit pixel art animation:
- A parrot character with body, wing, beak, eye — drawn with filled rectangles at a pixel scale
- Sitting at/above a keyboard
- Typing animation: wing moves up/down on a timer, keyboard keys flash
- Centered in the `width x height` canvas area
- Uses `requestAnimationFrame` for smooth animation, DPR-aware

### 3. Register in the processing animations index

**`src/components/processing-animations/index.ts`**:
- Export `TypingParrotAnimation`
- Add to `PROCESSING_ANIMATIONS` registry

### 4. Wire into recording pill renderer

**`src/components/recording-pill.tsx`**:
- Add `TypingParrot` case to `renderVisualization()` — renders `TypingParrotAnimation`

### 5. Add to settings picker

**`src/components/panels/general-panel.tsx`**:
- Add `"TypingParrot"` to `PROCESSING_ANIM_KEYS` array

## Files Summary

| Action | File |
|--------|------|
| Edit | `src/types/index.ts` |
| Edit | `src-tauri/src/preferences/mod.rs` |
| Create | `src/components/processing-animations/typing-parrot.tsx` |
| Edit | `src/components/processing-animations/index.ts` |
| Edit | `src/components/recording-pill.tsx` |
| Edit | `src/components/panels/general-panel.tsx` |

## To-Do List

- [ ] **1.1** Add `TypingParrot` to `ProcessingAnimation` union in `src/types/index.ts`
- [ ] **1.2** Add `TypingParrot` variant to `ProcessingAnimation` enum in `src-tauri/src/preferences/mod.rs`
- [ ] **2.1** Create `src/components/processing-animations/typing-parrot.tsx` with canvas-based 8-bit parrot typing animation
- [ ] **3.1** Export `TypingParrotAnimation` from `src/components/processing-animations/index.ts`
- [ ] **3.2** Add `TypingParrot` entry to `PROCESSING_ANIMATIONS` registry
- [ ] **4.1** Add `TypingParrot` case to `renderVisualization()` in `src/components/recording-pill.tsx`
- [ ] **5.1** Add `"TypingParrot"` to `PROCESSING_ANIM_KEYS` array in `src/components/panels/general-panel.tsx`
- [ ] **6.1** `cargo check` — Rust compiles with new enum variant
- [ ] **6.2** `npx tsc --noEmit` — TypeScript compiles
- [ ] **6.3** `pnpm test --run` — all existing tests pass
- [ ] **6.4** Manual: select "Typing Parrot" in settings, verify the parrot animation renders during processing
