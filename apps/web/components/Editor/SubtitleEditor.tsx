"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { projectApi, Subtitle } from "@/lib/api";
import Timeline from "./Timeline";
import StylePanel from "./StylePanel";
import type { StyleJson } from "./StylePanel";

const KonvaPreview = dynamic(() => import("./KonvaPreview"), { ssr: false });

const CANVAS_W = 270;
const CANVAS_H = 480;

const DEFAULT_STYLE: StyleJson = {
  x: 10,
  y: Math.round(CANVAS_H * 0.78),
  fontSize: 20,
  color: "#FFFFFF",
  fontFamily: "Arial",
};

interface SubtitleWithStyle extends Subtitle {
  parsedStyle: StyleJson;
}

interface SubtitleEditorProps {
  projectId: number;
  subtitles: Subtitle[];
  sourcePath: string | null;
  onSaved?: () => void;
}

function parseStyle(raw: string | null): StyleJson {
  if (!raw) return { ...DEFAULT_STYLE };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...DEFAULT_STYLE, ...parsed };
  } catch {
    return { ...DEFAULT_STYLE };
  }
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SubtitleEditor({
  projectId,
  subtitles: initialSubtitles,
  sourcePath,
  onSaved,
}: SubtitleEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [subtitles, setSubtitles] = useState<SubtitleWithStyle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    setSubtitles(
      initialSubtitles.map((sub) => ({
        ...sub,
        parsedStyle: parseStyle(sub.style_json),
      }))
    );
  }, [initialSubtitles]);

  const currentSub = subtitles.find(
    (s) => currentTime >= s.start_time && currentTime <= s.end_time
  ) ?? null;

  const selectedSub =
    selectedId != null
      ? (subtitles.find((s) => s.id === selectedId) ?? currentSub)
      : currentSub;

  const videoUrl = sourcePath ? projectApi.getVideoUrl(projectId) : null;

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }, []);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const updateStyle = useCallback((id: number, partial: Partial<StyleJson>) => {
    setSubtitles((prev) =>
      prev.map((sub) =>
        sub.id === id ? { ...sub, parsedStyle: { ...sub.parsedStyle, ...partial } } : sub
      )
    );
  }, []);

  const handleDragEnd = useCallback(
    (id: number, x: number, y: number) => updateStyle(id, { x, y }),
    [updateStyle]
  );

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const payload = subtitles.map((sub) => ({
        start_time: sub.start_time,
        end_time: sub.end_time,
        text: sub.text,
        style_json: sub.parsedStyle,
      }));
      await projectApi.updateSubtitles(projectId, payload);
      setSaveMsg({ text: "저장 완료!", ok: true });
      onSaved?.();
      setTimeout(() => setSaveMsg(null), 3000);
    } catch {
      setSaveMsg({ text: "저장 실패", ok: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving || subtitles.length === 0}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-white text-sm font-medium transition-colors"
        >
          {saving ? "저장 중..." : "스타일 저장"}
        </button>
        {saveMsg && (
          <span
            className={`text-sm font-medium ${saveMsg.ok ? "text-emerald-400" : "text-red-400"}`}
          >
            {saveMsg.text}
          </span>
        )}
        <span className="text-white/30 text-xs ml-auto hidden sm:block">
          {subtitles.length > 0
            ? `자막 ${subtitles.length}개 · 캔버스에서 드래그로 위치 조정 가능`
            : "자막이 없습니다. STT를 먼저 실행하세요."}
        </span>
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* ── Left: Video + Timeline + Subtitle list ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Video Player */}
          <div className="relative bg-black rounded-xl overflow-hidden">
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full"
                  style={{ maxHeight: 360 }}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  controls
                />
                {/* Subtitle overlay on video */}
                {currentSub && (
                  <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none px-4">
                    <span
                      style={{
                        fontSize: Math.round((currentSub.parsedStyle.fontSize / CANVAS_H) * 100) + "px",
                        color: currentSub.parsedStyle.color,
                        fontFamily: currentSub.parsedStyle.fontFamily,
                        fontWeight: "bold",
                        textShadow:
                          "0 2px 10px rgba(0,0,0,1), 0 0 20px rgba(0,0,0,0.7)",
                        lineHeight: 1.3,
                        textAlign: "center",
                      }}
                    >
                      {currentSub.text}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-white/30 text-sm gap-2">
                <svg
                  className="w-8 h-8 text-white/15"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>영상을 다운로드한 후 에디터를 사용할 수 있습니다</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <Timeline
            subtitles={subtitles}
            currentTime={currentTime}
            duration={duration}
            selectedId={selectedSub?.id ?? null}
            onSeek={seekTo}
            onSelect={(id) => setSelectedId(id)}
          />

          {/* Subtitle list */}
          {subtitles.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-xs text-white/40 mb-2 font-medium">
                자막 목록{" "}
                <span className="text-white/25">— 클릭하여 해당 구간으로 이동 및 선택</span>
              </p>
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                {subtitles.map((sub) => {
                  const isActive =
                    currentTime >= sub.start_time && currentTime <= sub.end_time;
                  const isSelected = selectedSub?.id === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setSelectedId(sub.id);
                        seekTo(sub.start_time);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? "bg-purple-500/20 border border-purple-500/40 text-white"
                          : isActive
                          ? "bg-white/10 text-white"
                          : "bg-black/20 hover:bg-black/40 text-white/65"
                      }`}
                    >
                      <span className="font-mono text-xs text-white/35 mr-2">
                        {fmt(sub.start_time)}
                      </span>
                      {sub.text}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Konva 9:16 Preview + Style Panel ── */}
        <div
          className="flex flex-col gap-3 shrink-0"
          style={{ width: CANVAS_W }}
        >
          {/* Canvas header */}
          <div className="rounded-xl overflow-hidden border border-white/10">
            <div className="px-3 py-1.5 bg-white/5 flex justify-between items-center">
              <span className="text-xs text-white/40">9:16 캔버스 미리보기</span>
              <span className="text-xs text-white/25 font-mono">
                {CANVAS_W}×{CANVAS_H}
              </span>
            </div>
            <div className="bg-black flex justify-center">
              <KonvaPreview
                subtitles={subtitles}
                currentTime={currentTime}
                selectedId={selectedSub?.id ?? null}
                onDragEnd={handleDragEnd}
                onSelect={(id) => setSelectedId(id)}
              />
            </div>
          </div>

          {/* Style Panel */}
          {selectedSub ? (
            <StylePanel
              style={selectedSub.parsedStyle}
              text={selectedSub.text}
              canvasH={CANVAS_H}
              onChange={(partial) => updateStyle(selectedSub.id, partial)}
            />
          ) : (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-white/25 text-xs text-center leading-relaxed">
              자막을 선택하거나
              <br />
              영상을 재생하면 스타일을 편집할 수 있습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
