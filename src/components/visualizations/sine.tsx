import { useRef, useEffect } from "react";

interface SoundwaveSineProps {
  amplitudes: number[];
  width: number;
  height: number;
  paused?: boolean;
}

const WAVES = [
  { color: "#2563eb", freqMult: 1.0, phase: 0,                alpha: 0.75, speed: 1.6, heightScale: 1.0, yOffset: -0.22 },
  { color: "#7c3aed", freqMult: 1.4, phase: Math.PI * 0.8,   alpha: 0.65, speed: 2.2, heightScale: 0.8, yOffset: -0.07 },
  { color: "#ec4899", freqMult: 1.9, phase: Math.PI * 1.5,    alpha: 0.6,  speed: 2.8, heightScale: 0.65, yOffset: 0.07 },
  { color: "#f59e0b", freqMult: 2.6, phase: Math.PI * 0.3,    alpha: 0.55, speed: 3.4, heightScale: 0.5, yOffset: 0.22 },
];

export function SoundwaveSine({ amplitudes, width, height, paused = false }: SoundwaveSineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const targetRms = useRef(0);
  const currentRms = useRef(0);
  const timeRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!pausedRef.current) {
      if (amplitudes.length > 0) {
        const sum = amplitudes.reduce((a, b) => a + b, 0);
        targetRms.current = sum / amplitudes.length;
      } else {
        targetRms.current = 0;
      }
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

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (!pausedRef.current) {
        currentRms.current += (targetRms.current - currentRms.current) * 0.22;
        timeRef.current += 0.05;
      }

      const centerY = height / 2;
      const amp = Math.min(currentRms.current * 6, 1);

      for (const wave of WAVES) {
        ctx.beginPath();
        ctx.strokeStyle = wave.color;
        ctx.globalAlpha = wave.alpha;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = wave.color;
        ctx.shadowBlur = 8 * amp;

        const waveCenter = centerY + wave.yOffset * height;
        const waveHeight = amp * (height * 0.32) * wave.heightScale;

        for (let x = 0; x <= width; x++) {
          const t = (x / width) * Math.PI * 4 * wave.freqMult;
          const y = waveCenter + Math.sin(t + timeRef.current * wave.speed + wave.phase) * waveHeight;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
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
