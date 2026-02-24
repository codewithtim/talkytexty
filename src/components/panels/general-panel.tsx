import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePreferences } from "@/hooks/use-preferences";
import { useModels } from "@/hooks/use-models";
import { HotkeyRecorder } from "@/components/hotkey-recorder";
import { CompanyBadge } from "@/components/company-badge";
import { SettingsGroup, SettingsRow } from "@/components/settings-group";
import { VISUALIZATIONS } from "@/components/visualizations";
import { PROCESSING_ANIMATIONS } from "@/components/processing-animations";
import type { VisualizationStyle, ProcessingAnimation, OverlayMode, AudioDevice, TranscriptionModel, RecordingMode, HotkeyBinding } from "@/types";

const STYLE_KEYS: VisualizationStyle[] = ["Bars", "Sine", "Rainbow"];
const PROCESSING_ANIM_KEYS: ProcessingAnimation[] = ["Pulse", "FrozenFrame", "TypingParrot"];
const OVERLAY_MODES: { key: OverlayMode; label: string; description: string }[] = [
  { key: "Full", label: "Full", description: "Waveform, mic info & hotkeys" },
  { key: "Mini", label: "Mini", description: "Waveform only" },
  { key: "None", label: "None", description: "No overlay" },
];

function useFakeAmplitudes(): number[] {
  const [amplitudes, setAmplitudes] = useState<number[]>(() =>
    Array.from({ length: 48 }, () => Math.random() * 0.5 + 0.1),
  );
  const frameRef = useRef(0);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      frameRef.current += 1;
      if (frameRef.current % 6 === 0) {
        setAmplitudes((prev) =>
          prev.map((v) => {
            const delta = (Math.random() - 0.5) * 0.3;
            return Math.max(0.05, Math.min(0.85, v + delta));
          }),
        );
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return amplitudes;
}

export function GeneralPanel() {
  const { preferences, loading, error, updatePreferences } = usePreferences();
  const { models, setActiveModel, activatingModelId } = useModels();
  const fakeAmplitudes = useFakeAmplitudes();

  const isWindowPicker = preferences?.targetMode.type === "WindowPicker";

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Loading preferences...</p>;
  }

  if (error) {
    return <p className="text-red-500">Error: {error}</p>;
  }

  const downloadedModels = models.filter((m) => m.downloadStatus.status === "Downloaded");

  return (
    <div>
      {/* Model */}
      <SettingsGroup title="Model">
        <div className="px-4 py-3">
          <ModelSelector
            models={downloadedModels}
            activeModelId={preferences?.activeModelId ?? null}
            activatingModelId={activatingModelId}
            onSelect={setActiveModel}
          />
        </div>
      </SettingsGroup>

      {/* Recording */}
      <SettingsGroup title="Recording">
        <SettingsRow label="Mode" description={
          preferences?.recordingMode === "PushToTalk"
            ? "Hold hotkey to record, release to transcribe"
            : "Press hotkey to start, press again to stop"
        }>
          <InlineRecordingModeSelector
            value={preferences?.recordingMode ?? "Toggle"}
            onChange={async (mode) => {
              if (!preferences) return;
              const enableAction = mode === "PushToTalk" ? "PushToTalk" : "ToggleRecording";
              const disableAction = mode === "PushToTalk" ? "ToggleRecording" : "PushToTalk";
              await updatePreferences({
                ...preferences,
                recordingMode: mode,
                hotkeys: preferences.hotkeys.map((h) => {
                  if (h.action === enableAction) return { ...h, enabled: true };
                  if (h.action === disableAction) return { ...h, enabled: false };
                  return h;
                }),
              });
            }}
          />
        </SettingsRow>
        <SettingsRow label="Hotkey" description="Keyboard shortcut to start/stop recording">
          <HotkeyRecorder
            currentBinding={
              preferences?.hotkeys.find(
                (h: HotkeyBinding) => h.action === "ToggleRecording" || h.action === "PushToTalk",
              )?.keyCombination ?? ""
            }
            onRecord={async (combo) => {
              if (!preferences) return;
              await updatePreferences({
                ...preferences,
                hotkeys: preferences.hotkeys.map((h: HotkeyBinding) =>
                  h.action === "ToggleRecording" || h.action === "PushToTalk"
                    ? { ...h, keyCombination: combo }
                    : h,
                ),
              });
            }}
          />
        </SettingsRow>
        <SettingsRow label="Target Window" description={
          isWindowPicker
            ? "Choose target window after recording"
            : "Inject into currently focused window"
        }>
          <InlineTargetModeSelector
            value={isWindowPicker ? "WindowPicker" : "ActiveWindow"}
            onChange={async (mode) => {
              if (!preferences) return;
              await updatePreferences({
                ...preferences,
                targetMode: mode === "WindowPicker"
                  ? { type: "WindowPicker" }
                  : { type: "ActiveWindow" },
              });
            }}
          />
        </SettingsRow>
      </SettingsGroup>

      {/* Input */}
      <SettingsGroup title="Input">
        <SettingsRow label="Microphone">
          <MicrophoneSelector
            value={preferences?.selectedAudioDevice ?? null}
            onChange={async (device) => {
              if (!preferences) return;
              await updatePreferences({
                ...preferences,
                selectedAudioDevice: device,
              });
            }}
          />
        </SettingsRow>
        <SettingsRow label="Text Injection">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {preferences?.textInjectionMethod === "ClipboardPaste"
              ? "Clipboard Paste"
              : "Simulated Keystrokes"}
          </span>
        </SettingsRow>
      </SettingsGroup>

      {/* Overlay Mode */}
      <SettingsGroup title="Overlay Style">
        <div className="px-4 py-3">
          <OverlayModePicker
            value={preferences?.overlayMode ?? "Full"}
            amplitudes={fakeAmplitudes}
            visualization={preferences?.overlayVisualization ?? "Bars"}
            onChange={async (mode) => {
              if (!preferences) return;
              await updatePreferences({
                ...preferences,
                overlayMode: mode,
              });
            }}
          />
        </div>
      </SettingsGroup>

      {/* Appearance */}
      <SettingsGroup title="Visualization">
        <div className="px-4 py-3">
          <VisualizationPicker
            value={preferences?.overlayVisualization ?? "Bars"}
            onChange={async (style) => {
              if (!preferences) return;
              await updatePreferences({
                ...preferences,
                overlayVisualization: style,
              });
            }}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Processing Animation">
        <div className="px-4 py-3">
          <ProcessingAnimationPicker
            value={preferences?.overlayProcessingAnimation ?? "Pulse"}
            onChange={async (anim) => {
              if (!preferences) return;
              await updatePreferences({
                ...preferences,
                overlayProcessingAnimation: anim,
              });
            }}
          />
        </div>
      </SettingsGroup>
    </div>
  );
}

