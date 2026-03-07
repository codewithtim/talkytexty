import type { TranscriptionModel } from "@/types";
import { CompanyBadge } from "./company-badge";

interface ModelCardProps {
  model: TranscriptionModel;
  isActive: boolean;
  isStartingDownload?: boolean;
  isActivating?: boolean;
  onDownload: (modelId: string) => void;
  onCancelDownload: (modelId: string) => void;
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
  onCancelDownload,
  onDelete,
  onActivate,
}: ModelCardProps) {
  const isDownloaded = model.downloadStatus.status === "Downloaded";
  const isDownloading = model.downloadStatus.status === "Downloading";

  return (
    <div
      className={`rounded-xl p-4 transition-all duration-300 transform hover:-translate-y-0.5 ${isActive
        ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-500/50 shadow-sm"
        : "bg-[#f5f5f7] dark:bg-[#2a2a2a] border border-[#e5e5e7] dark:border-[#3a3a3a] hover:border-gray-400 dark:hover:border-gray-600 hover:shadow-md"
        }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CompanyBadge modelFamily={model.modelFamily} />
            <span className={`text-xs uppercase tracking-wide ${model.modelFamily === "Parakeet" ? "text-green-600 dark:text-green-500" : "text-gray-500 dark:text-gray-500"
              }`}>
              {model.modelFamily}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
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
              className="text-sm px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              aria-label={`Activate ${model.name}`}
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
              className="text-sm px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-red-600 text-gray-600 dark:text-gray-300 hover:text-white transition-colors cursor-pointer"
              aria-label={`Delete ${model.name}`}
            >
              Delete
            </button>
          )}
          {!isDownloaded && !isDownloading && (
            <button
              onClick={() => onDownload(model.id)}
              disabled={isStartingDownload}
              className="text-sm px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              aria-label={`Download ${model.name}`}
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

          {isDownloading && (
            <button
              onClick={() => onCancelDownload(model.id)}
              className="text-sm px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-red-600 text-gray-600 dark:text-gray-300 hover:text-white transition-colors cursor-pointer"
              aria-label={`Cancel download for ${model.name}`}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {isDownloading && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Spinner />
              Downloading...
            </span>
            {model.downloadStatus.status === "Downloading" && (
              <span>{Math.round(model.downloadStatus.progressPercent)}%</span>
            )}
          </div>

          {(model.downloadMeta?.bytesPerSecond ?? 0) > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>
                {(model.downloadMeta?.bytesPerSecond ?? 0) > 0
                  ? `${formatBytes(model.downloadMeta?.bytesPerSecond ?? 0)}/s`
                  : ""}
              </span>
              <span>
                {model.downloadMeta?.etaSeconds != null
                  ? `ETA ${Math.max(0, Math.round(model.downloadMeta.etaSeconds))}s`
                  : ""}
              </span>
            </div>
          )}

          <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300 ease-out"
              style={{
                width: `${model.downloadStatus.status === "Downloading"
                  ? model.downloadStatus.progressPercent
                  : 0
                  }%`,
              }}
            />
          </div>
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
