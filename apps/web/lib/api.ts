import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface Project {
  id: number;
  title: string;
  status: string;
  source_url: string | null;
  source_path: string | null;
  output_path: string | null;
  created_at: string;
}

export interface Subtitle {
  id: number;
  project_id: number;
  start_time: number;
  end_time: number;
  text: string;
  style_json: string | null;
}

export interface Highlight {
  id: number;
  project_id: number;
  title: string;
  start_time: number;
  end_time: number;
  reason: string | null;
  order: number;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "대기 중",
  downloading: "다운로드 중",
  transcribing: "자막 추출 중",
  highlighting: "하이라이트 분석 중",
  ready: "준비됨",
  rendering: "렌더링 중",
  done: "완료",
  error: "오류",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-400",
  downloading: "bg-blue-500/20 text-blue-400",
  transcribing: "bg-yellow-500/20 text-yellow-400",
  highlighting: "bg-orange-500/20 text-orange-400",
  ready: "bg-green-500/20 text-green-400",
  rendering: "bg-purple-500/20 text-purple-400",
  done: "bg-emerald-500/20 text-emerald-400",
  error: "bg-red-500/20 text-red-400",
};

export interface RenderProgress {
  project_id: number;
  status: string;
  progress: number;
  stage: string;
  output_url: string | null;
}

export const projectApi = {
  list: () => api.get<Project[]>("/projects"),
  get: (id: number) => api.get<Project>(`/projects/${id}`),
  create: (data: { title: string; source_url?: string }) =>
    api.post<Project>("/projects", data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  getStatus: (id: number) => api.get<{ id: number; status: string }>(`/projects/${id}/status`),
  download: (id: number) => api.post(`/projects/${id}/download`),
  transcribe: (id: number) => api.post(`/projects/${id}/transcribe`),
  highlight: (id: number) => api.post(`/projects/${id}/highlight`),
  getHighlights: (id: number) => api.get<Highlight[]>(`/projects/${id}/highlights`),
  render: (id: number, options?: { highlight_ids?: number[] }) =>
    api.post(`/projects/${id}/render`, options ?? {}),
  getRenderProgress: (id: number) =>
    api.get<RenderProgress>(`/projects/${id}/render/progress`),
  getSubtitles: (id: number) => api.get<Subtitle[]>(`/projects/${id}/subtitles`),
  updateSubtitles: (id: number, subtitles: object[]) =>
    api.put(`/projects/${id}/subtitles`, { subtitles }),
  getVideoUrl: (id: number) => `${API_BASE}/projects/${id}/video`,
  getOutputUrl: (id: number) => `${API_BASE}/media/outputs/${id}/final.mp4`,
  downloadOutput: (id: number) => `${API_BASE}/projects/${id}/output`,
};
