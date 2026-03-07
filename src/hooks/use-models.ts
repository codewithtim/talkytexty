import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DownloadProgress, TranscriptionModel } from "@/types";

interface UseModelsReturn {
  models: TranscriptionModel[];
  loading: boolean;
  error: string | null;
  downloadingModelId: string | null;
  activatingModelId: string | null;
  reload: () => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  cancelDownload: (modelId: string) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  setActiveModel: (modelId: string) => Promise<void>;
}

export function useModels(): UseModelsReturn {
  const [models, setModels] = useState<TranscriptionModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [activatingModelId, setActivatingModelId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<TranscriptionModel[]>("list_models");
      setModels(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const un = await listen<DownloadProgress>("download-progress", (event) => {
        setModels((prev) =>
          prev.map((m) =>
            m.id === event.payload.modelId
              ? {
                ...m,
                downloadStatus: {
                  status: "Downloading",
                  progressPercent: event.payload.percent,
                },
                downloadMeta: {
                  bytesDownloaded: event.payload.bytesDownloaded,
                  bytesTotal: event.payload.bytesTotal,
                  bytesPerSecond: event.payload.bytesPerSecond,
                  etaSeconds: event.payload.etaSeconds,
                },
              }
              : m,
          ),
        );
      });
      unlisten = un;
    };

    void setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const downloadModel = useCallback(
    async (modelId: string) => {
      try {
        setError(null);
        setDownloadingModelId(modelId);
        await invoke("download_model", { modelId });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setDownloadingModelId(null);
      }
    },
    [load],
  );

  const cancelDownload = useCallback(
    async (modelId: string) => {
      try {
        setError(null);
        await invoke("cancel_model_download", { modelId });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  const deleteModel = useCallback(
    async (modelId: string) => {
      try {
        setError(null);
        await invoke("delete_model", { modelId });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [load],
  );

  const setActiveModel = useCallback(
    async (modelId: string) => {
      try {
        setError(null);
        setActivatingModelId(modelId);
        await invoke("set_active_model", { modelId });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setActivatingModelId(null);
      }
    },
    [load],
  );

  return {
    models,
    loading,
    error,
    downloadingModelId,
    activatingModelId,
    reload: load,
    downloadModel,
    cancelDownload,
    deleteModel,
    setActiveModel,
  };
}
