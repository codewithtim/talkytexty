// T050: Frontend test for ModelCard component
//
// Tests verify:
// - Renders model name and size
// - Shows download button when not downloaded
// - Shows activate/delete buttons when downloaded and not active
// - Shows "Active" badge when active
// - Shows progress bar when downloading
// - Shows error message when download failed

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ModelCard } from "./model-card";
import type { TranscriptionModel } from "@/types";

function makeModel(
  overrides: Partial<TranscriptionModel> = {},
): TranscriptionModel {
  return {
    id: "test-model",
    name: "Test Model",
    modelFamily: "Whisper",
    variant: "Base",
    sizeBytes: 60 * 1024 * 1024, // 60 MB
    languages: ["en"],
    quantization: "Q5_1",
    downloadStatus: { status: "NotDownloaded" },
    huggingfaceRepo: "test/repo",
    huggingfaceFilenames: ["test.bin"],
    ...overrides,
  };
}

describe("ModelCard", () => {
  const noop = vi.fn();

  it("renders model name", () => {
    render(
      <ModelCard
        model={makeModel({ name: "Base English" })}
        isActive={false}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("Base English")).toBeInTheDocument();
  });

  it("renders model size formatted as MB", () => {
    render(
      <ModelCard
        model={makeModel({ sizeBytes: 60 * 1024 * 1024 })}
        isActive={false}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("60 MB")).toBeInTheDocument();
  });

  it("renders quantization info", () => {
    render(
      <ModelCard
        model={makeModel({ quantization: "Q5_1" })}
        isActive={false}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("Q5_1")).toBeInTheDocument();
  });

  it("renders languages", () => {
    render(
      <ModelCard
        model={makeModel({ languages: ["en", "fr"] })}
        isActive={false}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("en, fr")).toBeInTheDocument();
  });

  it("shows Download button when not downloaded", () => {
    render(
      <ModelCard
        model={makeModel({ downloadStatus: { status: "NotDownloaded" } })}
        isActive={false}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("Download")).toBeInTheDocument();
  });

  it("calls onDownload when Download button is clicked", () => {
    const onDownload = vi.fn();
    render(
      <ModelCard
        model={makeModel({
          id: "my-model",
          downloadStatus: { status: "NotDownloaded" },
        })}
        isActive={false}
        onDownload={onDownload}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    fireEvent.click(screen.getByText("Download"));
    expect(onDownload).toHaveBeenCalledWith("my-model");
  });

  it("shows Activate and Delete buttons when downloaded and not active", () => {
    render(
      <ModelCard
        model={makeModel({
          downloadStatus: { status: "Downloaded", localPath: "/path" },
        })}
        isActive={false}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("Activate")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("calls onActivate when Activate button is clicked", () => {
    const onActivate = vi.fn();
    render(
      <ModelCard
        model={makeModel({
          id: "act-model",
          downloadStatus: { status: "Downloaded", localPath: "/path" },
        })}
        isActive={false}
        onDownload={noop}
        onDelete={noop}
        onActivate={onActivate}
      />,
    );
    fireEvent.click(screen.getByText("Activate"));
    expect(onActivate).toHaveBeenCalledWith("act-model");
  });

  it("calls onDelete when Delete button is clicked", () => {
    const onDelete = vi.fn();
    render(
      <ModelCard
        model={makeModel({
          id: "del-model",
          downloadStatus: { status: "Downloaded", localPath: "/path" },
        })}
        isActive={false}
        onDownload={noop}
        onDelete={onDelete}
        onActivate={noop}
      />,
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("del-model");
  });

  it("hides Activate and Delete buttons when model is active", () => {
    render(
      <ModelCard
        model={makeModel({
          downloadStatus: { status: "Downloaded", localPath: "/path" },
        })}
        isActive={true}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.queryByText("Activate")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("shows Active badge when model is active", () => {
    render(
      <ModelCard
        model={makeModel({
          downloadStatus: { status: "Downloaded", localPath: "/path" },
        })}
        isActive={true}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows progress bar when downloading", () => {
    render(
      <ModelCard
        model={makeModel({
          downloadStatus: { status: "Downloading", progressPercent: 45 },
        })}
        isActive={false}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("Downloading...")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("shows error message on download error", () => {
    render(
      <ModelCard
        model={makeModel({
          downloadStatus: { status: "Error", message: "Network timeout" },
        })}
        isActive={false}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("Error: Network timeout")).toBeInTheDocument();
  });

  it("shows loading state on download button when download is starting", () => {
    render(
      <ModelCard
        model={makeModel({ downloadStatus: { status: "NotDownloaded" } })}
        isActive={false}
        isStartingDownload={true}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("Downloading...")).toBeInTheDocument();
    expect(screen.queryByText("Download")).not.toBeInTheDocument();
  });

  it("disables download button when download is starting", () => {
    render(
      <ModelCard
        model={makeModel({ downloadStatus: { status: "NotDownloaded" } })}
        isActive={false}
        isStartingDownload={true}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /downloading/i })).toBeDisabled();
  });

  it("shows loading state on activate button when activating", () => {
    render(
      <ModelCard
        model={makeModel({
          downloadStatus: { status: "Downloaded", localPath: "/path" },
        })}
        isActive={false}
        isActivating={true}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByText("Activating...")).toBeInTheDocument();
    expect(screen.queryByText("Activate")).not.toBeInTheDocument();
  });

  it("disables activate button when activating", () => {
    render(
      <ModelCard
        model={makeModel({
          downloadStatus: { status: "Downloaded", localPath: "/path" },
        })}
        isActive={false}
        isActivating={true}
        onDownload={noop}
        onDelete={noop}
        onActivate={noop}
      />,
    );
    expect(screen.getByRole("button", { name: /activating/i })).toBeDisabled();
  });
});
