import type { VisualizationStyle } from "@/types";
import { VISUALIZATIONS } from "@/components/visualizations";

interface FrozenFrameAnimationProps {
  width: number;
  height: number;
  visualization: VisualizationStyle;
  lastAmplitudes: number[];
}

export function FrozenFrameAnimation({
  width,
  height,
  visualization,
  lastAmplitudes,
}: FrozenFrameAnimationProps) {
  const VizComponent = VISUALIZATIONS[visualization].component;
  return (
    <div style={{ width, height, opacity: 0.5 }}>
      <VizComponent
        amplitudes={lastAmplitudes}
        width={width}
        height={height}
        paused={true}
      />
    </div>
  );
}
