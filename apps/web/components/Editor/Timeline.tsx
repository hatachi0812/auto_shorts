"use client";

import { useRef } from "react";

interface TimelineSubtitle {
  id: number;
  start_time: number;
  end_time: number;
  text: string;
}

interface TimelineProps {
  subtitles: TimelineSubtitle[];
  currentTime: number;
  duration: number;
  selectedId: number | null;
  onSeek: (time: number) => void;
  onSelect: (id: number) => void;
}

const BLOCK_COLORS = [
  "bg-purple-500/70 hover:bg-purple-500/90",
  "bg-pink-500/70 hover:bg-pink-500/90",
  "bg-blue-500/70 hover:bg-blue-500/90",
  "bg-emerald-500/70 hover:bg-emerald-500/90",
  "bg-orange-500/70 hover:bg-orange-500/90",
  "bg-cyan-500/70 hover:bg-cyan-500/90",
];

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Timeline({
  subtitles,
  currentTime,
  duration,
  selectedId,
  onSeek,
  onSelect,
}: TimelineProps) {
  const barRef = useRef<HTMLDivElement>(null);

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || duration === 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  if (duration === 0 && subtitles.length === 0) {
    return (
      <div className="h-16 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white/25 text-xs">
        영상을 로드하면 타임라인이 표시됩니다
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/40 font-medium">타임라인</span>
        {duration > 0 && (
          <span className="text-xs text-white/40 font-mono">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        )}
      </div>

      {/* Timeline bar */}
      <div
        ref={barRef}
        className="relative h-14 bg-black/40 rounded-lg cursor-crosshair overflow-hidden"
        onClick={handleBarClick}
      >
        {/* Subtitle blocks */}
        {duration > 0 &&
          subtitles.map((sub, i) => {
            const left = (sub.start_time / duration) * 100;
            const width = Math.max(((sub.end_time - sub.start_time) / duration) * 100, 0.3);
            const isSelected = sub.id === selectedId;
            return (
              <div
                key={sub.id}
                className={`absolute top-1.5 bottom-1.5 rounded transition-all ${BLOCK_COLORS[i % BLOCK_COLORS.length]} ${
                  isSelected ? "ring-2 ring-white/70 z-10" : ""
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSeek(sub.start_time);
                  onSelect(sub.id);
                }}
                title={`${fmt(sub.start_time)} – ${fmt(sub.end_time)}\n${sub.text}`}
              >
                <span className="px-1 text-white text-xs truncate block leading-none pt-1.5 pointer-events-none">
                  {sub.text.slice(0, 14)}{sub.text.length > 14 ? "…" : ""}
                </span>
              </div>
            );
          })}

        {/* Current time indicator */}
        {duration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        )}

        {/* Empty state */}
        {subtitles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">
            자막 없음
          </div>
        )}
      </div>

      {/* Time labels */}
      {duration > 0 && (
        <div className="flex justify-between mt-1">
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <span key={r} className="text-xs text-white/20 font-mono">
              {fmt(duration * r)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
