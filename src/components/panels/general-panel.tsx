import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePreferences } from "@/hooks/use-preferences";
import { useModels } from "@/hooks/use-models";
import { HotkeyRecorder } from "@/components/hotkey-recorder";
import { VISUALIZATIONS } from "@/components/visualizations";
import { PROCESSING_ANIMATIONS } from "@/components/processing-animations";
import type { VisualizationStyle, ProcessingAnimation, AudioDevice, TranscriptionModel, RecordingMode, HotkeyBinding } from "@/types";

const STYLE_KEYS: VisualizationStyle[] = ["Bars", "Sine", "Rainbow"];
const PROCESSING_ANIM_KEYS: ProcessingAnimation[] = ["Pulse", "FrozenFrame"];

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
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">General</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Voice transcription settings</p>

      {/* Active Model */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">Active Model</h2>
        <ModelSelector
          models={downloadedModels}
          activeModelId={preferences?.activeModelId ?? null}
          activatingModelId={activatingModelId}
          onSelect={setActiveModel}
        />
      </section>

      {/* Microphone */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">Microphone</h2>
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
      </section>

      {/* Recording Mode */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">Recording Mode</h2>
        <RecordingModeSelector
          value={preferences?.recordingMode ?? "Toggle"}
          onChange={async (mode) => {
            if (!preferences) return;
            // Switch recording mode and toggle the corresponding hotkey bindings
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
      </section>

      {/* Recording Hotkey */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">Recording Hotkey</h2>
        <div className="rounded-lg bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] p-3">
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
        </div>
      </section>

      {/* Text Injection */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">Text Injection</h2>
        <div className="rounded-lg bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] p-3">
          <p className="text-sm text-gray-900 dark:text-gray-100">
            {preferences?.textInjectionMethod === "ClipboardPaste"
              ? "Clipboard Paste"
              : "Simulated Keystrokes"}
          </p>
        </div>
      </section>

      {/* Target Window */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">Target Window</h2>
        <TargetModeSelector
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
      </section>

      {/* Visualization Style */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">Visualization</h2>
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
      </section>

      {/* Processing Animation */}
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-1">Processing Animation</h2>
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
      </section>
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
                ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500"
                : "bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] hover:border-gray-400 dark:hover:border-gray-500"
            }`}
          >
            <div className="rounded bg-gray-900/90 dark:bg-gray-900 p-1.5 w-full flex items-center justify-center">
              <VizComponent amplitudes={amplitudes} width={120} height={32} />
            </div>
            <span
              className={`text-xs font-medium ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
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
    <div className="grid grid-cols-2 gap-3">
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
                ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500"
                : "bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] hover:border-gray-400 dark:hover:border-gray-500"
            }`}
          >
            <span
              className={`text-sm font-medium ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
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

  // Close on outside click
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
        className="w-full rounded-lg bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] p-3 flex items-center justify-between cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
          {selectedLabel}
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
  const selectedLabel = activeModel
    ? `${activeModel.modelFamily} — ${activeModel.name}`
    : "No model selected";

  const isActivating = activatingModelId !== null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isActivating}
        className="w-full rounded-lg bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] p-3 flex items-center justify-between cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
          {isActivating ? "Loading model..." : selectedLabel}
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
                    <div className={`text-sm font-medium truncate ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-900 dark:text-gray-100"
                    }`}>
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

const TARGET_MODES: { value: "ActiveWindow" | "WindowPicker"; label: string; description: string }[] = [
  { value: "ActiveWindow", label: "Active Window", description: "Inject into currently focused window" },
  { value: "WindowPicker", label: "Window Picker", description: "Choose target window after recording" },
];

function TargetModeSelector({
  value,
  onChange,
}: {
  value: "ActiveWindow" | "WindowPicker";
  onChange: (mode: "ActiveWindow" | "WindowPicker") => void;
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

  const current = TARGET_MODES.find((m) => m.value === value) ?? TARGET_MODES[0]!;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-lg bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] p-3 flex items-center justify-between cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <div className="text-left">
          <span className="text-sm text-gray-900 dark:text-gray-100">{current.label}</span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{current.description}</p>
        </div>
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
          {TARGET_MODES.map((mode) => {
            const isActive = mode.value === value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => {
                  onChange(mode.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors cursor-pointer ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-gray-100 dark:hover:bg-[#333]"
                }`}
              >
                <div>
                  <div className={`text-sm font-medium ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-900 dark:text-gray-100"
                  }`}>
                    {mode.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {mode.description}
                  </div>
                </div>
                {isActive && (
                  <svg className="w-4 h-4 shrink-0 ml-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

const RECORDING_MODES: { value: RecordingMode; label: string; description: string }[] = [
  { value: "Toggle", label: "Toggle", description: "Press hotkey to start, press again to stop" },
  { value: "PushToTalk", label: "Push to Talk", description: "Hold hotkey to record, release to transcribe" },
];

function RecordingModeSelector({
  value,
  onChange,
}: {
  value: RecordingMode;
  onChange: (mode: RecordingMode) => void;
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

  const current = RECORDING_MODES.find((m) => m.value === value) ?? RECORDING_MODES[0]!;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-lg bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] p-3 flex items-center justify-between cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
      >
        <div className="text-left">
          <span className="text-sm text-gray-900 dark:text-gray-100">{current.label}</span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{current.description}</p>
        </div>
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
          {RECORDING_MODES.map((mode) => {
            const isActive = mode.value === value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => {
                  onChange(mode.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors cursor-pointer ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30"
                    : "hover:bg-gray-100 dark:hover:bg-[#333]"
                }`}
              >
                <div>
                  <div className={`text-sm font-medium ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-900 dark:text-gray-100"
                  }`}>
                    {mode.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {mode.description}
                  </div>
                </div>
                {isActive && (
                  <svg className="w-4 h-4 shrink-0 ml-2 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
