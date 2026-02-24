import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useHistory } from "@/hooks/use-history";
import { SettingsGroup } from "@/components/settings-group";
import type { HistoryEntry } from "@/types";

function extractPeaks(audioBuffer: AudioBuffer, numBars: number): number[] {
  const channel = audioBuffer.getChannelData(0);
  const bucketSize = Math.floor(channel.length / numBars);
  const peaks: number[] = [];
  let maxPeak = 0;

  for (let i = 0; i < numBars; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, channel.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = channel[j];
      if (val === undefined) continue;
      const abs = Math.abs(val);
      if (abs > max) max = abs;
    }
    peaks.push(max);
    if (max > maxPeak) maxPeak = max;
  }

  // Normalize 0..1 with min height
  return peaks.map((p) => Math.max(maxPeak > 0 ? p / maxPeak : 0, 0.05));
}

function WaveformPlayer({ audioFileName }: { audioFileName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peaksRef = useRef<number[] | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const animFrameRef = useRef<number>(0);
  const playingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(0);

  const NUM_BARS = 80;
  const HEIGHT = 32;

  // Observe container width — depends on `loaded` so ref is available after first render
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(Math.floor(entry.contentRect.width));
      }
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, [loaded]);

  // Load audio and decode peaks on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bytes: number[] = await invoke("get_history_audio", {
          fileName: audioFileName,
        });
        if (cancelled) return;
        const uint8 = new Uint8Array(bytes);
        const blob = new Blob([uint8], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;

        const audioCtx = new AudioContext();
        const arrayBuf = uint8.buffer.slice(
          uint8.byteOffset,
          uint8.byteOffset + uint8.byteLength,
        );
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        await audioCtx.close();
        if (cancelled) return;

        peaksRef.current = extractPeaks(decoded, NUM_BARS);
        setLoaded(true);
      } catch {
        // Could not load audio — component stays hidden
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioFileName]);

  // Draw waveform
  const drawWaveform = useCallback(
    (progress: number) => {
      const canvas = canvasRef.current;
      const peaks = peaksRef.current;
      if (!canvas || !peaks || canvasWidth === 0) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvasWidth;
      const h = HEIGHT;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, w, h);

      const gap = 1;
      const totalGaps = (NUM_BARS - 1) * gap;
      const barWidth = Math.floor((w - totalGaps) / NUM_BARS);
      const totalUsed = barWidth * NUM_BARS + totalGaps;
      const offsetX = Math.floor((w - totalUsed) / 2);
      const centerY = h / 2;
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const grayColor = isDark ? "#4b5563" : "#d1d5db";
      const playedColor = isDark ? "#ffffff" : "#111827";
      const progressX = progress * w;

      for (let i = 0; i < NUM_BARS; i++) {
        const amp = peaks[i] ?? 0.05;
        const barHeight = Math.max(2, amp * (h * 0.9));
        const x = offsetX + i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        const played = x + barWidth <= progressX;
        ctx.fillStyle = played ? playedColor : grayColor;
        ctx.globalAlpha = played ? 1 : 0.85;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    [canvasWidth],
  );

  // Redraw when loaded or canvas resizes (idle state)
  useEffect(() => {
    if (loaded && !playingRef.current) {
      drawWaveform(0);
    }
  }, [loaded, canvasWidth, drawWaveform]);

  const startAnimationLoop = useCallback(() => {
    const loop = () => {
      const audio = audioRef.current;
      if (!audio || !playingRef.current) return;
      const progress = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      drawWaveform(progress);
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
  }, [drawWaveform]);

  const handleClick = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      playingRef.current = false;
      setPlaying(false);
      drawWaveform(0);
      return;
    }

    if (!blobUrlRef.current) return;

    try {
      const audio = new Audio(blobUrlRef.current);
      audioRef.current = audio;
      audio.onended = () => {
        playingRef.current = false;
        setPlaying(false);
        cancelAnimationFrame(animFrameRef.current);
        drawWaveform(0);
      };
      audio.onerror = () => {
        playingRef.current = false;
        setPlaying(false);
        cancelAnimationFrame(animFrameRef.current);
        drawWaveform(0);
      };
      await audio.play();
      playingRef.current = true;
      setPlaying(true);
      startAnimationLoop();
    } catch {
      playingRef.current = false;
      setPlaying(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        title={playing ? "Stop playback" : "Play recording"}
        className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
      >
        {playing ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11-7.36a1 1 0 0 0 0-1.72l-11-7.36A1 1 0 0 0 8 5.14Z" />
          </svg>
        )}
      </button>
      <div ref={containerRef} className="flex-1 min-w-0">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: HEIGHT }}
          className="block"
        />
      </div>
    </div>
  );
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = Date.now();
  const diffSeconds = Math.floor((now - date.getTime()) / 1000);

  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) {
    const m = Math.floor(diffSeconds / 60);
    return `${m}m ago`;
  }
  if (diffSeconds < 86400) {
    const h = Math.floor(diffSeconds / 3600);
    return `${h}h ago`;
  }
  if (diffSeconds < 604800) {
    const d = Math.floor(diffSeconds / 86400);
    return `${d}d ago`;
  }
  return date.toLocaleDateString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function HistoryCard({
  entry,
  onDelete,
}: {
  entry: HistoryEntry;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLong = entry.text.length > 120;
  const displayText = expanded || !isLong ? entry.text : entry.text.slice(0, 120) + "...";

  const handleCopy = async () => {
    try {
      await invoke("copy_to_clipboard", { text: entry.text });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback to navigator clipboard
      await navigator.clipboard.writeText(entry.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06] last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => isLong && setExpanded((e) => !e)}
          className={`text-left text-sm text-gray-900 dark:text-gray-100 min-w-0 flex-1 ${
            isLong ? "cursor-pointer" : ""
          }`}
        >
          {displayText}
        </button>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy to clipboard"
            className="p-1 rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            title="Delete entry"
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
      {entry.audioFileName && (
        <WaveformPlayer audioFileName={entry.audioFileName} />
      )}
      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
        <span>{formatRelativeTime(entry.createdAt)}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        {entry.modelId && (
          <>
            <span className="px-1.5 py-0.5 rounded bg-black/[0.06] dark:bg-white/[0.08] text-gray-700 dark:text-gray-300 text-[10px] font-medium">
              {entry.modelId}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
          </>
        )}
        <span title="Recording duration">rec {formatDuration(entry.recordingDurationMs)}</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span title="Transcription duration">transcribe {formatDuration(entry.transcriptionDurationMs)}</span>
      </div>
    </div>
  );
}

export function HistoryPanel() {
  const { entries, loading, error, deleteEntry, clearAll, reload } = useHistory();
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = search.trim()
    ? entries.filter((e) =>
        e.text.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : entries;

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Loading history...</p>;
  }

  if (error) {
    return <p className="text-red-500">Error: {error}</p>;
  }

  return (
    <div>
      <SettingsGroup title="Transcription History">
        {/* Search and actions bar */}
        <div className="px-4 py-3 flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="relative flex-1">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search transcriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md bg-white dark:bg-[#333] border border-[#e5e5e7] dark:border-[#444] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={reload}
            title="Refresh"
            className="p-1.5 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
          </button>
          {entries.length > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Delete all?</span>
                <button
                  type="button"
                  onClick={async () => {
                    await clearAll();
                    setConfirmClear(false);
                  }}
                  className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-[#333] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )
          )}
        </div>

        {/* Entry list */}
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-gray-400 dark:text-gray-500 mb-1">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {search.trim() ? "No matching transcriptions" : "No transcriptions yet"}
            </p>
            {!search.trim() && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Completed transcriptions will appear here
              </p>
            )}
          </div>
        ) : (
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            {filtered.map((entry) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                onDelete={deleteEntry}
              />
            ))}
          </div>
        )}
      </SettingsGroup>
    </div>
  );
}
