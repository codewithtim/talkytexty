import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { AudioEvent } from "@/types";

interface UseAudioStreamReturn {
  amplitudes: number[];
  rms: number;
}

export function useAudioStream(): UseAudioStreamReturn {
  const [amplitudes, setAmplitudes] = useState<number[]>([]);
  const [rms, setRms] = useState(0);

  useEffect(() => {
    const unlisten = listen<AudioEvent>("amplitude-update", (event) => {
      const payload = event.payload;
      if (payload.type === "AmplitudeUpdate") {
        setAmplitudes(payload.amplitudes);
        setRms(payload.rms);
      }
    });

    return () => {
      void unlisten.then((f) => f());
    };
  }, []);

  return { amplitudes, rms };
}
