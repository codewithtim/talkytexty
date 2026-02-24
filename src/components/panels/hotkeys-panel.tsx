import { usePreferences } from "@/hooks/use-preferences";
import { HotkeyRecorder } from "@/components/hotkey-recorder";
import { ToggleSwitch } from "@/components/toggle-switch";
import { SettingsGroup } from "@/components/settings-group";
import type { HotkeyAction, HotkeyBinding } from "@/types";

const ACTION_LABELS: Record<HotkeyAction, { name: string; description: string }> = {
  ToggleRecording: {
    name: "Toggle Recording",
    description: "Start or stop voice recording",
  },
  PushToTalk: {
    name: "Push to Talk",
    description: "Hold to record, release to transcribe",
  },
  OpenTargetSelector: {
    name: "Target Window",
    description: "Open the target window selector",
  },
  OpenSettings: {
    name: "Open Settings",
    description: "Show the settings window",
  },
};

// Recording mode actions are controlled via the General panel dropdown
const HIDDEN_ACTIONS: HotkeyAction[] = ["OpenTargetSelector", "ToggleRecording", "PushToTalk"];

export function HotkeysPanel() {
  const { preferences, loading, error, updatePreferences } = usePreferences();

  if (loading || !preferences) {
    return <p className="text-gray-500 dark:text-gray-400">Loading hotkeys...</p>;
  }

  const handleToggleEnabled = async (action: HotkeyAction) => {
    const updated = {
      ...preferences,
      hotkeys: preferences.hotkeys.map((h: HotkeyBinding) =>
        h.action === action ? { ...h, enabled: !h.enabled } : h,
      ),
    };
    await updatePreferences(updated);
  };

  const handleRecord = async (action: HotkeyAction, keyCombination: string) => {
    const updated = {
      ...preferences,
      hotkeys: preferences.hotkeys.map((h: HotkeyBinding) =>
        h.action === action ? { ...h, keyCombination } : h,
      ),
    };
    await updatePreferences(updated);
  };

  const visibleHotkeys = preferences.hotkeys.filter(
    (h: HotkeyBinding) => !HIDDEN_ACTIONS.includes(h.action),
  );

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <SettingsGroup title="Keyboard Shortcuts">
        {visibleHotkeys.map((hotkey: HotkeyBinding) => {
          const info = ACTION_LABELS[hotkey.action];
          return (
            <div
              key={hotkey.action}
              className="px-4 py-3 flex items-center justify-between gap-4 border-b border-[#e5e5e7] dark:border-[#3a3a3a] last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-sm text-gray-900 dark:text-gray-100">{info.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{info.description}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <HotkeyRecorder
                  currentBinding={hotkey.keyCombination}
                  onRecord={(combo) => handleRecord(hotkey.action, combo)}
                  disabled={!hotkey.enabled}
                />
                <ToggleSwitch
                  checked={hotkey.enabled}
                  onChange={() => handleToggleEnabled(hotkey.action)}
                />
              </div>
            </div>
          );
        })}
      </SettingsGroup>
    </div>
  );
}
