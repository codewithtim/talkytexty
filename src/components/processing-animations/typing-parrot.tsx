import { useEffect, useRef } from "react";

interface TypingParrotAnimationProps {
  width: number;
  height: number;
}

// 8-bit pixel scale
const PX = 3;

// Parrot body colors
const BODY_COLOR = "#4CAF50";
const BELLY_COLOR = "#81C784";
const WING_COLOR = "#388E3C";
const BEAK_COLOR = "#FF9800";
const EYE_COLOR = "#212121";
const EYE_HIGHLIGHT = "#FFFFFF";
const TAIL_COLOR = "#2E7D32";
const FEET_COLOR = "#FF9800";

// Keyboard colors
const KB_BASE = "#424242";
const KB_KEY = "#616161";
const KB_KEY_ACTIVE = "#9E9E9E";

function drawParrot(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  wingUp: boolean,
) {
  const p = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * PX, oy + y * PX, w * PX, h * PX);
  };

  // Tail feathers (behind body)
  p(-2, 6, 2, 1, TAIL_COLOR);
  p(-3, 7, 2, 1, TAIL_COLOR);
  p(-4, 8, 2, 2, TAIL_COLOR);

  // Body
  p(0, 2, 5, 7, BODY_COLOR);
  // Belly
  p(1, 4, 3, 4, BELLY_COLOR);

  // Head (on top of body)
  p(1, 0, 4, 3, BODY_COLOR);

  // Beak
  p(5, 1, 2, 1, BEAK_COLOR);
  p(5, 2, 1, 1, BEAK_COLOR);

  // Eye
  p(3, 1, 1, 1, EYE_COLOR);
  // Eye highlight — only draw if pixel is large enough to see
  if (PX >= 3) {
    ctx.fillStyle = EYE_HIGHLIGHT;
    ctx.fillRect(ox + 3 * PX + 1, oy + 1 * PX, 1, 1);
  }

  // Wing
  if (wingUp) {
    p(0, 3, 2, 3, WING_COLOR);
  } else {
    p(0, 5, 2, 3, WING_COLOR);
  }

  // Feet
  p(1, 9, 1, 1, FEET_COLOR);
  p(3, 9, 1, 1, FEET_COLOR);
}

function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  kbWidth: number,
  activeKey: number,
) {
  // Keyboard base
  ctx.fillStyle = KB_BASE;
  ctx.fillRect(ox, oy, kbWidth, PX * 4);

  // Draw keys in 2 rows
  const keyW = PX * 2;
  const gap = 1;
  const keysPerRow = Math.floor((kbWidth - gap) / (keyW + gap));
  for (let row = 0; row < 2; row++) {
    const rowOffset = row === 1 ? PX * 0.5 : 0; // stagger second row
    for (let k = 0; k < keysPerRow; k++) {
      const idx = row * keysPerRow + k;
      ctx.fillStyle = idx === activeKey ? KB_KEY_ACTIVE : KB_KEY;
      ctx.fillRect(
        ox + gap + k * (keyW + gap) + rowOffset,
        oy + gap + row * (PX + gap),
        keyW,
        PX,
      );
    }
  }
}

export function TypingParrotAnimation({
  width,
  height,
}: TypingParrotAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let frame = 0;
    let rafId: number;

    const TYPING_SPEED = 8; // frames between key presses
    const kbWidth = PX * 18;
    const kbHeight = PX * 4;

    // Center the scene
    const parrotW = PX * 7;
    const parrotH = PX * 10;
    const sceneW = parrotW + kbWidth + PX * 2;
    const sceneH = Math.max(parrotH, kbHeight) + PX;
    const sceneX = (width - sceneW) / 2;
    const sceneY = (height - sceneH) / 2;

    const keysPerRow = Math.floor((kbWidth - 1) / (PX * 2 + 1));
    const totalKeys = keysPerRow * 2;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      const wingUp = Math.floor(frame / TYPING_SPEED) % 2 === 0;
      const activeKey = Math.floor(frame / TYPING_SPEED) % totalKeys;

      // Draw parrot — position so feet sit on keyboard top
      const kbY = sceneY + sceneH - kbHeight;
      const parrotX = sceneX;
      const parrotY = kbY - parrotH + PX; // feet rest on keyboard level

      drawParrot(ctx, parrotX, parrotY, wingUp);

      // Draw keyboard to the right of the parrot
      const kbX = parrotX + parrotW + PX;
      drawKeyboard(ctx, kbX, kbY, kbWidth, activeKey);

      frame++;
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="rounded-lg"
    />
  );
}
