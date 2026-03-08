# Plan: Filler Word Removal Post-Processing

**Date:** 2026-03-08
**Status:** Complete

---

## Overview

Add a post-processing step that strips filler words (um, uh, ah, hmm, er, etc.) from transcription output before the text is stored in history or injected into a target window. This improves the quality of transcribed text by removing verbal hesitations that add no meaning. The feature will be toggleable via a user preference so users can disable it if needed.

---

## Approach

Add a dedicated `postprocess` module inside `src-tauri/src/transcription/` containing a pure function that takes a transcript string and returns the cleaned version. Hook it into the `stop_recording` flow in `audio_commands.rs` — after `engine.transcribe()` returns but before the text is emitted/stored. This keeps the post-processing decoupled from individual engine implementations.

**Why post-process centrally rather than per-engine:**
- All engines (Whisper, Parakeet CTC/TDT/EOU) can produce filler words — it's a property of speech, not the model.
- A single function avoids duplicating logic across 4 engine paths.
- Easier to extend with additional cleaning rules later.

**Filler word strategy — regex-based word boundary matching:**
- Match whole words only (using `\b` word boundaries) to avoid false positives (e.g., "hum" should not be stripped from "human").
- Case-insensitive matching.
- Handle punctuation attached to fillers (e.g., "Um, I think..." → "I think...").
- Collapse resulting double/triple spaces and trim.

**Filler words to remove:**

| Category | Words |
|---|---|
| Hesitation sounds | um, uh, uh-huh, uhh, umm, hmm, hm, er, err, ah, ahh |
| Verbal fillers | you know, I mean, like (only standalone, not "I like cats") |

Note on "like": This is tricky. Standalone "like" as a filler (", like, ") is common but "like" is also a real word. We'll only remove "like" when it appears surrounded by commas or at the very start of a sentence followed by a comma — patterns that strongly indicate filler usage. This can be refined later based on user feedback.

### Trade-offs

- **False positives on "like"**: The comma-bounded heuristic won't catch every filler "like" but avoids removing meaningful uses. Acceptable starting point.
- **English-only**: The filler word list is English-focused. Multilingual support can be added later with language-tagged word lists.
- **No ML-based detection**: A simple word list is fast and predictable. An ML approach would be more accurate but adds latency and complexity — not worth it for v1.

---

## Changes Required

### `src-tauri/src/transcription/postprocess.rs` (new file)

New module containing the filler word removal function. Pure function, no state, easy to test.

```rust
/// Remove filler words from transcribed text.
/// Returns cleaned text with fillers stripped and whitespace normalized.
pub fn remove_filler_words(text: &str) -> String {
    // Implementation uses regex with word boundaries
}
```

Key implementation details:
- Use `regex::Regex` with `(?i)` case-insensitive flag.
- Pattern: `\b(um|uh|uhh|umm|hmm|hm|er|err|ah|ahh|uh-huh)\b[,]?\s*` — matches the filler word, an optional trailing comma, and trailing whitespace.
- Separate pattern for multi-word fillers: `\b(you know|I mean)\b[,]?\s*`
- Separate pattern for "like" filler: `(?:^|,\s*)\blike\b\s*,\s*` — only when bounded by commas or at sentence start.
- After all replacements: collapse multiple spaces to single space, fix double commas/punctuation, trim.
- Use `lazy_static!` or `std::sync::OnceLock` to compile regexes once.

### `src-tauri/src/transcription/mod.rs`

Add the new module declaration.

```rust
pub mod engine;
pub mod models;
pub mod postprocess;  // add this line
```

### `src-tauri/src/commands/audio_commands.rs`

Apply filler word removal after transcription, gated by the user preference. Changes to `stop_recording` around lines 216-227:

```rust
// Transcribe
let text = {
    let engine = state.engine.read()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;
    let engine = engine.as_ref()
        .ok_or_else(|| CommandError::new("NoModelSelected", "No model loaded."))?;
    engine.transcribe(&audio_16khz)
        .map_err(|e| CommandError::new("TranscriptionFailed", e))?
};

// Post-process: remove filler words if enabled
let text = {
    let prefs = state.preferences.read()
        .map_err(|e| CommandError::new("LockError", e.to_string()))?;
    if prefs.remove_filler_words {
        crate::transcription::postprocess::remove_filler_words(&text)
    } else {
        text
    }
};
```

