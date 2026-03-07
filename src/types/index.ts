// Domain types matching Rust backend (data-model.md)

export type SettingsSection = "general" | "history" | "models" | "macros" | "changelog" | "about";

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

export interface TranscriptionModel {
  id: string;
  name: string;
  modelFamily: string;
  variant: ModelVariant;
  sizeBytes: number;
  languages: string[];
  quantization: Quantization | null;
  downloadStatus: DownloadStatus;
  huggingfaceRepo: string;
  huggingfaceFilenames: string[];
  downloadMeta?: {
    bytesDownloaded: number;
    bytesTotal: number;
    bytesPerSecond: number;
    etaSeconds: number | null;
  };
}

export type ModelVariant =
  | "Tiny"
  | "Base"
  | "Small"
  | "Medium"
  | "LargeV2"
  | "LargeV3"
  | "LargeV3Turbo"
  | "ParakeetCTC"
  | "ParakeetTDT";

export type Quantization = "Q4_0" | "Q4_1" | "Q5_0" | "Q5_1" | "Q8_0" | "None";

export type DownloadStatus =
  | { status: "NotDownloaded" }
  | { status: "Downloading"; progressPercent: number }
  | { status: "Downloaded"; localPath: string }
  | { status: "Error"; message: string };

export interface RecordingSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  status: RecordingStatus;
  modelId: string;
  transcription: string | null;
  targetWindow: TargetWindowRef;
}

export type RecordingStatus =
  | { status: "Recording" }
  | { status: "Transcribing" }
  | { status: "Completed" }
  | { status: "Failed"; message: string };

export type TargetWindowRef =
  | { type: "ActiveWindow" }
  | { type: "WindowPicker" };

export interface HotkeyBinding {
  action: HotkeyAction;
  keyCombination: string;
  enabled: boolean;
}

export type HotkeyAction =
  | "ToggleRecording"
  | "PushToTalk"
  | "OpenTargetSelector"
  | "OpenSettings";

export interface TargetWindow {
  windowId: string;
  title: string;
  appName: string;
  processId: number;
  icon: string | null;
}

export interface UserPreferences {
  activeModelId: string | null;
  recordingMode: RecordingMode;
  hotkeys: HotkeyBinding[];
  targetMode: TargetMode;
  textInjectionMethod: TextInjectionMethod;
  overlayPosition: OverlayPosition;
  overlayOpacity: number;
  overlayVisualization: VisualizationStyle;
  overlayProcessingAnimation: ProcessingAnimation;
  overlayMode: OverlayMode;
  overlayCustomPosition: OverlayCustomPosition | null;
  selectedAudioDevice: string | null;
  inputGain: number;  // Microphone sensitivity multiplier (0.5-2.0)
  enableNoiseSuppression: boolean;
  enableStreamingTranscription: boolean;  // Show partial results while recording
  voiceMacros: VoiceMacro[];
  launchAtLogin: boolean;
  enableVad: boolean;
  vadSilenceDurationMs: number;
  enableSounds: boolean;
  enableTranslation: boolean;
  targetLanguage: string | null;
  enableAppSpecificFormatting: boolean;
  enableHistory: boolean;
  enableCorrectionHud: boolean;
  enableReviewStep: boolean;
  formattingOptions: FormattingOptions;
  clipboardFallback: boolean;
  closeBehavior: CloseBehavior;
  showTrayTooltip: boolean;
  offlineOnlyMode: boolean;
  enableTelemetry: boolean;
  autoCleanupModels: AutoCleanupSettings;
  macroPreviewTestText: string;
}

export type RecordingMode = "PushToTalk" | "Toggle";

export type TargetMode =
  | { type: "ActiveWindow" }
  | { type: "WindowPicker" };

export type TextInjectionMethod = "SimulatedKeystrokes" | "ClipboardPaste";

export type OverlayPosition =
  | "TopCenter"
  | "TopRight"
  | "BottomCenter"
  | "BottomRight";

export type VisualizationStyle = "Bars" | "Sine" | "Rainbow";

export type ProcessingAnimation = "Pulse" | "FrozenFrame" | "TypingParrot";

export type OverlayMode = "None" | "Full" | "Mini";

export interface OverlayCustomPosition {
  x: number;
  y: number;
}

export interface AudioDevice {
  name: string;
  isDefault: boolean;
}

export interface VoiceMacro {
  name: string;
  trigger: string;
  action: MacroAction;
  enabled: boolean;
  targetApps: string[];
}

export type MacroAction =
  | { type: "TypeText"; value: string }
  | { type: "PressKey"; value: string }
  | { type: "DeleteBack" }
  | { type: "InsertTemplate"; template: string; description: string }
  | { type: "RunSequence"; value: MacroSequenceStep[] };

export type MacroSequenceStep =
  | { type: "TypeText"; value: string }
  | { type: "PressKey"; value: string }
  | { type: "WaitMs"; value: number };

export interface TranscriptionResult {
  sessionId: string;
  text: string;
  durationMs: number;
}

export type CloseBehavior = "HideToTray" | "Quit";

export interface FormattingOptions {
  autoPunctuation: boolean;
  capitalizeFirstLetter: boolean;
  joinMode: JoinMode;
}

export type JoinMode = "Space" | "Newline";

export interface AutoCleanupSettings {
  enabled: boolean;
  keepCount: number;
  deleteAfterDaysUnused: number;
}

export type AudioEvent =
  | { type: "RecordingStarted" }
  | { type: "RecordingStopped" }
  | { type: "AmplitudeUpdate"; amplitudes: number[]; rms: number }
  | { type: "TranscriptionStarted" }
  | { type: "TranscriptionCompleted"; text: string };

export interface PermissionStatus {
  microphone: boolean;
  accessibility: boolean;
}

export interface CommandError {
  code: string;
  message: string;
}

export interface DownloadProgress {
  modelId: string;
  percent: number;
  bytesDownloaded: number;
  bytesTotal: number;
  bytesPerSecond: number;
  etaSeconds: number | null;
}
