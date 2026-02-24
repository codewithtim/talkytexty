import { useState, useCallback, useEffect, useRef } from "react";

interface HotkeyRecorderProps {
  currentBinding: string;
  onRecord: (keyCombination: string) => void;
  disabled?: boolean;
}

function formatKeyForTauri(e: KeyboardEvent): string | null {
  const parts: string[] = [];

  if (e.metaKey || e.ctrlKey) parts.push("CommandOrControl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");

  const key = e.key;
  // Ignore modifier-only presses
  if (key === "Meta" || key === "Control" || key === "Shift" || key === "Alt") {
    return null;
  }

  // Need at least one modifier
  if (parts.length === 0) return null;

  // Map common keys to Tauri format
  const keyMap: Record<string, string> = {
    " ": "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ",": ",",
    ".": ".",
    "/": "/",
    ";": ";",
    "'": "'",
    "[": "[",
    "]": "]",
    "\\": "\\",
    "-": "-",
    "=": "=",
    "`": "`",
  };

  const mappedKey = keyMap[key] ?? key.toUpperCase();
  parts.push(mappedKey);

  return parts.join("+");
}

export function HotkeyRecorder({
  currentBinding,
  onRecord,
  disabled = false,
}: HotkeyRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const combo = formatKeyForTauri(e);
    if (combo) {
      setPendingKey(combo);
    }
  }, []);

  const handleKeyUp = useCallback(() => {
    if (pendingKey) {
      onRecord(pendingKey);
      setPendingKey(null);
      setRecording(false);
    }
  }, [pendingKey, onRecord]);

  useEffect(() => {
    if (!recording) return;

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [recording, handleKeyDown, handleKeyUp]);

  const startRecording = () => {
    if (disabled) return;
    setPendingKey(null);
    setRecording(true);
  };

  const cancelRecording = () => {
    setPendingKey(null);
    setRecording(false);
  };

  const displayValue = recording
    ? (pendingKey ?? "Press a key combination...")
    : currentBinding || "Not set";

  return (
    <div className="flex items-center gap-2">
      <button
        ref={inputRef}
        onClick={recording ? cancelRecording : startRecording}
        disabled={disabled}
        className={`px-3 py-1.5 rounded text-sm font-mono min-w-48 text-left transition-colors ${
          recording
            ? "bg-blue-50 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-500 text-blue-600 dark:text-blue-300"
            : "bg-white dark:bg-[#333] border border-[#d1d1d6] dark:border-[#4a4a4a] text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {displayValue}
      </button>
      {recording && (
        <button
          onClick={cancelRecording}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
