# Transcription History

## Summary

Add persistent storage and a browsable UI for past transcriptions. Every completed transcription is automatically saved with metadata (timestamp, model, duration, text). Users can view, search, copy, and delete history entries from a new "History" sidebar section.

## Context

Currently, transcription results are ephemeral — `lastResult` in the `useRecording` hook is replaced on every new transcription and lost when the app restarts. There is no record of what was transcribed, when, or which model was used. The only persistent storage today is `preferences.json`.

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

### Storage

Use a single JSON file at `{app_data_dir}/history.json` containing an array of entries, ordered newest-first. JSON keeps the stack simple (no SQLite dependency), matches the existing preferences pattern, and is sufficient for the expected volume (hundreds to low thousands of entries).

If the file grows beyond ~5,000 entries, the oldest entries are automatically pruned on save.

```
{app_data_dir}/
├── preferences.json     (existing)
└── history.json          (new)
```

## Changes

### Phase 1: Rust Storage Layer

**`src-tauri/src/history/mod.rs`** (new module)

- `HistoryEntry` struct with serde derive
- `load_history(app_data_dir) -> Vec<HistoryEntry>` — reads + deserialises JSON file, returns empty vec if missing
- `save_history(app_data_dir, entries)` — serialises and writes to disk, prunes to 5,000 max
- `add_entry(app_data_dir, entry)` — loads, prepends entry, saves
- `delete_entry(app_data_dir, id)` — loads, removes by ID, saves
- `clear_history(app_data_dir)` — writes empty array

**`src-tauri/src/lib.rs`**

- Add `pub mod history;`

### Phase 2: Tauri Commands

**`src-tauri/src/commands/history_commands.rs`** (new file)

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `list_history` | — | `Vec<HistoryEntry>` | Return all entries (newest first) |
| `delete_history_entry` | `id: String` | `()` | Remove a single entry |
| `clear_history` | — | `()` | Delete all history |

**`src-tauri/src/commands/mod.rs`** — add `pub mod history_commands;`

**`src-tauri/src/lib.rs`** — register all three commands in `invoke_handler`

### Phase 3: Capture History on Transcription

**`src-tauri/src/commands/audio_commands.rs`**

Modify `stop_recording`:

1. Record `started_at` timestamp when `start_recording` is called (store in `AppState` alongside `recording_active`)
2. After successful transcription, construct a `HistoryEntry` from:
   - `session_id` (already generated)
   - `Utc::now()` for `created_at`
   - `text` from engine result
   - `active_model_id` from preferences
   - Recording duration = `now - started_at`
   - `duration_ms` already measured for transcription time
   - `selected_audio_device` from preferences
3. Call `history::add_entry(app_data_dir, entry)`
4. No changes to the return type or frontend recording flow — history saving is a backend side-effect

**`src-tauri/src/lib.rs`** — add `recording_started_at: Mutex<Option<Instant>>` to `AppState`

### Phase 4: TypeScript Types

**`src/types/index.ts`**

```typescript
export interface HistoryEntry {
  id: string;
  createdAt: string;
  text: string;
  modelId: string;
  recordingDurationMs: number;
  transcriptionDurationMs: number;
  audioDevice: string | null;
}
```

**`src/types/index.ts`** — add `"history"` to `SettingsSection` union type

### Phase 5: Frontend Hook

**`src/hooks/use-history.ts`** (new file)

```typescript
function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load on mount via invoke("list_history")
  // deleteEntry(id) — invoke("delete_history_entry") + update local state
  // clearAll() — invoke("clear_history") + update local state
  // reload() — re-fetch from backend

  return { entries, loading, deleteEntry, clearAll, reload };
}
```

### Phase 6: History Panel UI

**`src/components/panels/history-panel.tsx`** (new file)

Layout:
- Top bar: search input (filters entries client-side by text content) + "Clear All" button with confirmation
- Scrollable list of history cards, each showing:
  - Truncated transcription text (first ~2 lines)
  - Relative timestamp ("2 min ago", "Yesterday")
  - Model name badge
  - Recording duration
  - Actions: copy text to clipboard, delete entry
- Empty state when no history exists ("No transcriptions yet")

Uses `SettingsGroup` for visual consistency with other panels.

### Phase 7: Wire Into App

**`src/App.tsx`**

- Import `HistoryPanel`, add to `PANELS` record
- Add `"/history": "history"` to `ROUTE_TO_SECTION`

**`src/components/sidebar.tsx`**

- Add "History" item to `SIDEBAR_ITEMS` array (between General and Models, or as the first item)
- Icon: clock/history icon with a green background

## Files Summary

| Action | File |
|--------|------|
| Create | `src-tauri/src/history/mod.rs` |
| Create | `src-tauri/src/commands/history_commands.rs` |
| Create | `src/hooks/use-history.ts` |
| Create | `src/components/panels/history-panel.tsx` |
| Edit | `src-tauri/src/lib.rs` |
| Edit | `src-tauri/src/commands/mod.rs` |
| Edit | `src-tauri/src/commands/audio_commands.rs` |
| Edit | `src/types/index.ts` |
| Edit | `src/App.tsx` |
| Edit | `src/components/sidebar.tsx` |

## Out of Scope (Future Considerations)

- **Audio playback** — storing and replaying the original audio recording
- **Edit and re-inject** — modifying a past transcription and injecting it again
- **Export** — exporting history as CSV/JSON
- **SQLite migration** — only needed if JSON performance degrades at scale
- **Cloud sync** — syncing history across devices
- **Favourite/pin entries** — bookmarking frequently referenced transcriptions

## Verification

- `cargo check` — Rust compiles with new module + commands
- `npx tsc --noEmit` — TypeScript compiles with new types + components
- `pnpm test --run` — existing tests still pass
- Manual: complete a transcription, open History panel, verify entry appears with correct metadata. Delete an entry, clear all, verify search filtering works.
