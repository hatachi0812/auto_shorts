# Alphacut - 숏폼 자동 제작 도구

YouTube 영상을 AI로 분석하여 숏폼(9:16) 콘텐츠를 자동 제작하는 로컬 도구입니다.

## 아키텍처

```
YouTube URL → yt-dlp 다운로드 → Whisper STT → GPT-4o 하이라이트 추출 → Next.js 에디터 → FFmpeg 렌더링
```

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일을 열어 OPENAI_API_KEY를 입력하세요
```

### 2. 백엔드 설치 및 실행

```bash
cd apps/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API 문서: http://localhost:8000/docs

### 3. 프론트엔드 설치 및 실행

```bash
cd apps/web
npm install
npm run dev
```

웹 앱: http://localhost:3000

### 사전 요구사항

- Python 3.10+
- Node.js 18+
- ffmpeg (시스템에 설치 필요: `brew install ffmpeg`)
- yt-dlp (`pip install yt-dlp` 또는 `brew install yt-dlp`)

## 폴더 구조

```
Alphacut_project/
├── apps/
│   ├── api/                   # Python FastAPI 백엔드
│   │   ├── main.py
│   │   ├── models.py          # SQLAlchemy 모델 (Project, Subtitle, Template)
│   │   ├── database.py        # SQLite 연결
│   │   ├── schemas.py         # Pydantic 스키마
│   │   └── routers/
│   │       ├── projects.py    # 프로젝트 CRUD
│   │       ├── ingest.py      # yt-dlp 다운로드
│   │       ├── ai.py          # Whisper + GPT-4o
│   │       └── render.py      # FFmpeg 렌더링
│   └── web/                   # Next.js 14 프론트엔드
│       ├── app/
│       │   ├── page.tsx       # 프로젝트 목록
│       │   └── projects/[id]/ # 에디터 페이지
│       └── lib/api.ts         # API 클라이언트
├── media/
│   ├── uploads/               # 다운로드된 원본 영상
│   └── outputs/               # 렌더링 완료 영상
├── local.db                   # SQLite DB (자동 생성)
└── .env                       # 환경 변수
```

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | /projects | 프로젝트 생성 |
| GET | /projects | 프로젝트 목록 |
| GET | /projects/{id} | 프로젝트 상세 |
| GET | /projects/{id}/status | 상태 폴링 |
| POST | /projects/{id}/download | yt-dlp 다운로드 |
| POST | /projects/{id}/transcribe | Whisper STT |
| POST | /projects/{id}/highlight | GPT-4o 하이라이트 |
| PUT | /projects/{id}/subtitles | 자막 저장 |
| POST | /projects/{id}/render | FFmpeg 렌더링 |

## 프로젝트 상태

`pending` → `downloading` → `ready` → `transcribing` → `ready` → `rendering` → `done`
