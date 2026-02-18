"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { projectApi, Project, Subtitle, Highlight, STATUS_LABELS, STATUS_COLORS } from "@/lib/api";

const SubtitleEditor = dynamic(
  () => import("@/components/Editor/SubtitleEditor"),
  { ssr: false, loading: () => <div className="text-white/30 text-sm py-8 text-center">에디터 로드 중...</div> }
);

const RenderPanel = dynamic(
  () => import("@/components/Editor/RenderPanel"),
  { ssr: false, loading: () => <div className="text-white/30 text-sm py-8 text-center">불러오는 중...</div> }
);

const PROCESSING_STATUSES = ["downloading", "transcribing", "highlighting", "rendering"];

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

export default function ProjectPage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"subtitles" | "highlights" | "editor" | "render">("highlights");

  const fetchProject = useCallback(async () => {
    try {
      const res = await projectApi.get(projectId);
      setProject(res.data);
    } catch {
      setError("프로젝트를 불러올 수 없습니다.");
    }
  }, [projectId]);

  const fetchSubtitles = useCallback(async () => {
    try {
      const res = await projectApi.getSubtitles(projectId);
      setSubtitles(res.data);
    } catch {
      // 자막 없음은 정상
    }
  }, [projectId]);

  const fetchHighlights = useCallback(async () => {
    try {
      const res = await projectApi.getHighlights(projectId);
      setHighlights(res.data);
    } catch {
      // 하이라이트 없음은 정상
    }
  }, [projectId]);

  useEffect(() => {
    const init = async () => {
      await fetchProject();
      await Promise.all([fetchSubtitles(), fetchHighlights()]);
      setLoading(false);
    };
    init();
  }, [fetchProject, fetchSubtitles, fetchHighlights]);

  // 처리 중인 상태일 때 폴링
  useEffect(() => {
    if (!project) return;
    if (!PROCESSING_STATUSES.includes(project.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await projectApi.getStatus(projectId);
        const newStatus = res.data.status;
        setProject((prev) => (prev ? { ...prev, status: newStatus } : prev));

        if (!PROCESSING_STATUSES.includes(newStatus)) {
          clearInterval(interval);
          await fetchProject();
          await Promise.all([fetchSubtitles(), fetchHighlights()]);
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [project, projectId, fetchProject, fetchSubtitles, fetchHighlights]);

  const handleAction = async (action: string, fn: () => Promise<unknown>) => {
    setActionLoading(action);
    setError("");
    try {
      await fn();
      await fetchProject();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? `${action} 실패`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleHighlight = async () => {
    await handleAction("highlight", () => projectApi.highlight(projectId));
  };

  const handleRenderStart = async (highlightIds?: number[]) => {
    await handleAction("render", () =>
      projectApi.render(projectId, highlightIds ? { highlight_ids: highlightIds } : undefined)
    );
  };

  if (loading) {
    return <div className="text-center py-20 text-white/40">불러오는 중...</div>;
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-white/40">프로젝트를 찾을 수 없습니다.</p>
        <Link href="/" className="text-purple-400 hover:underline mt-2 inline-block text-sm">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const isProcessing = PROCESSING_STATUSES.includes(project.status);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-white/40 hover:text-white text-sm transition-colors">
          ← 프로젝트 목록
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-white/70 text-sm truncate">{project.title}</span>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-3 underline shrink-0">닫기</button>
        </div>
      )}

      {/* 프로젝트 정보 */}
      <div className="p-6 bg-white/5 border border-white/10 rounded-xl mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{project.title}</h1>
            {project.source_url && (
              <a
                href={project.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:underline text-sm mt-1 inline-block truncate max-w-md"
              >
                {project.source_url}
              </a>
            )}
          </div>
          <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${STATUS_COLORS[project.status] ?? "bg-gray-500/20 text-gray-400"}`}>
            {isProcessing && (
              <span className="w-2 h-2 bg-current rounded-full animate-pulse" />
            )}
            {STATUS_LABELS[project.status] ?? project.status}
          </span>
        </div>

        {project.output_path && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>숏폼 영상 렌더링 완료</span>
            </div>
            <button
              onClick={() => setActiveTab("render")}
              className="text-xs text-emerald-400/70 hover:text-emerald-300 underline transition-colors shrink-0"
            >
              결과 보기 →
            </button>
          </div>
        )}
      </div>

      {/* 파이프라인 액션 */}
      <div className="p-6 bg-white/5 border border-white/10 rounded-xl mb-6">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">
          처리 파이프라인
        </h2>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            step={1}
            label="다운로드"
            description="yt-dlp · YouTube 영상"
            disabled={!project.source_url || isProcessing}
            loading={actionLoading === "download"}
            active={!!project.source_path}
            onClick={() => handleAction("download", () => projectApi.download(projectId))}
          />
          <ActionButton
            step={2}
            label="STT 자막 추출"
            description="Whisper AI · 음성 인식"
            disabled={!project.source_path || isProcessing}
            loading={actionLoading === "transcribe" || project.status === "transcribing"}
            active={subtitles.length > 0}
            onClick={() => handleAction("transcribe", () => projectApi.transcribe(projectId))}
          />
          <ActionButton
            step={3}
            label="하이라이트 분석"
            description="GPT-4o · 핵심 구간 추출"
            disabled={subtitles.length === 0 || isProcessing}
            loading={actionLoading === "highlight" || project.status === "highlighting"}
            active={highlights.length > 0}
            onClick={handleHighlight}
            accent
          />
          <ActionButton
            step={4}
            label="렌더링"
            description="FFmpeg · 숏폼 영상 생성"
            disabled={!project.source_path || isProcessing}
            loading={project.status === "rendering"}
            active={!!project.output_path}
            onClick={() => setActiveTab("render")}
          />
        </div>

        {isProcessing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-white/40">
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {STATUS_LABELS[project.status]} — 완료 후 자동으로 갱신됩니다
          </div>
        )}
      </div>

      {/* 탭: 하이라이트 / 자막 / 에디터 */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="flex border-b border-white/10 overflow-x-auto">
          <TabButton
            label={`하이라이트 ${highlights.length > 0 ? `(${highlights.length})` : ""}`}
            active={activeTab === "highlights"}
            onClick={() => setActiveTab("highlights")}
          />
          <TabButton
            label={`자막 ${subtitles.length > 0 ? `(${subtitles.length})` : ""}`}
            active={activeTab === "subtitles"}
            onClick={() => setActiveTab("subtitles")}
          />
          <TabButton
            label="에디터"
            active={activeTab === "editor"}
            onClick={() => setActiveTab("editor")}
            accent
          />
          <TabButton
            label={
              project.status === "rendering"
                ? "렌더 결과 ⋯"
                : project.output_path
                ? "렌더 결과 ✓"
                : "렌더 결과"
            }
            active={activeTab === "render"}
            onClick={() => setActiveTab("render")}
            highlight
          />
        </div>

        <div className="p-6">
          {activeTab === "highlights" && (
            <HighlightsTab
              highlights={highlights}
              isHighlighting={project.status === "highlighting"}
              hasSubtitles={subtitles.length > 0}
            />
          )}
          {activeTab === "subtitles" && (
            <SubtitlesTab subtitles={subtitles} />
          )}
          {activeTab === "editor" && (
            <SubtitleEditor
              projectId={projectId}
              subtitles={subtitles}
              sourcePath={project.source_path}
              onSaved={fetchSubtitles}
            />
          )}
          {activeTab === "render" && (
            <RenderPanel
              projectId={projectId}
              status={project.status}
              outputPath={project.output_path}
              highlights={highlights}
              isProcessing={isProcessing}
              onRenderStart={handleRenderStart}
              actionLoading={actionLoading === "render"}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 탭 버튼 ── */
function TabButton({
  label,
  active,
  onClick,
  accent = false,
  highlight = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
  highlight?: boolean;
}) {
  const activeColor = highlight
    ? "text-emerald-400 border-b-2 border-emerald-400"
    : accent
    ? "text-purple-400 border-b-2 border-purple-400"
    : "text-white border-b-2 border-purple-500";

  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
        active ? activeColor : "text-white/40 hover:text-white/70"
      }`}
    >
      {label}
    </button>
  );
}

/* ── 하이라이트 탭 ── */
function HighlightsTab({
  highlights,
  isHighlighting,
  hasSubtitles,
}: {
  highlights: Highlight[];
  isHighlighting: boolean;
  hasSubtitles: boolean;
}) {
  if (isHighlighting) {
    return (
      <div className="text-center py-12 text-white/40">
        <div className="w-8 h-8 border-2 border-orange-400/50 border-t-orange-400 rounded-full animate-spin mx-auto mb-3" />
        <p>GPT-4o가 핵심 구간을 분석 중입니다...</p>
      </div>
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
        <p className="text-white/30 text-sm">
          {hasSubtitles
            ? "위의 「하이라이트 분석」 버튼을 눌러 GPT-4o로 핵심 구간을 추출하세요."
            : "먼저 STT 자막 추출을 실행하세요."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {highlights.map((h, idx) => (
        <HighlightCard key={h.id} highlight={h} index={idx} />
      ))}
    </div>
  );
}

/* ── 하이라이트 카드 ── */
const ACCENT_COLORS = [
  "from-purple-500/20 border-purple-500/30",
  "from-pink-500/20 border-pink-500/30",
  "from-blue-500/20 border-blue-500/30",
  "from-emerald-500/20 border-emerald-500/30",
  "from-orange-500/20 border-orange-500/30",
];

function HighlightCard({ highlight, index }: { highlight: Highlight; index: number }) {
  const color = ACCENT_COLORS[index % ACCENT_COLORS.length];
  const duration = formatDuration(highlight.start_time, highlight.end_time);

  return (
    <div className={`p-5 rounded-xl border bg-gradient-to-br ${color} to-transparent`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-white/10 text-xs flex items-center justify-center font-bold text-white/60">
            {index + 1}
          </span>
          <h3 className="font-semibold text-white text-sm leading-snug">{highlight.title}</h3>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 font-mono text-xs">
        <span className="px-2 py-1 bg-black/30 rounded text-white/70">
          {formatTime(highlight.start_time)}
        </span>
        <span className="text-white/30">→</span>
        <span className="px-2 py-1 bg-black/30 rounded text-white/70">
          {formatTime(highlight.end_time)}
        </span>
        <span className="text-white/40 ml-1">({duration})</span>
      </div>

      {highlight.reason && (
        <p className="text-xs text-white/50 leading-relaxed">{highlight.reason}</p>
      )}
    </div>
  );
}

/* ── 자막 탭 ── */
function SubtitlesTab({ subtitles }: { subtitles: Subtitle[] }) {
  if (subtitles.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
        <p className="text-white/30 text-sm">
          자막이 없습니다. STT 자막 추출을 실행하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
      {subtitles.map((sub) => (
        <div key={sub.id} className="flex items-start gap-3 p-3 bg-black/20 rounded-lg text-sm hover:bg-black/30 transition-colors">
          <span className="text-white/30 text-xs font-mono whitespace-nowrap mt-0.5 shrink-0">
            {formatTime(sub.start_time)} → {formatTime(sub.end_time)}
          </span>
          <span className="text-white/80 leading-relaxed">{sub.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ── 액션 버튼 ── */
function ActionButton({
  step,
  label,
  description,
  disabled,
  loading,
  active,
  onClick,
  accent = false,
}: {
  step: number;
  label: string;
  description: string;
  disabled: boolean;
  loading: boolean;
  active?: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative flex flex-col items-start p-4 rounded-xl border transition-all text-left min-w-[150px] disabled:cursor-not-allowed ${
        accent
          ? "border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-40"
          : "border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40"
      }`}
    >
      {active && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400" title="완료" />
      )}
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
            accent ? "bg-purple-500 text-white" : "bg-white/20 text-white/70"
          }`}
        >
          {loading ? (
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            step
          )}
        </span>
        <span className="font-medium text-sm text-white">
          {loading ? "처리 중..." : label}
        </span>
      </div>
      <p className="text-xs text-white/40">{description}</p>
    </button>
  );
}
