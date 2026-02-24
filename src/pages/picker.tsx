import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import type { TargetWindow } from "@/types";

const ITEM_WIDTH = 80;
const PADDING = 24;
const MIN_WIDTH = 200;
const WINDOW_HEIGHT = 140;

export function PickerPage() {
  const [windows, setWindows] = useState<TargetWindow[]>([]);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const hidePicker = useCallback(async () => {
    setPendingText(null);
    setWindows([]);
    setSelectedIndex(0);
    await getCurrentWindow().hide();
  }, []);

  const handleSelect = useCallback(
    async (processId: number) => {
      if (!pendingText) return;
      try {
        await invoke("inject_text", {
          text: pendingText,
          targetProcessId: processId,
        });
      } catch (e) {
        console.error("[picker] inject_text failed:", e);
      }
      await hidePicker();
    },
    [pendingText, hidePicker],
  );

  const handleDismiss = useCallback(async () => {
    if (pendingText) {
      try {
        await invoke("copy_to_clipboard", { text: pendingText });
      } catch (e) {
        console.error("[picker] copy_to_clipboard failed:", e);
      }
    }
    await hidePicker();
  }, [pendingText, hidePicker]);

  // Listen for show-picker event
  useEffect(() => {
    const unlisten = listen<{ text: string }>("show-picker", async (event) => {
      setPendingText(event.payload.text);
      setSelectedIndex(0);

      let apps: TargetWindow[] = [];
      try {
        apps = await invoke<TargetWindow[]>("list_windows");
      } catch {
        // leave empty
      }
      setWindows(apps);

      // Resize window to fit content
      const win = getCurrentWindow();
      const width = Math.max(MIN_WIDTH, apps.length * ITEM_WIDTH + PADDING);
      await win.setSize(new LogicalSize(width, WINDOW_HEIGHT));
      await win.center();
      await win.show();
      await win.setFocus();
    });

    return () => {
      void unlisten.then((f) => f());
    };
  }, []);

  // Keyboard navigation and window blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pendingText || windows.length === 0) {
        if (e.key === "Escape") void handleDismiss();
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "Tab": {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % windows.length);
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? windows.length - 1 : prev - 1,
          );
          break;
        }
        case "Enter": {
          e.preventDefault();
          const target = windows[selectedIndex];
          if (target) void handleSelect(target.processId);
          break;
        }
        case "Escape": {
          void handleDismiss();
          break;
        }
      }
    };

    const handleBlur = () => {
      if (pendingText) {
        void handleDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
    };
  }, [handleDismiss, handleSelect, pendingText, windows, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    buttonsRef.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedIndex]);

  if (!pendingText) {
    return <div className="h-screen bg-transparent" />;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-transparent p-2">
      <div className="flex gap-1 bg-gray-900/95 backdrop-blur-sm rounded-xl p-3 border border-gray-700/50 shadow-2xl">
        {windows.length === 0 ? (
          <p className="text-gray-400 text-sm px-4 py-2">No windows found</p>
        ) : (
          windows.map((w, i) => (
            <button
              key={w.windowId}
              ref={(el) => {
                buttonsRef.current[i] = el;
              }}
              onClick={() => handleSelect(w.processId)}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors w-[72px] ${
                i === selectedIndex
                  ? "bg-blue-600/40 ring-2 ring-blue-500"
                  : "hover:bg-gray-700/60"
              }`}
            >
              {w.icon ? (
                <img
                  src={w.icon}
                  alt={w.appName}
                  className="w-10 h-10 rounded-lg shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg font-bold text-white shrink-0">
                  {w.appName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-gray-300 truncate w-full text-center">
                {w.appName}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
