import { usePreferences } from "@/hooks/use-preferences";
import { HotkeyRecorder } from "@/components/hotkey-recorder";
import { ToggleSwitch } from "@/components/toggle-switch";
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

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Hotkeys</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Configure keyboard shortcuts. Changes take effect immediately.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {preferences.hotkeys.filter((h: HotkeyBinding) => !HIDDEN_ACTIONS.includes(h.action)).map((hotkey: HotkeyBinding) => {
          const info = ACTION_LABELS[hotkey.action];
          return (
            <div
              key={hotkey.action}
              className="rounded-lg bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{info.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{info.description}</p>
                </div>
                <div className="flex items-center gap-3">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
