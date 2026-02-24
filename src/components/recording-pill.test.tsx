import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecordingPill } from "./recording-pill";

// Mock canvas for visualization child components
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    scale: vi.fn(),
    roundRect: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: "",
    shadowBlur: 0,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RecordingPill", () => {
  it("shows red dot without text label when recording", () => {
    const { container } = render(
      <RecordingPill
        amplitudes={[0.5]}
        isRecording={true}
        isProcessing={false}
      />,
    );
    expect(container.querySelector(".bg-red-500")).toBeInTheDocument();
    expect(screen.queryByText("Recording")).not.toBeInTheDocument();
  });

  it("renders with 'Processing...' label when processing", () => {
    render(
      <RecordingPill amplitudes={[]} isRecording={false} isProcessing={true} />,
    );
    expect(screen.getByText("Processing...")).toBeInTheDocument();
  });

  it("shows canvas visualization when recording", () => {
    const { container } = render(
      <RecordingPill
        amplitudes={[0.5, 0.8]}
        isRecording={true}
        isProcessing={false}
      />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("shows pulse animation when processing with Pulse mode", () => {
    const { container } = render(
      <RecordingPill
        amplitudes={[]}
        isRecording={false}
        isProcessing={true}
        processingAnimation="Pulse"
      />,
    );
    const pulseDiv = container.querySelector(".animate-pulse-glow");
    expect(pulseDiv).toBeInTheDocument();
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
  });

  it("shows frozen visualization when processing with FrozenFrame mode", () => {
    const { container } = render(
      <RecordingPill
        amplitudes={[0.5, 0.8]}
        isRecording={false}
        isProcessing={true}
        processingAnimation="FrozenFrame"
      />,
    );
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("shows red pulsing indicator when recording", () => {
    const { container } = render(
      <RecordingPill amplitudes={[]} isRecording={true} isProcessing={false} />,
    );
    const dot = container.querySelector(".bg-red-500");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("animate-pulse");
  });

  it("shows yellow pulsing indicator when processing", () => {
    const { container } = render(
      <RecordingPill amplitudes={[]} isRecording={false} isProcessing={true} />,
    );
    const dot = container.querySelector(".bg-yellow-500");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("animate-pulse");
  });

  it("renders vertical layout with rounded-2xl", () => {
    const { container } = render(
      <RecordingPill amplitudes={[]} isRecording={true} isProcessing={false} />,
    );
    const pill = container.firstChild as HTMLElement;
    expect(pill).toHaveClass("rounded-2xl");
    expect(pill).toHaveClass("flex-col");
    expect(pill).toHaveClass("items-center");
  });

  it("displays hotkey next to red dot when recording", () => {
    render(
      <RecordingPill
        amplitudes={[]}
        isRecording={true}
        isProcessing={false}
        hotkey="⌘⇧Space"
      />,
    );
    expect(screen.getByText("⌘⇧Space")).toBeInTheDocument();
  });

  it("does not display hotkey when not provided", () => {
    render(
      <RecordingPill amplitudes={[]} isRecording={true} isProcessing={false} />,
    );
    expect(screen.queryByText("⌘⇧Space", { exact: false })).not.toBeInTheDocument();
  });
});
