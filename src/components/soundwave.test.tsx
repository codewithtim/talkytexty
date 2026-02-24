import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SoundwaveBars } from "./visualizations/bars";

// Mock canvas context for jsdom
function createMockCanvasContext(): Partial<CanvasRenderingContext2D> {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    scale: vi.fn(),
    roundRect: vi.fn(),
    fillStyle: "",
    globalAlpha: 1,
  };
}

describe("SoundwaveBars", () => {
  let rafCallbacks: FrameRequestCallback[];
  let mockCtx: Partial<CanvasRenderingContext2D>;

  beforeEach(() => {
    rafCallbacks = [];
    mockCtx = createMockCanvasContext();

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => mockCtx as CanvasRenderingContext2D,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a canvas element", () => {
    const { container } = render(
      <SoundwaveBars amplitudes={[]} width={200} height={40} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("applies width and height via inline style", () => {
    const { container } = render(
      <SoundwaveBars amplitudes={[]} width={300} height={60} />,
    );
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas.style.width).toBe("300px");
    expect(canvas.style.height).toBe("60px");
  });

  it("starts requestAnimationFrame on mount", () => {
    render(<SoundwaveBars amplitudes={[0.5, 0.8]} width={200} height={40} />);
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it("cancels animation frame on unmount", () => {
    const { unmount } = render(
      <SoundwaveBars amplitudes={[0.5]} width={200} height={40} />,
    );
    unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("draws bars on the canvas when amplitude data is provided", () => {
    render(
      <SoundwaveBars amplitudes={[0.5, 0.8, 0.3]} width={200} height={40} />,
    );

    const lastCb = rafCallbacks[rafCallbacks.length - 1];
    if (lastCb) lastCb(performance.now());

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it("draws bars even with empty amplitudes (uses zero-filled array)", () => {
    render(<SoundwaveBars amplitudes={[]} width={200} height={40} />);

    const lastCb = rafCallbacks[rafCallbacks.length - 1];
    if (lastCb) lastCb(performance.now());

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it("has the block className on the canvas", () => {
    const { container } = render(
      <SoundwaveBars amplitudes={[]} width={200} height={40} />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toHaveClass("block");
  });
});
