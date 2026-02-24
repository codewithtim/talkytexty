interface PulseAnimationProps {
  width: number;
  height: number;
}

export function PulseAnimation({ width, height }: PulseAnimationProps) {
  return (
    <div
      style={{ width, height }}
      className="rounded-lg bg-blue-500/20 animate-pulse-glow"
    />
  );
}
