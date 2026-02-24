import { describe, it, expect, vi, afterEach } from "vitest";
import { formatHotkeyForDisplay } from "./format-hotkey";

describe("formatHotkeyForDisplay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("on macOS", () => {
    it("formats CommandOrControl+Shift+Space", () => {
      vi.stubGlobal("navigator", { platform: "MacIntel" });
      expect(formatHotkeyForDisplay("CommandOrControl+Shift+Space")).toBe("⌘⇧Space");
    });

    it("formats Alt as Option symbol", () => {
      vi.stubGlobal("navigator", { platform: "MacIntel" });
      expect(formatHotkeyForDisplay("CommandOrControl+Alt+K")).toBe("⌘⌥K");
    });

    it("formats single modifier + key", () => {
      vi.stubGlobal("navigator", { platform: "MacIntel" });
      expect(formatHotkeyForDisplay("CommandOrControl+Space")).toBe("⌘Space");
    });

    it("formats Command key directly", () => {
      vi.stubGlobal("navigator", { platform: "MacIntel" });
      expect(formatHotkeyForDisplay("Command+Shift+A")).toBe("⌘⇧A");
    });
  });

  describe("on non-Mac", () => {
    it("formats CommandOrControl+Shift+Space", () => {
      vi.stubGlobal("navigator", { platform: "Win32" });
      expect(formatHotkeyForDisplay("CommandOrControl+Shift+Space")).toBe("Ctrl+Shift+Space");
    });

    it("formats Alt key", () => {
      vi.stubGlobal("navigator", { platform: "Win32" });
      expect(formatHotkeyForDisplay("CommandOrControl+Alt+K")).toBe("Ctrl+Alt+K");
    });
  });
});
