import { usePreferences } from "@/hooks/use-preferences";
import { ToggleSwitch } from "@/components/toggle-switch";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";

export function AboutPanel() {
  const { preferences, updatePreferences } = usePreferences();

  return (
    <div>
      {/* App header */}
      <div className="flex flex-col items-center text-center mb-8 pt-4">
        <img src="/app-icon.png" alt="TalkyTexty" className="w-16 h-16 rounded-2xl shadow-lg mb-4" style={{ imageRendering: "pixelated" }} />
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">TalkyTexty</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
          Local speech-to-text transcription that types directly into your apps.
        </p>
      </div>

      {/* Application settings */}
      <SettingsGroup title="Application">
        <SettingsRow label="Version">
          <span className="text-sm text-gray-500 dark:text-gray-400">0.1.0</span>
        </SettingsRow>
        <SettingsRow label="Launch at Login" description="Start TalkyTexty when you log in">
          <ToggleSwitch
            checked={preferences?.launchAtLogin ?? false}
            onChange={async () => {
              if (!preferences) return;
              await updatePreferences({
                ...preferences,
                launchAtLogin: !preferences.launchAtLogin,
              });
            }}
          />
        </SettingsRow>
      </SettingsGroup>

      <div className="text-center mt-6">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Powered by Whisper and Parakeet
        </p>
      </div>
    </div>
  );
}
