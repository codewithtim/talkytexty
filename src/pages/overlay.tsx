import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { RecordingPill } from "@/components/recording-pill";
import { useAudioStream } from "@/hooks/use-audio-stream";
import { formatHotkeyForDisplay } from "@/utils/format-hotkey";
import type { VisualizationStyle, ProcessingAnimation, OverlayMode, UserPreferences } from "@/types";

export function OverlayPage() {
  const [visible, setVisible] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [warningState, setWarningState] = useState<string | null>(null);
  const [visualization, setVisualization] = useState<VisualizationStyle>("Bars");
  const [processingAnimation, setProcessingAnimation] = useState<ProcessingAnimation>("Pulse");
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("Full");
  const [hotkeyDisplay, setHotkeyDisplay] = useState<string>("");
  const [micName, setMicName] = useState<string>("Default");
  const [isDragging, setIsDragging] = useState(false);
  const { amplitudes, rms } = useAudioStream();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lowAudioSinceRef = useRef<number | null>(null);

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
        setOverlayMode(prefs.overlayMode ?? "Full");
        extractPrefsDisplay(prefs);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!visible || processing) {
      setWarningState(null);
      lowAudioSinceRef.current = null;
      return;
    }

    const threshold = 0.008;
    const now = Date.now();

    if (rms > 0 && rms < threshold) {
      if (lowAudioSinceRef.current == null) {
        lowAudioSinceRef.current = now;
      }
      const elapsed = now - lowAudioSinceRef.current;
      if (elapsed > 1500) {
        setWarningState("Low mic level");
      }
    } else {
      lowAudioSinceRef.current = null;
      setWarningState(null);
    }
  }, [rms, visible, processing]);

  // Recording lifecycle events
  useEffect(() => {
    const unlistenState = listen<{ state: string; message?: string }>("overlay-state", (event) => {
      const state = event.payload.state;
      const message = event.payload.message ?? null;
      if (state === "idle") {
        setVisible(false);
        setProcessing(false);
        setSuccess(false);
        setErrorState(null);
        setWarningState(null);
        lowAudioSinceRef.current = null;
      } else if (state === "recording") {
        setVisible(true);
        setProcessing(false);
        setSuccess(false);
        setErrorState(null);
        setWarningState(null);
        lowAudioSinceRef.current = null;
      } else if (state === "transcribing" || state === "injecting") {
        setVisible(true);
        setProcessing(true);
        setSuccess(false);
        setErrorState(null);
        setWarningState(null);
        lowAudioSinceRef.current = null;
      } else if (state === "error") {
        setVisible(true);
        setProcessing(false);
        setSuccess(false);
        setErrorState(message || "Error");
        setWarningState(null);
        lowAudioSinceRef.current = null;
      }
    });

    const unlisten1 = listen("recording-started", () => {
      // Re-fetch preferences each time recording starts in case they changed
      invoke<UserPreferences>("get_preferences")
        .then((prefs) => {
          setVisualization(prefs.overlayVisualization);
          setProcessingAnimation(prefs.overlayProcessingAnimation);
          setOverlayMode(prefs.overlayMode ?? "Full");
          extractPrefsDisplay(prefs);
        })
        .catch(() => { });
      setVisible(true);
      setProcessing(false);
    });
    const unlisten2 = listen("recording-stopped", () => {
      setProcessing(true);
    });
    const unlisten3 = listen("transcription-completed", () => {
      setProcessing(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setVisible(false);
      }, 2000);
    });
    const unlisten4 = listen("recording-cancelled", () => {
      setVisible(false);
      setProcessing(false);
      setSuccess(false);
    });

    return () => {
      void unlistenState.then((f) => f());
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

  return (
    <div className="flex items-center justify-center h-screen bg-transparent">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onMouseDown={handleMouseDown}
            className={isDragging ? "cursor-grabbing" : "cursor-grab"}
          >
            <RecordingPill
              amplitudes={amplitudes}
              isRecording={!processing}
              isProcessing={processing}
              visualization={visualization}
              processingAnimation={processingAnimation}
              overlayMode={overlayMode}
              hotkey={hotkeyDisplay || undefined}
              micName={micName}
              isSuccess={success}
              errorMessage={errorState || undefined}
              warningMessage={warningState || undefined}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
