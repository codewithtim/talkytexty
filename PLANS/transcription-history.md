# Transcription History

## Summary

Persistent storage and a browsable UI for past transcriptions. Every completed transcription is automatically saved with metadata (timestamp, model, duration, text) and its audio recording as a WAV file. Users can view, search, copy, play back audio with a waveform visualization, and delete history entries from the "History" sidebar section.

## Context

Previously, transcription results were ephemeral — `lastResult` in the `useRecording` hook was replaced on every new transcription and lost when the app restarted. There was no record of what was transcribed, when, or which model was used.

## Data Model

### `HistoryEntry` (Rust struct + TypeScript type)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` (UUID v4) | Matches the `session_id` from recording |
| `created_at` | `String` (ISO 8601) | Timestamp when transcription completed |
| `text` | `String` | The transcribed text |
| `model_id` | `String` | Active model ID at time of transcription |
| `recording_duration_ms` | `u64` | How long the user recorded audio |
| `transcription_duration_ms` | `u64` | How long the engine took to transcribe |
| `audio_device` | `Option<String>` | Mic used (null = system default) |
| `audio_file_name` | `Option<String>` | Filename of the saved WAV recording (null if save failed) |

### Storage

History entries are stored in `{app_data_dir}/history.json` as a JSON array, ordered newest-first. Audio recordings are stored as 16kHz mono WAV files in `{app_data_dir}/recordings/`, written using the `hound` crate.

If the file grows beyond 5,000 entries, the oldest entries are automatically pruned on save. Deleting an entry also deletes its associated audio file. Clearing all history deletes the entire `recordings/` directory.

```
{app_data_dir}/
├── preferences.json     (existing)
├── history.json
└── recordings/
    ├── {uuid}.wav
    └── ...
```

## Implementation

### Rust Storage Layer — `src-tauri/src/history/mod.rs`

- `HistoryEntry` struct with serde derive (camelCase serialization)
- `load_history(app_data_dir)` — reads + deserialises JSON file, returns empty vec if missing
- `save_history(app_data_dir, entries)` — serialises and writes to disk, prunes to 5,000 max
- `add_entry(app_data_dir, entry)` — loads, prepends entry, saves
- `delete_entry(app_data_dir, id)` — loads, deletes associated audio file, removes by ID, saves
- `clear_history(app_data_dir)` — deletes recordings directory, writes empty array
- `save_audio_wav(app_data_dir, id, samples, sample_rate)` — writes f32 samples to a 16-bit WAV file via `hound`
- `load_audio_bytes(app_data_dir, file_name)` — reads raw WAV bytes for frontend playback
- `delete_audio_file(app_data_dir, file_name)` — removes a single WAV file

### Tauri Commands — `src-tauri/src/commands/history_commands.rs`

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `list_history` | — | `Vec<HistoryEntry>` | Return all entries (newest first) |
| `delete_history_entry` | `id: String` | `()` | Remove entry and its audio file |
| `clear_history` | — | `()` | Delete all history and recordings |
| `get_history_audio` | `file_name: String` | `Vec<u8>` | Return raw WAV bytes for playback |

### History Capture — `src-tauri/src/commands/audio_commands.rs`

In `stop_recording`, after successful transcription:

1. Recording duration is calculated from `recording_started_at` (stored in `AppState` on `start_recording`)
2. Audio is resampled to 16kHz and saved as WAV via `history::save_audio_wav`
3. A `HistoryEntry` is constructed with all metadata including `audio_file_name`
4. Entry is prepended to history via `history::add_entry`

This is a backend side-effect — no changes to the return type or frontend recording flow.

### TypeScript Types — `src/types/index.ts`

```typescript
export interface HistoryEntry {
  id: string;
  createdAt: string;
  text: string;
  modelId: string;
  recordingDurationMs: number;
  transcriptionDurationMs: number;
  audioDevice: string | null;
  audioFileName: string | null;
}
```

`SettingsSection` union type includes `"history"`.

### Frontend Hook — `src/hooks/use-history.ts`

```typescript
function useHistory(): {
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
  deleteEntry: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  reload: () => Promise<void>;
}
```

Loads entries on mount via `invoke("list_history")`. Delete and clear operations update local state optimistically after the backend call succeeds.

### History Panel UI — `src/components/panels/history-panel.tsx`

**HistoryCard** — displays a single history entry:
- Truncated transcription text (expandable if > 120 chars)
- Copy to clipboard and delete buttons
- Relative timestamp, model badge (neutral gray pill), recording duration, transcription duration
- Waveform player (when audio is available)

**WaveformPlayer** — canvas-based audio waveform visualization:
- On mount: fetches WAV bytes via `invoke("get_history_audio")`, decodes with Web Audio API `decodeAudioData()`, extracts ~80 amplitude peaks, caches a blob URL for playback
- DPR-aware canvas rendering: ~80 bars, 32px tall, 1px gaps, rounded rects, centered horizontally
- Two-tone coloring: bars left of playback cursor = white (dark mode) / near-black (light mode), bars right = gray
- Play/pause button to the left of the waveform
- During playback: `requestAnimationFrame` loop polls `audio.currentTime / audio.duration` and sweeps the played color across the bars
- On playback end or stop: resets progress to 0, all bars return to gray
- Container uses `ResizeObserver` for responsive width, canvas CSS is always `width: 100%`

**HistoryPanel** — the full panel view:
- Search input for filtering entries client-side by text content
- Refresh button to reload from backend
- "Clear All" button with confirmation prompt
- Scrollable list of `HistoryCard` components
- Empty state when no history exists
- Wrapped in `SettingsGroup` for visual consistency with other panels

### App Wiring

- **`src/App.tsx`** — imports `HistoryPanel`, adds to `PANELS` record
- **`src/components/sidebar.tsx`** — "History" nav item with green clock icon (`bg-green-500`)
- **`src-tauri/Cargo.toml`** — `hound` dependency for WAV writing
- **`src-tauri/src/commands/mod.rs`** — `pub mod history_commands;`
- **`src-tauri/src/lib.rs`** — `pub mod history;`, registers all four history commands, adds `recording_started_at: Mutex<Option<Instant>>` to `AppState`

## Files Summary

| Action | File |
|--------|------|
| Create | `src-tauri/src/history/mod.rs` |
| Create | `src-tauri/src/commands/history_commands.rs` |
| Create | `src/hooks/use-history.ts` |
| Create | `src/components/panels/history-panel.tsx` |
| Edit | `src-tauri/Cargo.toml` |
| Edit | `src-tauri/src/lib.rs` |
| Edit | `src-tauri/src/commands/mod.rs` |
| Edit | `src-tauri/src/commands/audio_commands.rs` |
| Edit | `src/types/index.ts` |
| Edit | `src/App.tsx` |
| Edit | `src/components/sidebar.tsx` |

## Future Considerations

- **Edit and re-inject** — modifying a past transcription and injecting it again
- **Export** — exporting history as CSV/JSON
- **SQLite migration** — only needed if JSON performance degrades at scale
- **Cloud sync** — syncing history across devices
- **Favourite/pin entries** — bookmarking frequently referenced transcriptions
