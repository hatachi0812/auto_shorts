"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { projectApi, Project, STATUS_LABELS, STATUS_COLORS } from "@/lib/api";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchProjects = async () => {
    try {
      const res = await projectApi.list();
      setProjects(res.data);
    } catch {
      setError("백엔드 서버에 연결할 수 없습니다. (http://localhost:8000)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await projectApi.create({ title: title.trim(), source_url: url.trim() || undefined });
      setTitle("");
      setUrl("");
      setShowForm(false);
      await fetchProjects();
    } catch {
      setError("프로젝트 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("프로젝트를 삭제하시겠습니까?")) return;
    try {
      await projectApi.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError("삭제에 실패했습니다.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">프로젝트</h1>
          <p className="text-white/50 mt-1 text-sm">YouTube URL을 입력하여 숏폼을 자동 제작하세요</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white font-medium text-sm transition-all"
        >
          + 새 프로젝트
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
          <button onClick={() => setError("")} className="ml-3 underline">닫기</button>
        </div>
      )}

      {showForm && (
        <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-xl">
          <h2 className="text-lg font-semibold mb-4">새 프로젝트 만들기</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">프로젝트 이름 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 인터뷰 하이라이트 #1"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">YouTube URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-white font-medium text-sm transition-colors"
              >
                {creating ? "생성 중..." : "프로젝트 생성"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 font-medium text-sm transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-white/40">불러오는 중...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-xl">
          <p className="text-white/40 text-lg">아직 프로젝트가 없습니다</p>
          <p className="text-white/25 text-sm mt-2">위의 &apos;새 프로젝트&apos; 버튼을 눌러 시작하세요</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-white/10 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-5 py-3 text-white/50 font-medium">#</th>
                <th className="text-left px-5 py-3 text-white/50 font-medium">프로젝트명</th>
                <th className="text-left px-5 py-3 text-white/50 font-medium">상태</th>
                <th className="text-left px-5 py-3 text-white/50 font-medium">생성일</th>
                <th className="text-right px-5 py-3 text-white/50 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-5 py-4 text-white/30">{p.id}</td>
                  <td className="px-5 py-4">
                    <Link href={`/projects/${p.id}`} className="text-white hover:text-purple-400 transition-colors font-medium">
                      {p.title}
                    </Link>
                    {p.source_url && (
                      <p className="text-white/30 text-xs mt-0.5 truncate max-w-xs">{p.source_url}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-white/40">{formatDate(p.created_at)}</td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/projects/${p.id}`}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-md text-white/70 hover:text-white text-xs transition-colors"
                      >
                        열기
                      </Link>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-md text-red-400 hover:text-red-300 text-xs transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
