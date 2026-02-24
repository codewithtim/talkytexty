import type { TranscriptionModel } from "@/types";

interface ModelCardProps {
  model: TranscriptionModel;
  isActive: boolean;
  isStartingDownload?: boolean;
  isActivating?: boolean;
  onDownload: (modelId: string) => void;
  onDelete: (modelId: string) => void;
  onActivate: (modelId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function ModelCard({
  model,
  isActive,
  isStartingDownload,
  isActivating,
  onDownload,
  onDelete,
  onActivate,
}: ModelCardProps) {
  const isDownloaded = model.downloadStatus.status === "Downloaded";
  const isDownloading = model.downloadStatus.status === "Downloading";

  return (
    <div
      className={`rounded-lg p-4 ${
        isActive
          ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-500/50"
          : "bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className={`text-xs uppercase tracking-wide ${
            model.modelFamily === "Parakeet" ? "text-green-600 dark:text-green-500" : "text-gray-500 dark:text-gray-500"
          }`}>
            {model.modelFamily}
          </span>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{model.name}</h3>
            {isActive && (
              <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{formatBytes(model.sizeBytes)}</span>
            {model.quantization && (
              <span className="text-gray-400 dark:text-gray-500">{model.quantization}</span>
            )}
            <span>{model.languages.join(", ")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDownloaded && !isActive && (
            <button
              onClick={() => onActivate(model.id)}
              disabled={isActivating}
              className="text-sm px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActivating ? (
                <span className="flex items-center gap-1.5">
                  <Spinner />
                  Activating...
                </span>
              ) : (
                "Activate"
              )}
            </button>
          )}
          {isDownloaded && !isActive && (
            <button
              onClick={() => onDelete(model.id)}
              className="text-sm px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-red-600 text-gray-600 dark:text-gray-300 hover:text-white transition-colors"
            >
              Delete
            </button>
          )}
          {!isDownloaded && !isDownloading && (
            <button
              onClick={() => onDownload(model.id)}
              disabled={isStartingDownload}
              className="text-sm px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStartingDownload ? (
                <span className="flex items-center gap-1.5">
                  <Spinner />
                  Downloading...
                </span>
              ) : (
                "Download"
              )}
            </button>
          )}
        </div>
      </div>

      {isDownloading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Spinner />
          <span>Downloading...</span>
        </div>
      )}

      {model.downloadStatus.status === "Error" && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          Error: {model.downloadStatus.message}
        </div>
      )}
    </div>
  );
}
