import type { VisualizationStyle } from "@/types";
import { SoundwaveBars } from "./bars";
import { SoundwaveSine } from "./sine";
import { SoundwaveRainbow } from "./rainbow";

export { SoundwaveBars } from "./bars";
export { SoundwaveSine } from "./sine";
export { SoundwaveRainbow } from "./rainbow";

export interface VisualizationProps {
  amplitudes: number[];
  width: number;
  height: number;
  paused?: boolean;
}

export const VISUALIZATIONS: Record<VisualizationStyle, {
  name: string;
  component: React.ComponentType<VisualizationProps>;
}> = {
  Bars: { name: "Classic Bars", component: SoundwaveBars },
  Sine: { name: "Layered Waves", component: SoundwaveSine },
  Rainbow: { name: "Rainbow Bars", component: SoundwaveRainbow },
};
