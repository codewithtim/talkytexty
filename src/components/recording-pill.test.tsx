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
  it("shows Stop label when recording", () => {
    render(
      <RecordingPill
        amplitudes={[0.5]}
        isRecording={true}
        isProcessing={false}
      />,
    );
    expect(screen.getByText("Stop")).toBeInTheDocument();
  });

  it("shows Processing label when processing", () => {
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

  it("renders with rounded-2xl container", () => {
    const { container } = render(
      <RecordingPill amplitudes={[]} isRecording={true} isProcessing={false} />,
    );
    const pill = container.firstChild as HTMLElement;
    expect(pill).toHaveClass("rounded-2xl");
    expect(pill).toHaveClass("flex-col");
  });

  it("shows hotkey badge in toolbar when recording", () => {
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

  it("always shows Cancel and esc in toolbar", () => {
    render(
      <RecordingPill amplitudes={[]} isRecording={true} isProcessing={false} />,
    );
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("esc")).toBeInTheDocument();
  });

  it("shows mic name in toolbar", () => {
    render(
      <RecordingPill
        amplitudes={[]}
        isRecording={true}
        isProcessing={false}
        micName="My Microphone"
      />,
    );
    expect(screen.getByText("My Microphone")).toBeInTheDocument();
  });

  it("shows Default when no mic name provided", () => {
    render(
      <RecordingPill amplitudes={[]} isRecording={true} isProcessing={false} />,
    );
    expect(screen.getByText("Default")).toBeInTheDocument();
  });
});
