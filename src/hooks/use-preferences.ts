import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserPreferences } from "@/types";

interface UsePreferencesReturn {
  preferences: UserPreferences | null;
  loading: boolean;
  error: string | null;
  updatePreferences: (preferences: UserPreferences) => Promise<void>;
  reload: () => Promise<void>;
}

export function usePreferences(): UsePreferencesReturn {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const prefs = await invoke<UserPreferences>("get_preferences");
      setPreferences(prefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updatePreferences = useCallback(async (prefs: UserPreferences) => {
    try {
      setError(null);
      await invoke("update_preferences", { preferences: prefs });
      setPreferences(prefs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, []);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    reload: load,
  };
}
