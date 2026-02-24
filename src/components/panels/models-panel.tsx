import { useModels } from "@/hooks/use-models";
import { usePreferences } from "@/hooks/use-preferences";
import { ModelCard } from "@/components/model-card";

export function ModelsPanel() {
  const {
    models,
    loading,
    error,
    downloadingModelId,
    activatingModelId,
    downloadModel,
    deleteModel,
    setActiveModel,
  } = useModels();
  const { preferences, reload: reloadPreferences } = usePreferences();

  const handleActivate = async (modelId: string) => {
    await setActiveModel(modelId);
    await reloadPreferences();
  };

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Loading models...</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Models</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Download and manage speech-to-text models. Larger models are more accurate but use more memory.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            isActive={preferences?.activeModelId === model.id}
            isStartingDownload={downloadingModelId === model.id}
            isActivating={activatingModelId === model.id}
            onDownload={downloadModel}
            onDelete={deleteModel}
            onActivate={handleActivate}
          />
        ))}
      </div>

      {models.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No models available.</p>
      )}
    </div>
  );
}
