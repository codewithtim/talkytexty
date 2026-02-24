import { useRef } from "react";
import type { VisualizationStyle, ProcessingAnimation, OverlayMode } from "@/types";
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
  overlayMode?: OverlayMode;
  hotkey?: string;
  micName?: string;
}

const VIZ_WIDTH = 440;
const VIZ_PADDING = 24; // px-3 = 12px per side
const VIZ_HEIGHT = 48;

const MINI_WIDTH = 200;
const MINI_PADDING = 16; // px-2 = 8px per side
const MINI_HEIGHT = 32;

export function RecordingPill({
  amplitudes,
  isRecording,
  isProcessing,
  visualization = "Bars",
  processingAnimation = "Pulse",
  overlayMode = "Full",
  hotkey,
  micName,
}: RecordingPillProps) {
  const lastAmplitudesRef = useRef<number[]>([]);

  // Capture last amplitudes while recording for FrozenFrame
  if (isRecording && amplitudes.length > 0) {
    lastAmplitudesRef.current = amplitudes;
  }

  if (overlayMode === "None") return null;

  const vizEntry = VISUALIZATIONS[visualization];
  const VizComponent = vizEntry.component;

  const isMini = overlayMode === "Mini";
  const vizWidth = isMini ? MINI_WIDTH : VIZ_WIDTH;
  const vizPadding = isMini ? MINI_PADDING : VIZ_PADDING;
  const vizHeight = isMini ? MINI_HEIGHT : VIZ_HEIGHT;

  const renderVisualization = () => {
    if (isRecording) {
      return (
        <VizComponent
          amplitudes={amplitudes}
          width={vizWidth - vizPadding}
          height={vizHeight}
        />
      );
    }

    if (processingAnimation === "FrozenFrame") {
      return (
        <FrozenFrameAnimation
          width={vizWidth - vizPadding}
          height={vizHeight}
          visualization={visualization}
          lastAmplitudes={lastAmplitudesRef.current}
        />
      );
    }

    if (processingAnimation === "TypingParrot") {
      return <TypingParrotAnimation width={vizWidth - vizPadding} height={vizHeight} />;
    }

    return <PulseAnimation width={vizWidth - vizPadding} height={vizHeight} />;
  };

  if (isMini) {
    return (
      <div
        className="rounded-xl bg-[#f6f6f6]/95 dark:bg-[#2b2b2f]/[0.97] backdrop-blur-3xl backdrop-saturate-150 shadow-lg border border-black/[0.1] dark:border-white/[0.1] overflow-hidden flex items-center justify-center"
        style={{ width: MINI_WIDTH, height: MINI_HEIGHT + MINI_PADDING }}
      >
        {renderVisualization()}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#f6f6f6]/95 dark:bg-[#2b2b2f]/[0.97] backdrop-blur-3xl backdrop-saturate-150 flex flex-col shadow-lg border border-black/[0.1] dark:border-white/[0.1] overflow-hidden">
      {/* Visualization area */}
      <div
        style={{ width: VIZ_WIDTH, height: VIZ_HEIGHT }}
        className="shrink-0 px-3 pt-3"
      >
        {renderVisualization()}
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-black/[0.06] dark:border-white/[0.06] mt-2">
        {/* Left: mic info */}
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
          <span>{micName ?? "Default"}</span>
        </div>

        {/* Right: action labels + hotkey badges */}
        <div className="flex items-center gap-3 text-xs">
          {isRecording && (
            <>
              <span className="text-gray-700 dark:text-gray-300">Stop</span>
              {hotkey && <span className="kbd">{hotkey}</span>}
            </>
          )}
          {isProcessing && (
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">Processing...</span>
          )}
          <span className="text-gray-500 dark:text-gray-400">Cancel</span>
          <span className="kbd">esc</span>
        </div>
      </div>
    </div>
  );
}
