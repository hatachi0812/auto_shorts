"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { projectApi, Highlight } from "@/lib/api";

interface RenderPanelProps {
  projectId: number;
  status: string;
  outputPath: string | null;
  highlights: Highlight[];
  isProcessing: boolean;
  onRenderStart: (highlightIds?: number[]) => void;
  actionLoading: boolean;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(start: number, end: number) {
  const dur = Math.round(end - start);
  if (dur < 60) return `${dur}초`;
  return `${Math.floor(dur / 60)}분 ${dur % 60}초`;
}

function ProgressBar({ progress, stage }: { progress: number; stage: string }) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <div className="p-6 bg-purple-500/5 border border-purple-500/20 rounded-xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 border-2 border-purple-400/50 border-t-purple-400 rounded-full animate-spin shrink-0" />
        <div className="min-w-0">
          <p className="text-white font-medium text-sm">{stage || "렌더링 중..."}</p>
          <p className="text-white/40 text-xs mt-0.5">
            FFmpeg으로 9:16 숏폼 영상을 생성하고 있습니다
          </p>
        </div>
        <span className="ml-auto text-purple-400 font-mono text-sm font-bold shrink-0">
          {clamped}%
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-700"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export default function RenderPanel({
  projectId,
  status,
  outputPath,
  highlights,
  isProcessing,
  onRenderStart,
  actionLoading,
}: RenderPanelProps) {
  const [selectedHighlights, setSelectedHighlights] = useState<Set<number>>(new Set());
  const [useHighlights, setUseHighlights] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{ progress: number; stage: string }>({
    progress: 0,
    stage: "",
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (status === "rendering") {
      setShowOptions(false);
      pollRef.current = setInterval(async () => {
        try {
          const res = await projectApi.getRenderProgress(projectId);
          setRenderProgress({
            progress: res.data.progress,
            stage: res.data.stage,
          });
        } catch {
          // 무시
        }
      }, 1000);
    } else {
      stopPoll();
      if (status === "done") {
        setRenderProgress({ progress: 100, stage: "완료" });
      }
    }
    return stopPoll;
  }, [status, projectId, stopPoll]);

  const toggleHighlight = (id: number) => {
    setSelectedHighlights((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRender = () => {
    const ids =
      useHighlights && selectedHighlights.size > 0
        ? Array.from(selectedHighlights)
        : undefined;
    onRenderStart(ids);
  };

  const outputUrl = projectApi.getOutputUrl(projectId);
  const downloadUrl = projectApi.downloadOutput(projectId);

  // ── 완료 상태 ──
  if (status === "done" && outputPath && !showOptions) {
    return (
      <div className="space-y-5">
        {/* 성공 배너 */}
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-emerald-400 font-semibold text-sm">렌더링 완료!</p>
              <p className="text-emerald-400/60 text-xs mt-0.5 truncate">
                9:16 숏폼 영상이 성공적으로 생성되었습니다.
              </p>
            </div>
          </div>
          <a
            href={downloadUrl}
            download={`alphacut_${projectId}_final.mp4`}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 rounded-lg text-white text-sm font-medium transition-colors shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            MP4 다운로드
          </a>
        </div>

        {/* 영상 미리보기 */}
        <div className="bg-black rounded-xl overflow-hidden border border-white/10">
          <div className="px-4 py-2 bg-white/5 flex items-center justify-between">
            <span className="text-xs text-white/40 font-medium">렌더링 결과 미리보기</span>
            <span className="text-xs text-white/20 font-mono">9:16 · 1080×1920</span>
          </div>
          <div className="flex justify-center py-5 px-4">
            <video
              src={outputUrl}
              controls
              playsInline
              className="rounded-lg shadow-2xl"
              style={{ maxHeight: 500, maxWidth: "100%", aspectRatio: "9/16" }}
            />
          </div>
        </div>

        {/* 파일 정보 */}
        <div className="px-1 flex items-center justify-between">
          <span className="text-xs text-white/30 font-mono">
            {outputPath.split("/").pop()}
          </span>
          <button
            onClick={() => setShowOptions(true)}
            disabled={isProcessing || actionLoading}
            className="text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
          >
            다시 렌더링하기 →
          </button>
        </div>
      </div>
    );
  }

  // ── 렌더링 중 상태 ──
  if (status === "rendering") {
    return (
      <div className="space-y-4">
        <ProgressBar progress={renderProgress.progress} stage={renderProgress.stage} />
        <p className="text-center text-xs text-white/25">
          브라우저를 닫아도 서버에서 계속 처리됩니다
        </p>
      </div>
    );
  }

  // ── 옵션 / 대기 상태 ──
  const canRender = !isProcessing && !actionLoading;
  const renderDisabled =
    !canRender || (useHighlights && selectedHighlights.size === 0);

  return (
    <div className="space-y-4">
      {/* 하이라이트 구간 선택 */}
      {highlights.length > 0 && (
        <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${
                useHighlights ? "bg-purple-600" : "bg-white/15"
              }`}
              onClick={() => setUseHighlights((v) => !v)}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  useHighlights ? "left-5" : "left-1"
                }`}
              />
            </div>
            <div>
              <span className="text-sm text-white/80 font-medium group-hover:text-white transition-colors">
                하이라이트 구간만 렌더링
              </span>
              <p className="text-xs text-white/35 mt-0.5">
                선택한 구간을 자동으로 연결하여 영상을 만듭니다
              </p>
            </div>
          </label>

          {useHighlights && (
            <div className="ml-3 pl-3 border-l border-white/10 space-y-2 pt-1">
              <p className="text-xs text-white/40 mb-3">
                렌더링할 구간을 선택하세요 ({selectedHighlights.size}/{highlights.length})
              </p>
              {highlights.map((h, idx) => {
                const checked = selectedHighlights.has(h.id);
                return (
                  <label
                    key={h.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      checked
                        ? "bg-purple-500/15 border border-purple-500/30"
                        : "bg-white/3 border border-white/8 hover:bg-white/6"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        checked
                          ? "bg-purple-500 border-purple-500"
                          : "border-white/30"
                      }`}
                      onClick={() => toggleHighlight(h.id)}
                    >
                      {checked && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0" onClick={() => toggleHighlight(h.id)}>
                      <p className="text-sm text-white/75 leading-snug">
                        <span className="text-white/35 mr-1">{idx + 1}.</span>
                        {h.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-white/30">
                          {formatTime(h.start_time)} → {formatTime(h.end_time)}
                        </span>
                        <span className="text-xs text-white/20">
                          ({formatDuration(h.start_time, h.end_time)})
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}

              {useHighlights && selectedHighlights.size === 0 && (
                <p className="text-xs text-yellow-400/70 pl-1">
                  하나 이상의 구간을 선택하세요.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 렌더링 정보 & 실행 버튼 */}
      <div className="p-4 bg-white/3 border border-white/8 rounded-xl space-y-4">
        <div className="flex items-start gap-2.5 text-xs text-white/35">
          <svg
            className="w-4 h-4 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            {useHighlights && selectedHighlights.size > 0
              ? `선택한 ${selectedHighlights.size}개 구간을 자막과 함께 자동 연결 후 9:16 숏폼으로 렌더링합니다.`
              : "전체 영상에 자막을 번인(burn-in)하고 9:16 숏폼으로 크롭합니다."}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          {[
            { icon: "🎬", label: "해상도", value: "1080×1920" },
            { icon: "⚡", label: "코덱", value: "H.264 / AAC" },
            { icon: "🎯", label: "비율", value: "9:16 숏폼" },
          ].map((item) => (
            <div
              key={item.label}
              className="p-2.5 bg-black/20 rounded-lg"
            >
              <div className="text-lg mb-1">{item.icon}</div>
              <div className="text-white/60 font-medium">{item.value}</div>
              <div className="text-white/25 text-[10px] mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>

        <button
          onClick={handleRender}
          disabled={renderDisabled}
          className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:from-purple-700 active:to-pink-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30"
        >
          {actionLoading ? (
            <>
              <span className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin" />
              렌더링 시작 중...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              FFmpeg 렌더링 시작
            </>
          )}
        </button>
      </div>
    </div>
  );
}
