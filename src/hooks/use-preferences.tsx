import { useState, useEffect, useCallback, useContext, createContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { UserPreferences } from "@/types";

interface PreferencesContextValue {
  preferences: UserPreferences | null;
  loading: boolean;
  error: string | null;
  updatePreferences: (preferences: UserPreferences) => Promise<void>;
  reload: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
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

  return (
    <PreferencesContext.Provider value={{ preferences, loading, error, updatePreferences, reload: load }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}
