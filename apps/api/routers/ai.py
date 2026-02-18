import os
import json
import tempfile
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List

from database import get_db, SessionLocal
from models import Project, Subtitle, Highlight
from schemas import HighlightResponse
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/projects", tags=["ai"])

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
WHISPER_FILE_SIZE_LIMIT = 25 * 1024 * 1024  # 25MB


def _extract_audio_if_needed(source_path: str) -> tuple[str, bool]:
    """
    영상 파일이 25MB를 초과하면 ffmpeg으로 오디오만 추출합니다.
    Returns (파일경로, 임시파일여부)
    """
    file_size = os.path.getsize(source_path)
    if file_size <= WHISPER_FILE_SIZE_LIMIT:
        return source_path, False

    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    tmp.close()
    audio_path = tmp.name

    import ffmpeg as ffmpeg_lib
    (
        ffmpeg_lib
        .input(source_path)
        .output(audio_path, acodec="libmp3lame", audio_bitrate="64k", vn=None)
        .overwrite_output()
        .run(quiet=True)
    )
    return audio_path, True


def _transcribe_video(project_id: int, source_path: str):
    """Whisper API로 STT를 수행하고 자막을 DB에 저장합니다."""
    from openai import OpenAI

    db = SessionLocal()
    audio_path = None
    is_temp = False
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return

        project.status = "transcribing"
        db.commit()

        audio_path, is_temp = _extract_audio_if_needed(source_path)

        client = OpenAI(api_key=OPENAI_API_KEY)

        with open(audio_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

        db.query(Subtitle).filter(Subtitle.project_id == project_id).delete()

        for segment in transcript.segments:
            subtitle = Subtitle(
                project_id=project_id,
                start_time=segment.start,
                end_time=segment.end,
                text=segment.text.strip(),
            )
            db.add(subtitle)

        project.status = "ready"
        db.commit()

    except Exception as e:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.status = "error"
            db.commit()
        print(f"[ai] STT 오류 (project_id={project_id}): {e}")
    finally:
        db.close()
        if is_temp and audio_path and os.path.exists(audio_path):
            os.remove(audio_path)


def _extract_highlights_bg(project_id: int):
    """GPT-4o로 하이라이트를 추출하고 결과를 DB에 저장합니다."""
    from openai import OpenAI

    db = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return

        project.status = "highlighting"
        db.commit()

        subtitles = (
            db.query(Subtitle)
            .filter(Subtitle.project_id == project_id)
            .order_by(Subtitle.start_time)
            .all()
        )

        if not subtitles:
            project.status = "ready"
            db.commit()
            return

        transcript_text = "\n".join(
            [f"[{s.start_time:.1f}s ~ {s.end_time:.1f}s] {s.text}" for s in subtitles]
        )

        client = OpenAI(api_key=OPENAI_API_KEY)

        prompt = f"""다음은 영상의 자막입니다. 숏폼 콘텐츠로 활용하기 좋은 핵심 하이라이트 구간 3~5개를 추출해주세요.
각 구간은 30초~60초 이내로 설정해주세요.

자막:
{transcript_text}

다음 JSON 형식으로만 응답해주세요:
{{
  "highlights": [
    {{
      "title": "구간 제목",
      "start_time": 시작초(숫자),
      "end_time": 종료초(숫자),
      "reason": "선택 이유"
    }}
  ]
}}"""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)
        highlights_data = result.get("highlights", [])

        db.query(Highlight).filter(Highlight.project_id == project_id).delete()

        for idx, item in enumerate(highlights_data):
            highlight = Highlight(
                project_id=project_id,
                title=item.get("title", f"하이라이트 {idx + 1}"),
                start_time=float(item.get("start_time", 0)),
                end_time=float(item.get("end_time", 0)),
                reason=item.get("reason"),
                order=idx,
            )
            db.add(highlight)

        project.status = "ready"
        db.commit()

    except Exception as e:
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.status = "error"
            db.commit()
        print(f"[ai] 하이라이트 추출 오류 (project_id={project_id}): {e}")
    finally:
        db.close()


@router.post("/{project_id}/transcribe")
def transcribe(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Whisper API로 STT를 시작합니다 (백그라운드 처리)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    if not project.source_path or not os.path.exists(project.source_path):
        raise HTTPException(
            status_code=400,
            detail="다운로드된 영상 파일이 없습니다. 먼저 다운로드를 완료하세요.",
        )

    if project.status == "transcribing":
        raise HTTPException(status_code=409, detail="이미 자막 추출 중입니다.")

    background_tasks.add_task(_transcribe_video, project_id, project.source_path)
    return {"message": "STT를 시작했습니다.", "project_id": project_id}


@router.post("/{project_id}/highlight")
def extract_highlight(
    project_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """GPT-4o로 하이라이트 구간을 추출합니다 (백그라운드 처리)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    subtitles = (
        db.query(Subtitle)
        .filter(Subtitle.project_id == project_id)
        .first()
    )
    if not subtitles:
        raise HTTPException(
            status_code=400,
            detail="자막 데이터가 없습니다. 먼저 STT를 실행하세요.",
        )

    if project.status == "highlighting":
        raise HTTPException(status_code=409, detail="이미 하이라이트 추출 중입니다.")

    background_tasks.add_task(_extract_highlights_bg, project_id)
    return {"message": "하이라이트 추출을 시작했습니다.", "project_id": project_id}


@router.get("/{project_id}/highlights", response_model=List[HighlightResponse])
def get_highlights(project_id: int, db: Session = Depends(get_db)):
    """저장된 하이라이트 구간 목록을 반환합니다."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    return (
        db.query(Highlight)
        .filter(Highlight.project_id == project_id)
        .order_by(Highlight.order)
        .all()
    )
