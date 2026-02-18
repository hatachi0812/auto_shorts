import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db
from models import Project
from dotenv import load_dotenv

load_dotenv()

MEDIA_BASE_PATH = os.getenv("MEDIA_BASE_PATH", "./media")

router = APIRouter(prefix="/projects", tags=["ingest"])


def _download_video(project_id: int, url: str, output_dir: str):
    """yt-dlp로 영상을 다운로드하고 프로젝트 상태를 업데이트합니다."""
    from database import SessionLocal

    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return

        project.status = "downloading"
        db.commit()

        os.makedirs(output_dir, exist_ok=True)

        import yt_dlp

        ydl_opts = {
            "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "outtmpl": os.path.join(output_dir, "%(title)s.%(ext)s"),
            "merge_output_format": "mp4",
            "quiet": False,
            "no_warnings": False,
            # YouTube 403 오류 해결을 위한 옵션
            "extractor_args": {
                "youtube": {
                    "player_client": ["android"],  # android 클라이언트 사용 (403 오류 회피)
                }
            },
            # User-Agent 설정 (최신 Chrome)
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            # 재시도 설정
            "retries": 10,
            "fragment_retries": 10,
            # 추가 헤더 설정
            "http_headers": {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-us,en;q=0.5",
                "Accept-Encoding": "gzip, deflate",
                "Accept-Charset": "ISO-8859-1,utf-8;q=0.7,*;q=0.7",
                "Keep-Alive": "300",
                "Connection": "keep-alive",
            },
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            # .mp4 확장자 보장
            if not filename.endswith(".mp4"):
                base, _ = os.path.splitext(filename)
                filename = base + ".mp4"

        project.source_path = filename
        project.status = "ready"
        db.commit()

    except Exception as e:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.status = "error"
            db.commit()
        print(f"[ingest] 다운로드 오류 (project_id={project_id}): {e}")
    finally:
        db.close()


@router.post("/{project_id}/download")
def download_video(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    if not project.source_url:
        raise HTTPException(status_code=400, detail="다운로드할 URL이 없습니다. 프로젝트 생성 시 source_url을 지정해주세요.")

    if project.status == "downloading":
        raise HTTPException(status_code=409, detail="이미 다운로드 중입니다.")

    output_dir = os.path.join(MEDIA_BASE_PATH, "uploads", str(project_id))

    background_tasks.add_task(_download_video, project_id, project.source_url, output_dir)

    return {"message": "다운로드를 시작했습니다.", "project_id": project_id, "status": "downloading"}
