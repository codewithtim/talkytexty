import { useRef, useEffect } from "react";

interface SoundwaveRainbowProps {
  amplitudes: number[];
  width: number;
  height: number;
  paused?: boolean;
}

type RGB = [number, number, number];

function barColor(index: number, total: number): string {
  // Gradient: blue → purple → pink → amber → orange
  const t = index / (total - 1);
  const colors: RGB[] = [
    [37, 99, 235],    // #2563eb blue
    [124, 58, 237],   // #7c3aed purple
    [236, 72, 153],   // #ec4899 pink
    [245, 158, 11],   // #f59e0b amber
    [249, 115, 22],   // #f97316 orange
  ];

  const segment = t * (colors.length - 1);
  const i = Math.min(Math.floor(segment), colors.length - 2);
  const frac = segment - i;

  const c0 = colors[i]!;
  const c1 = colors[i + 1]!;
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * frac);

  return `rgb(${r},${g},${b})`;
}

export function SoundwaveRainbow({ amplitudes, width, height, paused = false }: SoundwaveRainbowProps) {
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

        const color = barColor(i, numBars);
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 * amp;
        ctx.fillStyle = color;
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
