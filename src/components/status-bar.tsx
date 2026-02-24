import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePreferences } from "@/hooks/use-preferences";
import type { AudioDevice } from "@/types";

interface StatusBarProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export function StatusBar({ onToggleSidebar, sidebarCollapsed }: StatusBarProps) {
  const { preferences, updatePreferences } = usePreferences();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const micName = preferences?.selectedAudioDevice ?? "System Default";

  useEffect(() => {
    invoke<AudioDevice[]>("list_audio_devices")
      .then(setDevices)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const options: { label: string; deviceValue: string | null; isDefault: boolean }[] = [
    { label: "System Default", deviceValue: null, isDefault: false },
    ...devices.map((d) => ({
      label: d.name,
      deviceValue: d.name,
      isDefault: d.isDefault,
    })),
  ];

  const handleSelect = async (deviceValue: string | null) => {
    setOpen(false);
    if (!preferences) return;
    await updatePreferences({
      ...preferences,
      selectedAudioDevice: deviceValue,
    });
  };

  return (
    <div
      className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-black/[0.05] dark:border-white/[0.05]"
      data-tauri-drag-region
    >
      {/* Left: sidebar toggle */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex items-center justify-center w-7 h-7 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
        title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Right: mic selector */}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer rounded-md px-2 py-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
          <span className="truncate max-w-[200px]">{micName}</span>
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <svg
            className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-1 min-w-[240px] rounded-lg bg-white dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] shadow-lg overflow-hidden">
            {options.map((opt) => {
              const isActive = opt.deviceValue === (preferences?.selectedAudioDevice ?? null);
              return (
                <button
                  key={opt.deviceValue ?? "__default__"}
                  type="button"
                  onClick={() => handleSelect(opt.deviceValue)}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      : "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
                  }`}
                >
                  <span className="truncate">
                    {opt.label}
                    {opt.isDefault && (
                      <span className="ml-1.5 text-[10px] text-gray-400 dark:text-gray-500">(Default)</span>
                    )}
                  </span>
                  {isActive && (
                    <svg className="w-3.5 h-3.5 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
