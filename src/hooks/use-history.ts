import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { HistoryEntry } from "@/types";

interface UseHistoryReturn {
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
  deleteEntry: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useHistory(): UseHistoryReturn {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<HistoryEntry[]>("list_history");
      setEntries(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteEntry = useCallback(async (id: string) => {
    try {
      setError(null);
      await invoke("delete_history_entry", { id });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      setError(null);
      await invoke("clear_history");
      setEntries([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, []);

  return {
    entries,
    loading,
    error,
    deleteEntry,
    clearAll,
    reload: load,
  };
}
