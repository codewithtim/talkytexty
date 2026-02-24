import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { RecordingPill } from "@/components/recording-pill";
import { useAudioStream } from "@/hooks/use-audio-stream";
import { formatHotkeyForDisplay } from "@/utils/format-hotkey";
import type { VisualizationStyle, ProcessingAnimation, UserPreferences } from "@/types";

export function OverlayPage() {
  const [visible, setVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [visualization, setVisualization] = useState<VisualizationStyle>("Bars");
  const [processingAnimation, setProcessingAnimation] = useState<ProcessingAnimation>("Pulse");
  const [hotkeyDisplay, setHotkeyDisplay] = useState<string>("");
  const [micName, setMicName] = useState<string>("Default");
  const [isDragging, setIsDragging] = useState(false);
  const { amplitudes } = useAudioStream();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract display hotkey and mic name from preferences
  const extractPrefsDisplay = (prefs: UserPreferences) => {
    const mode = prefs.recordingMode;
    const action = mode === "PushToTalk" ? "PushToTalk" : "ToggleRecording";
    const binding = prefs.hotkeys.find((h) => h.action === action && h.enabled);
    if (binding) {
      setHotkeyDisplay(formatHotkeyForDisplay(binding.keyCombination));
    }
    setMicName(prefs.selectedAudioDevice ?? "Default");
  };

  // Fetch preferences on mount
  useEffect(() => {
    invoke<UserPreferences>("get_preferences")
      .then((prefs) => {
        setVisualization(prefs.overlayVisualization);
        setProcessingAnimation(prefs.overlayProcessingAnimation);
        extractPrefsDisplay(prefs);
      })
      .catch(() => {});
  }, []);

  // Recording lifecycle events
  useEffect(() => {
    const unlisten1 = listen("recording-started", () => {
      // Re-fetch preferences each time recording starts in case they changed
      invoke<UserPreferences>("get_preferences")
        .then((prefs) => {
          setVisualization(prefs.overlayVisualization);
          setProcessingAnimation(prefs.overlayProcessingAnimation);
          extractPrefsDisplay(prefs);
        })
        .catch(() => {});
      setVisible(true);
      setProcessing(false);
    });
    const unlisten2 = listen("recording-stopped", () => {
      setProcessing(true);
    });
    const unlisten3 = listen("transcription-completed", () => {
      setVisible(false);
      setProcessing(false);
    });
    const unlisten4 = listen("recording-cancelled", () => {
      setVisible(false);
      setProcessing(false);
    });

    return () => {
      void unlisten1.then((f) => f());
      void unlisten2.then((f) => f());
      void unlisten3.then((f) => f());
      void unlisten4.then((f) => f());
    };
  }, []);

  // Save position after drag (debounced)
  useEffect(() => {
    const unlisten = getCurrentWindow().onMoved((event) => {
      const { x, y } = event.payload;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const prefs = await invoke<UserPreferences>("get_preferences");
          await invoke("update_preferences", {
            preferences: { ...prefs, overlayCustomPosition: { x, y } },
          });
        } catch {
          // Silently ignore save failures
        }
      }, 500);
    });

    return () => {
      void unlisten.then((f) => f());
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleMouseDown = async () => {
    setIsDragging(true);
    try {
      await getCurrentWindow().startDragging();
    } finally {
      setIsDragging(false);
    }
  };

  if (!visible) {
    return <div className="h-screen bg-transparent" />;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-transparent">
      <div
        onMouseDown={handleMouseDown}
        className={isDragging ? "cursor-grabbing" : "cursor-grab"}
      >
        <RecordingPill
          amplitudes={amplitudes}
          isRecording={!processing}
          isProcessing={processing}
          visualization={visualization}
          processingAnimation={processingAnimation}
          hotkey={hotkeyDisplay || undefined}
          micName={micName}
        />
      </div>
    </div>
  );
}
