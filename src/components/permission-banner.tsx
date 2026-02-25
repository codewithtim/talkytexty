import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PermissionStatus } from "@/types";

export function usePermissions() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  const check = useCallback(async () => {
    try {
      const s = await invoke<PermissionStatus>("check_permissions");
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  // Poll every 2 seconds — accessibility permission is toggled in System Settings
  // so we need to detect when the user grants it
  useEffect(() => {
    if (!status) return;
    if (status.microphone && status.accessibility) return;

    const interval = setInterval(() => {
      void check();
    }, 2000);
    return () => clearInterval(interval);
  }, [status, check]);

  const allGranted = status ? status.microphone && status.accessibility : false;

  return { status, allGranted, refresh: check };
}

export function PermissionBanner() {
  const { status, allGranted, refresh } = usePermissions();
  const [requesting, setRequesting] = useState(false);

  if (!status || allGranted) return null;

  const needsMic = !status.microphone;
  const needsAccessibility = !status.accessibility;

  const handleRequest = async (type: "microphone" | "accessibility") => {
    setRequesting(true);
    try {
      await invoke<boolean>("request_permission", { permissionType: type });
      // Wait a moment for macOS to process, then re-check
      await new Promise((r) => setTimeout(r, 500));
      await refresh();
    } catch {
      // Permission request failed — user can retry
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="mx-8 mt-6 mb-0 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 p-4">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Permissions required
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            TalkyTexty needs both permissions to record speech and type it into your apps.
            {needsAccessibility && " After enabling Accessibility, you may need to restart the app."}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {needsMic && (
              <button
                type="button"
                onClick={() => handleRequest("microphone")}
                disabled={requesting}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                {requesting ? "Requesting..." : "Grant Microphone Access"}
              </button>
            )}
            {needsAccessibility && (
              <button
                type="button"
                onClick={() => handleRequest("accessibility")}
                disabled={requesting}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                {requesting ? "Opening Settings..." : "Grant Accessibility Access"}
              </button>
            )}
          </div>
          <div className="flex gap-3 mt-3">
            {needsMic && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[11px] text-amber-700 dark:text-amber-400">Microphone</span>
              </div>
            )}
            {!needsMic && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[11px] text-amber-700 dark:text-amber-400">Microphone</span>
              </div>
            )}
            {needsAccessibility && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[11px] text-amber-700 dark:text-amber-400">Accessibility</span>
              </div>
            )}
            {!needsAccessibility && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[11px] text-amber-700 dark:text-amber-400">Accessibility</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
