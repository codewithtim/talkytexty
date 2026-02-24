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
        const targetLen = target.length;

        for (let i = 0; i < numBars; i++) {
          // Map bar index to amplitude data — spread source across all bars
          const srcIdx = targetLen > 0 ? Math.floor((i / numBars) * targetLen) : 0;
          const raw = target[srcIdx] ?? 0;

          // Light boost, no artificial baseline — silence = flat
          const boosted = Math.min(raw * 8, 1);

          const prev = current[i] ?? 0;
          // Fast attack (0.6), slower release (0.12) — snappy response, smooth decay
          const speed = boosted > prev ? 0.6 : 0.12;
          current[i] = prev + (boosted - prev) * speed;
        }
      }

      const current = currentAmplitudes.current;
      const gap = 2;
      const barWidth = (width - (numBars - 1) * gap) / numBars;
      const centerY = height / 2;
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

      ctx.shadowColor = isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.15)";

      for (let i = 0; i < numBars; i++) {
        const amp = Math.min(current[i] ?? 0, 1);
        // Minimum bar height of 3px so the waveform shape is always visible
        const barHeight = Math.max(3, amp * (height * 0.92));

        const x = i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        ctx.shadowBlur = 6 * amp;
        ctx.fillStyle = isDark ? "#d1d5db" : "#6b7280";
        ctx.globalAlpha = 0.15 + amp * 0.85;
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
