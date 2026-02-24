import { useRef } from "react";
import type { VisualizationStyle, ProcessingAnimation } from "@/types";
import { VISUALIZATIONS } from "./visualizations";
import { PulseAnimation } from "./processing-animations/pulse";
import { FrozenFrameAnimation } from "./processing-animations/frozen-frame";
import { TypingParrotAnimation } from "./processing-animations/typing-parrot";

interface RecordingPillProps {
  amplitudes: number[];
  isRecording: boolean;
  isProcessing: boolean;
  visualization?: VisualizationStyle;
  processingAnimation?: ProcessingAnimation;
  hotkey?: string;
}

const VIZ_WIDTH = 240;
const VIZ_HEIGHT = 56;

export function RecordingPill({
  amplitudes,
  isRecording,
  isProcessing,
  visualization = "Bars",
  processingAnimation = "Pulse",
  hotkey,
}: RecordingPillProps) {
  const label = isProcessing ? "Processing..." : "Recording";
  const lastAmplitudesRef = useRef<number[]>([]);

  // Capture last amplitudes while recording for FrozenFrame
  if (isRecording && amplitudes.length > 0) {
    lastAmplitudesRef.current = amplitudes;
  }

  const vizEntry = VISUALIZATIONS[visualization];
  const VizComponent = vizEntry.component;

  const renderVisualization = () => {
    if (isRecording) {
      return (
        <VizComponent
          amplitudes={amplitudes}
          width={VIZ_WIDTH}
          height={VIZ_HEIGHT}
        />
      );
    }

    // Processing state
    if (processingAnimation === "FrozenFrame") {
      return (
        <FrozenFrameAnimation
          width={VIZ_WIDTH}
          height={VIZ_HEIGHT}
          visualization={visualization}
          lastAmplitudes={lastAmplitudesRef.current}
        />
      );
    }

    if (processingAnimation === "TypingParrot") {
      return <TypingParrotAnimation width={VIZ_WIDTH} height={VIZ_HEIGHT} />;
    }

    // Default: Pulse
    return <PulseAnimation width={VIZ_WIDTH} height={VIZ_HEIGHT} />;
  };

  return (
    <div className="rounded-2xl bg-gray-900/90 backdrop-blur-md px-5 py-4 flex flex-col items-center gap-3 shadow-lg border border-gray-700/50">
      {/* Visualization area on top */}
      <div
        style={{ width: VIZ_WIDTH, height: VIZ_HEIGHT }}
        className="shrink-0 rounded-lg overflow-hidden"
      >
        {renderVisualization()}
      </div>

      {/* Status row: dot + hotkey on the same line */}
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full shrink-0 ${
            isRecording
              ? "bg-red-500 animate-pulse"
              : "bg-yellow-500 animate-pulse"
          }`}
        />
        {isProcessing && (
          <span className="text-white text-base font-medium whitespace-nowrap">
            {label}
          </span>
        )}
        {hotkey && isRecording && (
          <span className="text-gray-400 text-xs font-mono">{hotkey}</span>
        )}
      </div>
    </div>
  );
}