### `src-tauri/src/preferences/mod.rs`

Add the toggle field to `UserPreferences`:

```rust
pub struct UserPreferences {
    // ... existing fields ...
    #[serde(default = "default_true")]
    pub remove_filler_words: bool,
}

fn default_true() -> bool {
    true
}
```

Default is `true` (enabled) — most users will want filler words removed. The `serde(default)` ensures backward compatibility with existing saved preferences files that lack this field.

Also update the `Default` impl:

```rust
impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            // ... existing fields ...
            remove_filler_words: true,
        }
    }
}
```

### `src/types/index.ts`

Add the field to the TypeScript `UserPreferences` interface:

```typescript
export interface UserPreferences {
  // ... existing fields ...
  removeFillerWords: boolean;
}
```

### `src/components/panels/general-panel.tsx`

Add a toggle in the "Input" settings group, after the "Text Injection" row:

```tsx
<SettingsRow label="Remove Filler Words" description="Strip um, uh, hmm, and other fillers from transcriptions">
  <ToggleSwitch
    checked={preferences?.removeFillerWords ?? true}
    onChange={async () => {
      if (!preferences) return;
      await updatePreferences({
        ...preferences,
        removeFillerWords: !preferences.removeFillerWords,
      });
    }}
  />
</SettingsRow>
```

### `src-tauri/Cargo.toml`

Add `regex` dependency (if not already present):

```toml
[dependencies]
regex = "1"
```

---

## Test Plan

All tests in `src-tauri/src/transcription/postprocess.rs` (or a companion test file).

| Test case | Input | Expected output |
|---|---|---|
| Single filler at start | `"Um I think so"` | `"I think so"` |
| Single filler mid-sentence | `"I was um thinking"` | `"I was thinking"` |
| Filler with comma | `"Um, I think so"` | `"I think so"` |
| Multiple fillers | `"Um uh I was like, uh, thinking"` | `"I was thinking"` |
| Case insensitive | `"UM I think so"` | `"I think so"` |
| No false positive on "human" | `"The human was kind"` | `"The human was kind"` |
| No false positive on "like" (verb) | `"I like cats"` | `"I like cats"` |
| Filler "like" with commas | `"It was, like, amazing"` | `"It was amazing"` |
| Multi-word filler "you know" | `"You know, it was great"` | `"It was great"` |
| Multi-word filler "I mean" | `"I mean, that's fine"` | `"That's fine"` |
| Empty string | `""` | `""` |
| No fillers present | `"Hello world"` | `"Hello world"` |
| All fillers | `"Um uh er"` | `""` |
| Preserves capitalization after removal | `"Um, The cat sat"` | `"The cat sat"` |
| Double spaces collapsed | `"I  um  think"` | `"I think"` |
| Repeated filler | `"Um um um hello"` | `"hello"` |

---

## Task Breakdown

- [x] Add `regex` to `Cargo.toml` dependencies (check if already present)
- [x] Create `src-tauri/src/transcription/postprocess.rs` with `remove_filler_words()` function
- [x] Register `pub mod postprocess` in `src-tauri/src/transcription/mod.rs`
- [x] Add `remove_filler_words: bool` field to `UserPreferences` in `src-tauri/src/preferences/mod.rs` with `#[serde(default = "default_true")]` and update `Default` impl
- [x] Add `removeFillerWords: boolean` to `UserPreferences` in `src/types/index.ts`
- [x] Wire post-processing into `stop_recording()` in `src-tauri/src/commands/audio_commands.rs`, gated by the preference
- [x] Add toggle UI row in `src/components/panels/general-panel.tsx` under the "Input" settings group
- [x] Write unit tests for `remove_filler_words()` covering all test plan cases
- [x] Run `cargo test` and `cargo clippy` to verify
