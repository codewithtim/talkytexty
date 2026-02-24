import type { ProcessingAnimation } from "@/types";

export { PulseAnimation } from "./pulse";
export { FrozenFrameAnimation } from "./frozen-frame";
export { TypingParrotAnimation } from "./typing-parrot";

export interface ProcessingAnimationEntry {
  name: string;
  description: string;
}

export const PROCESSING_ANIMATIONS: Record<ProcessingAnimation, ProcessingAnimationEntry> = {
  Pulse: {
    name: "Pulse Glow",
    description: "Subtle breathing glow effect",
  },
  FrozenFrame: {
    name: "Frozen Frame",
    description: "Freezes the last visualization state",
  },
  TypingParrot: {
    name: "Typing Parrot",
    description: "8-bit pixel parrot typing on a keyboard",
  },
};