/* ---------- Inline selectors (compact, for SettingsRow right side) ---------- */

function InlineRecordingModeSelector({
  value,
  onChange,
}: {
  value: RecordingMode;
  onChange: (mode: RecordingMode) => void;
}) {
  return (
    <div className="flex rounded-lg bg-white dark:bg-[#333] border border-[#e5e5e7] dark:border-[#444] overflow-hidden">
      {(["Toggle", "PushToTalk"] as RecordingMode[]).map((mode) => {
        const isActive = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? "bg-blue-500 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]"
            }`}
          >
            {mode === "PushToTalk" ? "Push to Talk" : "Toggle"}
          </button>
        );
      })}
    </div>
  );
}

function InlineTargetModeSelector({
  value,
  onChange,
}: {
  value: "ActiveWindow" | "WindowPicker";
  onChange: (mode: "ActiveWindow" | "WindowPicker") => void;
}) {
  return (
    <div className="flex rounded-lg bg-white dark:bg-[#333] border border-[#e5e5e7] dark:border-[#444] overflow-hidden">
      {([
        { value: "ActiveWindow" as const, label: "Active Window" },
        { value: "WindowPicker" as const, label: "Window Picker" },
      ]).map((mode) => {
        const isActive = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              isActive
                ? "bg-blue-500 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]"
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Sub-components (kept from original) ---------- */

function OverlayModePicker({
  value,
  amplitudes,
  visualization,
  onChange,
}: {
  value: OverlayMode;
  amplitudes: number[];
  visualization: VisualizationStyle;
  onChange: (mode: OverlayMode) => void;
}) {
  const vizEntry = VISUALIZATIONS[visualization];
  const VizComponent = vizEntry.component;

  return (
    <div className="grid grid-cols-3 gap-3">
      {OVERLAY_MODES.map(({ key, label }) => {
        const isActive = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-lg p-3 flex flex-col items-center gap-2 transition-colors cursor-pointer ${
              isActive
                ? "bg-gray-100 dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-500"
                : "bg-white dark:bg-[#333] border border-[#e5e5e7] dark:border-[#444] hover:border-gray-400 dark:hover:border-gray-500"
            }`}
          >
            <div className="rounded bg-[#f6f6f6] dark:bg-[#2b2b2f] w-full flex flex-col items-center overflow-hidden">
              {key === "None" ? (
                <div className="flex items-center justify-center h-10">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                </div>
              ) : key === "Mini" ? (
                <div className="px-1.5 py-1.5">
                  <VizComponent amplitudes={amplitudes} width={100} height={20} />
                </div>
              ) : (
                <div className="flex flex-col w-full">
                  <div className="px-1.5 pt-1.5">
                    <VizComponent amplitudes={amplitudes} width={100} height={20} />
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 mt-0.5 border-t border-black/[0.04] dark:border-white/[0.04]">
                    <span className="text-[8px] text-gray-400 dark:text-gray-500">Default</span>
                    <span className="text-[8px] text-gray-400 dark:text-gray-500">esc</span>
                  </div>
                </div>
              )}
            </div>
            <span className={`text-xs font-medium ${
              isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"
            }`}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function VisualizationPicker({
  value,
  onChange,
}: {
  value: VisualizationStyle;
  onChange: (style: VisualizationStyle) => void;
}) {
  const amplitudes = useFakeAmplitudes();

  return (
    <div className="grid grid-cols-3 gap-3">
      {STYLE_KEYS.map((styleKey) => {
        const viz = VISUALIZATIONS[styleKey];
        const VizComponent = viz.component;
        const isActive = value === styleKey;

        return (
          <button
            key={styleKey}
            type="button"
            onClick={() => onChange(styleKey)}
            className={`rounded-lg p-3 flex flex-col items-center gap-2 transition-colors cursor-pointer ${
              isActive
                ? "bg-gray-100 dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-500"
                : "bg-white dark:bg-[#333] border border-[#e5e5e7] dark:border-[#444] hover:border-gray-400 dark:hover:border-gray-500"
            }`}
          >
            <div className="rounded bg-[#f6f6f6] dark:bg-[#2b2b2f] p-1.5 w-full flex items-center justify-center">
              <VizComponent amplitudes={amplitudes} width={120} height={32} />
            </div>
            <span
              className={`text-xs font-medium ${
                isActive
                  ? "text-gray-900 dark:text-gray-100"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              {viz.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProcessingAnimationPicker({
  value,
  onChange,
}: {
  value: ProcessingAnimation;
  onChange: (anim: ProcessingAnimation) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {PROCESSING_ANIM_KEYS.map((key) => {
        const entry = PROCESSING_ANIMATIONS[key];
        const isActive = value === key;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-lg p-3 flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              isActive
                ? "bg-gray-100 dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-500"
                : "bg-white dark:bg-[#333] border border-[#e5e5e7] dark:border-[#444] hover:border-gray-400 dark:hover:border-gray-500"
            }`}
          >
            <span
              className={`text-sm font-medium ${
                isActive
                  ? "text-gray-900 dark:text-gray-100"
                  : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {entry.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {entry.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MicrophoneSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (device: string | null) => void;
}) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<AudioDevice[]>("list_audio_devices")
      .then(setDevices)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedLabel = value
    ? devices.find((d) => d.name === value)?.name ?? value
    : "System Default";

  const options: { label: string; deviceValue: string | null; isDefault: boolean }[] = [
    { label: "System Default", deviceValue: null, isDefault: false },
    ...devices.map((d) => ({
      label: d.name,
      deviceValue: d.name,
      isDefault: d.isDefault,
    })),
  ];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
      >
        <span className="truncate max-w-[180px]">{selectedLabel}</span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[220px] rounded-lg bg-white dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] shadow-lg overflow-hidden">
          {options.map((opt) => {
            const isActive = opt.deviceValue === value;
            return (
              <button
                key={opt.deviceValue ?? "__default__"}
                type="button"
                onClick={() => {
                  onChange(opt.deviceValue);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between transition-colors cursor-pointer ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
                }`}
              >
                <span className="truncate">
                  {opt.label}
                  {opt.isDefault && (
                    <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">(Default)</span>
                  )}
                </span>
                {isActive && (
                  <svg className="w-4 h-4 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function ModelSelector({
  models,
  activeModelId,
  activatingModelId,
  onSelect,
}: {
  models: TranscriptionModel[];
  activeModelId: string | null;
  activatingModelId: string | null;
  onSelect: (modelId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeModel = activeModelId ? models.find((m) => m.id === activeModelId) : null;
  const isActivating = activatingModelId !== null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isActivating}
        className="w-full rounded-lg bg-white dark:bg-[#333] border border-[#e5e5e7] dark:border-[#444] p-3 flex items-center justify-between cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        <span className="text-sm text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
          {isActivating ? "Loading model..." : (
            activeModel ? (
              <>
                <CompanyBadge modelFamily={activeModel.modelFamily} size="sm" />
                <span>{activeModel.modelFamily} — {activeModel.name}</span>
              </>
            ) : "No model selected"
          )}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg bg-white dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] shadow-lg overflow-hidden">
          {models.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
              No downloaded models. Go to Models to download one.
            </div>
          ) : (
            models.map((m) => {
              const isActive = m.id === activeModelId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={async () => {
                    if (!isActive) {
                      setOpen(false);
                      await onSelect(m.id);
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors cursor-pointer ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/30"
                      : "hover:bg-gray-100 dark:hover:bg-[#333]"
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate flex items-center gap-2 ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-900 dark:text-gray-100"
                    }`}>
                      <CompanyBadge modelFamily={m.modelFamily} size="sm" />
                      {m.modelFamily} — {m.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                      <span>{formatSize(m.sizeBytes)}</span>
                      {m.quantization && <span>{m.quantization}</span>}
                      <span>{m.languages.join(", ")}</span>
                    </div>
                  </div>
                  {isActive && (
                    <svg className="w-4 h-4 shrink-0 ml-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
