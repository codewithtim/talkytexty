import { usePreferences } from "@/hooks/use-preferences";
import { ToggleSwitch } from "@/components/toggle-switch";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";

export function AboutPanel() {
  const { preferences, updatePreferences } = usePreferences();

  return (
    <div>
      {/* App header */}
      <div className="flex flex-col items-center text-center mb-8 pt-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Text to Code</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
          Local speech-to-text transcription that types directly into your apps.
        </p>
      </div>

      {/* Application settings */}
      <SettingsGroup title="Application">
        <SettingsRow label="Version">
          <span className="text-sm text-gray-500 dark:text-gray-400">0.1.0</span>
        </SettingsRow>
        <SettingsRow label="Launch at Login" description="Start Text to Code when you log in">
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
