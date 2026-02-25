import { SettingsGroup } from "@/components/settings-group";

interface ChangelogEntry {
  version: string;
  date: string;
  added?: string[];
  fixed?: string[];
  changed?: string[];
  removed?: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.1",
    date: "2026-02-25",
    added: [
      "Stats widget on General panel (avg WPM, words this week, transcriptions, time saved)",
      "macOS microphone permission request on first launch",
      "Accessibility permission enforcement with real-time status banner",
    ],
    changed: [
      "Moved settings hotkey into the General panel's Recording section",
      "Removed dedicated Hotkeys sidebar item and tray menu entry",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-02-25",
    added: [
      "\"What's New\" changelog panel in the sidebar",
      "CONTRIBUTING.md with setup and quality gate instructions",
      "Custom parrot pixel art icon (transparent background)",
    ],
    changed: [
      "Renamed app from \"Text to Code\" to \"TalkyTexty\"",
      "Microphone selection now syncs between status bar and settings panel",
      "About panel uses the parrot icon",
    ],
    fixed: [
      "Alt+Space hotkey registration on macOS",
      "Settings dropdowns hidden behind menu items",
    ],
  },
  {
    version: "0.1.0",
    date: "2025-02-25",
    added: [
      "Global hotkey recording with toggle and push-to-talk modes",
      "Local speech-to-text transcription using whisper.cpp (runs entirely offline)",
      "Text injection into any application via simulated keystrokes or clipboard paste",
      "Model management — download, switch, and delete Whisper models",
      "Recording overlay with animated soundwave (Bars, Sine, Rainbow)",
      "Processing animations (Pulse, Frozen Frame, Typing Parrot)",
      "Overlay mode options: Full, Mini, or None",
      "System tray with recording status and quick actions",
      "Microphone selection and audio device management",
      "Target window picker for choosing where to inject text",
      "History panel with playback and transcript review",
      "Hotkey customization for all actions",
      "Launch at login option",
    ],
  },
];

function ChangeSection({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <span className={`inline-block text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${color} mb-1.5`}>
        {label}
      </span>
      <ul className="space-y-1 ml-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
            <span className="text-gray-400 dark:text-gray-500 shrink-0">-</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChangelogPanel() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">What's New</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Release history and changes
        </p>
      </div>

      {CHANGELOG.map((entry) => (
        <SettingsGroup key={entry.version} title={`v${entry.version} — ${entry.date}`}>
          <div className="px-4 py-3">
            {entry.added && <ChangeSection label="Added" items={entry.added} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />}
            {entry.fixed && <ChangeSection label="Fixed" items={entry.fixed} color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />}
            {entry.changed && <ChangeSection label="Changed" items={entry.changed} color="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" />}
            {entry.removed && <ChangeSection label="Removed" items={entry.removed} color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />}
          </div>
        </SettingsGroup>
      ))}
    </div>
  );
}
