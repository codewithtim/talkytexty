import { useRef, useEffect } from "react";

interface SoundwaveBarsProps {
  amplitudes: number[];
  width: number;
  height: number;
  paused?: boolean;
}

export function SoundwaveBars({ amplitudes, width, height, paused = false }: SoundwaveBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const targetAmplitudes = useRef<number[]>([]);
  const currentAmplitudes = useRef<number[]>([]);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!pausedRef.current) {
      targetAmplitudes.current =
        amplitudes.length > 0 ? amplitudes : new Array(48).fill(0);
    }
  }, [amplitudes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const numBars = 48;
    if (currentAmplitudes.current.length !== numBars) {
      currentAmplitudes.current = new Array(numBars).fill(0);
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (!pausedRef.current) {
        const target = targetAmplitudes.current;
        const current = currentAmplitudes.current;

        for (let i = 0; i < numBars; i++) {
          const raw = target[i] ?? 0;
          // Aggressively boost so even quiet speech fills most of the height
          const boosted = Math.min(raw * 14 + 0.25, 1);
          current[i] = (current[i] ?? 0) + (boosted - (current[i] ?? 0)) * 0.28;
        }
      }

      const current = currentAmplitudes.current;
      const barWidth = (width - (numBars - 1) * 2) / numBars;
      const centerY = height / 2;

      for (let i = 0; i < numBars; i++) {
        const amp = Math.min(current[i] ?? 0, 1);
        const barHeight = Math.max(4, amp * (height * 0.95));

        const x = i * (barWidth + 2);
        const y = centerY - barHeight / 2;

        ctx.shadowColor = "#3b82f6";
        ctx.shadowBlur = 8 * amp;
        ctx.fillStyle = "#2563eb";
        ctx.globalAlpha = 0.3 + amp * 0.7;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [width, height]);

  return <canvas ref={canvasRef} style={{ width, height }} className="block" />;
}
