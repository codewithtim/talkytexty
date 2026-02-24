// T059: Frontend test for HotkeyRecorder component
//
// Tests verify:
// - Displays current binding
// - Enters recording mode on click
// - Captures key combination and calls onRecord
// - Shows cancel button in recording mode
// - Handles cancel correctly

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HotkeyRecorder } from "./hotkey-recorder";

describe("HotkeyRecorder", () => {
  it("displays the current binding", () => {
    render(
      <HotkeyRecorder
        currentBinding="CommandOrControl+Shift+Space"
        onRecord={vi.fn()}
      />,
    );
    expect(
      screen.getByText("CommandOrControl+Shift+Space"),
    ).toBeInTheDocument();
  });

  it("shows 'Not set' when binding is empty", () => {
    render(<HotkeyRecorder currentBinding="" onRecord={vi.fn()} />);
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("enters recording mode on click and shows prompt text", () => {
    render(
      <HotkeyRecorder currentBinding="CommandOrControl+K" onRecord={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("CommandOrControl+K"));
    expect(screen.getByText("Press a key combination...")).toBeInTheDocument();
  });

  it("shows Cancel button in recording mode", () => {
    render(<HotkeyRecorder currentBinding="Alt+R" onRecord={vi.fn()} />);
    fireEvent.click(screen.getByText("Alt+R"));
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("cancels recording and restores original binding on Cancel click", () => {
    render(
      <HotkeyRecorder
        currentBinding="CommandOrControl+Shift+V"
        onRecord={vi.fn()}
      />,
    );
    // Enter recording mode
    fireEvent.click(screen.getByText("CommandOrControl+Shift+V"));
    expect(screen.getByText("Press a key combination...")).toBeInTheDocument();

    // Click Cancel
    fireEvent.click(screen.getByText("Cancel"));
    // Should show original binding again
    expect(screen.getByText("CommandOrControl+Shift+V")).toBeInTheDocument();
  });

  it("does not enter recording mode when disabled", () => {
    render(
      <HotkeyRecorder
        currentBinding="CommandOrControl+K"
        onRecord={vi.fn()}
        disabled={true}
      />,
    );
    fireEvent.click(screen.getByText("CommandOrControl+K"));
    // Should still show the binding, not the recording prompt
    expect(screen.getByText("CommandOrControl+K")).toBeInTheDocument();
    expect(
      screen.queryByText("Press a key combination..."),
    ).not.toBeInTheDocument();
  });

  it("captures key combination and calls onRecord on keyup", () => {
    const onRecord = vi.fn();
    render(<HotkeyRecorder currentBinding="Alt+R" onRecord={onRecord} />);

    // Enter recording mode
    fireEvent.click(screen.getByText("Alt+R"));

    // Simulate Cmd+Shift+K keydown
    fireEvent.keyDown(window, {
      key: "K",
      metaKey: true,
      shiftKey: true,
    });

    // Simulate keyup to confirm
    fireEvent.keyUp(window, { key: "K" });

    expect(onRecord).toHaveBeenCalledWith("CommandOrControl+Shift+K");
  });

  it("ignores modifier-only keypresses", () => {
    const onRecord = vi.fn();
    render(<HotkeyRecorder currentBinding="Alt+R" onRecord={onRecord} />);

    fireEvent.click(screen.getByText("Alt+R"));

    // Press only Shift
    fireEvent.keyDown(window, { key: "Shift", shiftKey: true });
    fireEvent.keyUp(window, { key: "Shift" });

    expect(onRecord).not.toHaveBeenCalled();
  });
});
