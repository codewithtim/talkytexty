import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function ReviewPage() {
  const [text, setText] = useState("");
  const [originalText, setOriginalText] = useState("");

  const handleInject = useCallback(async () => {
    await invoke("inject_text", { text });
    await getCurrentWindow().hide();
  }, [text]);

  const handleCancel = useCallback(async () => {
    await getCurrentWindow().hide();
  }, []);

  useEffect(() => {
    const unlistenShow = listen<{ text: string }>("show-review", (event) => {
      setText(event.payload.text);
      setOriginalText(event.payload.text);
      void getCurrentWindow().show();
      void getCurrentWindow().setFocus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleInject();
      } else if (e.key === "Escape") {
        e.preventDefault();
        void handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      void unlistenShow.then((f) => f());
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleInject, handleCancel]);

  return (
    <div className="h-screen w-screen bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Review Transcription</h2>
          <span className="text-white/80 text-xs">Cmd+Enter to inject · Esc to cancel</span>
        </div>
        
        <div className="p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[100px] resize-none text-base font-medium px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Edit your text before injecting..."
            autoFocus
          />
          
          {text !== originalText && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
              Text has been modified from original
            </p>
          )}
        </div>

        <div className="px-4 pb-4 flex items-center justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInject}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Inject
          </button>
        </div>
      </div>
    </div>
  );
}
