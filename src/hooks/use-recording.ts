import { useState, useCallback, useRef, useEffect } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { emit } from "@tauri-apps/api/event";
import type { TranscriptionResult, AudioEvent, UserPreferences, PermissionStatus } from "@/types";

type RecordingState = "idle" | "recording" | "transcribing" | "injecting";

interface UseRecordingReturn {
  state: RecordingState;
  error: string | null;
  lastResult: TranscriptionResult | null;
  startRecording: () => Promise<string>;
  stopRecording: () => Promise<TranscriptionResult>;
  cancelRecording: () => Promise<void>;
  injectText: (text: string) => Promise<void>;
}

export function useRecording(
  onAmplitude?: (amplitudes: number[], rms: number) => void,
): UseRecordingReturn {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(
    null,
  );
  const channelRef = useRef<Channel<AudioEvent> | null>(null);
  const stateRef = useRef<RecordingState>("idle");
  stateRef.current = state;

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Check permissions before starting — both mic and accessibility are required
      const perms = await invoke<PermissionStatus>("check_permissions");
      if (!perms.microphone || !perms.accessibility) {
        const missing = [];
        if (!perms.microphone) missing.push("Microphone");
        if (!perms.accessibility) missing.push("Accessibility");
        throw new Error(
          `${missing.join(" and ")} permission${missing.length > 1 ? "s" : ""} required. Grant access in the permission banner above.`,
        );
      }

      const channel = new Channel<AudioEvent>();
      channel.onmessage = (event: AudioEvent) => {
        if (event.type === "AmplitudeUpdate" && onAmplitude) {
          onAmplitude(event.amplitudes, event.rms);
        }
      };
      channelRef.current = channel;

      const sessionId = await invoke<string>("start_recording", {
        onEvent: channel,
      });
      setState("recording");
      return sessionId;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setState("idle");
      throw e;
    }
  }, [onAmplitude]);

  const stopRecording = useCallback(async () => {
    try {
      setState("transcribing");

      const channel = new Channel<AudioEvent>();
      channelRef.current = channel;

      const result = await invoke<TranscriptionResult>("stop_recording", {
        onEvent: channel,
      });
      setLastResult(result);

      if (result.text) {
        // Fetch current preferences from Rust to get the latest target mode
        const prefs = await invoke<UserPreferences>("get_preferences");

        if (prefs.targetMode.type === "WindowPicker") {
          await emit("show-picker", { text: result.text });
        } else {
          setState("injecting");
          await invoke("inject_text", { text: result.text });
        }
      }

      setState("idle");
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setState("idle");
      throw e;
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    try {
      await invoke("cancel_recording");
      setState("idle");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setState("idle");
    }
  }, []);

  const injectText = useCallback(async (text: string) => {
    try {
      setError(null);
      await invoke("inject_text", { text });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      throw e;
    }
  }, []);

  // Listen for hotkey events from the backend (supports toggle and push-to-talk)
  useEffect(() => {
    const unlisten1 = listen("hotkey-start-recording", () => {
      if (stateRef.current === "idle") {
        void startRecording();
      }
    });

    const unlisten2 = listen("hotkey-stop-recording", () => {
      if (stateRef.current === "recording") {
        void stopRecording();
      }
    });

    const unlisten3 = listen("hotkey-cancel-recording", () => {
      if (stateRef.current === "recording") {
        void cancelRecording();
      }
    });

    return () => {
      void unlisten1.then((f) => f());
      void unlisten2.then((f) => f());
      void unlisten3.then((f) => f());
    };
  }, [startRecording, stopRecording, cancelRecording]);

  return {
    state,
    error,
    lastResult,
    startRecording,
    stopRecording,
    cancelRecording,
    injectText,
  };
}
