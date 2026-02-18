import os
import json
import shutil
import tempfile
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from database import get_db, SessionLocal
from models import Project, Subtitle, Highlight
from schemas import RenderRequest, RenderProgressResponse
from dotenv import load_dotenv

load_dotenv()

MEDIA_BASE_PATH = os.getenv("MEDIA_BASE_PATH", "./media")

router = APIRouter(prefix="/projects", tags=["render"])

# 렌더링 진행률을 인메모리로 추적: {project_id: {"progress": 0-100, "stage": str}}
_render_progress: dict[int, dict] = {}


def _build_drawtext_filters(subtitles: list, time_offset: float = 0.0) -> list[str]:
    """자막 리스트에서 FFmpeg drawtext 필터 문자열을 생성합니다."""
    filters = []
    for sub in subtitles:
        style: dict = {}
        if sub.style_json:
            try:
                style = json.loads(sub.style_json)
            except Exception:
                pass

        x = style.get("x", "(w-text_w)/2")
        y = style.get("y", "h*0.8")
        font_size = style.get("fontSize", 36)
        color = style.get("color", "white")

        # 조정된 타임스탬프 계산
        start = sub.start_time - time_offset
        end = sub.end_time - time_offset

        # 구간 밖의 자막은 건너뜀
        if end <= 0:
            continue

        start = max(0.0, start)

        # 텍스트 이스케이프 (FFmpeg drawtext 특수문자 처리)
        escaped = (
            sub.text
            .replace("\\", "\\\\")
            .replace("'", "\u2019")
            .replace(":", "\\:")
            .replace(",", "\\,")
            .replace("[", "\\[")
            .replace("]", "\\]")
        )

        filters.append(
            f"drawtext=text='{escaped}'"
            f":x={x}:y={y}"
            f":fontsize={font_size}"
            f":fontcolor={color}"
            f":enable='between(t,{start:.3f},{end:.3f})'"
            f":borderw=2:bordercolor=black@0.8"
        )
    return filters


def _render_segment(
    source_path: str,
    output_path: str,
    start: float,
    duration: float,
    subtitles: list,
    time_offset: float,
) -> None:
    """단일 구간을 FFmpeg로 렌더링합니다."""
    import ffmpeg

    drawtext_filters = _build_drawtext_filters(subtitles, time_offset=time_offset)
    crop_and_scale = "crop=ih*9/16:ih,scale=1080:1920"

    if drawtext_filters:
        vf_full = crop_and_scale + "," + ",".join(drawtext_filters)
    else:
        vf_full = crop_and_scale

    (
        ffmpeg
        .input(source_path, ss=start, t=duration)
        .output(
            output_path,
            vf=vf_full,
            acodec="aac",
            vcodec="libx264",
            crf=23,
            preset="fast",
        )
        .overwrite_output()
        .run(quiet=True)
    )


def _render_video(
    project_id: int,
    source_path: str,
    output_path: str,
    subtitles: list,
    highlight_ids: Optional[List[int]] = None,
) -> None:
    """FFmpeg로 자막을 번인하고 9:16 숏폼으로 렌더링합니다.

    highlight_ids가 있으면 해당 하이라이트 구간만 추출·연결하여 렌더링합니다.
    """
    import ffmpeg

    db = SessionLocal()
    project = None
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return

        project.status = "rendering"
        db.commit()

        _render_progress[project_id] = {"progress": 0, "stage": "준비 중"}
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        highlights: list = []
        if highlight_ids:
            highlights = (
                db.query(Highlight)
                .filter(
                    Highlight.project_id == project_id,
                    Highlight.id.in_(highlight_ids),
                )
                .order_by(Highlight.start_time)
                .all()
            )

        if highlights:
            # ── 하이라이트 구간별 렌더링 후 연결 ──
            _render_progress[project_id] = {"progress": 5, "stage": "구간 추출 중"}
            temp_dir = tempfile.mkdtemp()
            segment_files: list[str] = []

            try:
                for i, hl in enumerate(highlights):
                    seg_path = os.path.join(temp_dir, f"seg_{i:03d}.mp4")
                    seg_duration = hl.end_time - hl.start_time

                    # 이 구간에 해당하는 자막 필터링
                    seg_subs = [
                        s for s in subtitles
                        if s.end_time > hl.start_time and s.start_time < hl.end_time
                    ]

                    _render_segment(
                        source_path=source_path,
                        output_path=seg_path,
                        start=hl.start_time,
                        duration=seg_duration,
                        subtitles=seg_subs,
                        time_offset=hl.start_time,
                    )
                    segment_files.append(seg_path)

                    progress = 5 + int((i + 1) / len(highlights) * 75)
                    _render_progress[project_id] = {
                        "progress": progress,
                        "stage": f"구간 {i + 1}/{len(highlights)} 렌더링 중",
                    }

                if len(segment_files) == 1:
                    shutil.move(segment_files[0], output_path)
                else:
                    # concat demuxer로 세그먼트 연결
                    _render_progress[project_id] = {"progress": 83, "stage": "구간 연결 중"}
                    concat_list = os.path.join(temp_dir, "concat.txt")
                    with open(concat_list, "w") as f:
                        for seg in segment_files:
                            f.write(f"file '{seg}'\n")

                    (
                        ffmpeg
                        .input(concat_list, format="concat", safe=0)
                        .output(output_path, c="copy")
                        .overwrite_output()
                        .run(quiet=True)
                    )
            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)

        else:
            # ── 전체 영상 렌더링 ──
            _render_progress[project_id] = {"progress": 10, "stage": "인코딩 중"}

            drawtext_filters = _build_drawtext_filters(subtitles)
            crop_and_scale = "crop=ih*9/16:ih,scale=1080:1920"

            if drawtext_filters:
                vf_full = crop_and_scale + "," + ",".join(drawtext_filters)
            else:
                vf_full = crop_and_scale

            (
                ffmpeg
                .input(source_path)
                .output(
                    output_path,
                    vf=vf_full,
                    acodec="aac",
                    vcodec="libx264",
                    crf=23,
                    preset="fast",
                )
                .overwrite_output()
                .run(quiet=True)
            )

        _render_progress[project_id] = {"progress": 100, "stage": "완료"}
        project.output_path = output_path
        project.status = "done"
        db.commit()

    except Exception as e:
        _render_progress[project_id] = {
            "progress": -1,
            "stage": f"오류: {str(e)[:120]}",
        }
        if project:
            project.status = "error"
            try:
                db.commit()
            except Exception:
                pass
        print(f"[render] 렌더링 오류 (project_id={project_id}): {e}")
    finally:
        db.close()


@router.post("/{project_id}/render")
def render_video(
    project_id: int,
    background_tasks: BackgroundTasks,
    payload: RenderRequest = Body(default=RenderRequest()),
    db: Session = Depends(get_db),
):
    """FFmpeg 렌더링을 시작합니다 (백그라운드 처리)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    if not project.source_path or not os.path.exists(project.source_path):
        raise HTTPException(status_code=400, detail="다운로드된 영상 파일이 없습니다.")

    if project.status == "rendering":
        raise HTTPException(status_code=409, detail="이미 렌더링 중입니다.")

    subtitles = (
        db.query(Subtitle)
        .filter(Subtitle.project_id == project_id)
        .order_by(Subtitle.start_time)
        .all()
    )

    output_dir = os.path.join(MEDIA_BASE_PATH, "outputs", str(project_id))
    output_path = os.path.join(output_dir, "final.mp4")

    background_tasks.add_task(
        _render_video,
        project_id,
        project.source_path,
        output_path,
        subtitles,
        payload.highlight_ids,
    )

    return {
        "message": "렌더링을 시작했습니다.",
        "project_id": project_id,
        "output_path": output_path,
    }


@router.get("/{project_id}/render/progress", response_model=RenderProgressResponse)
def get_render_progress(project_id: int, db: Session = Depends(get_db)):
    """렌더링 진행률을 반환합니다."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    info = _render_progress.get(project_id, {})

    output_url: Optional[str] = None
    if project.output_path and os.path.exists(project.output_path):
        output_url = f"/media/outputs/{project_id}/final.mp4"

    return RenderProgressResponse(
        project_id=project_id,
        status=project.status,
        progress=info.get("progress", 0),
        stage=info.get("stage", ""),
        output_url=output_url,
    )


@router.get("/{project_id}/output")
def download_output(project_id: int, db: Session = Depends(get_db)):
    """렌더링 완료된 영상을 다운로드합니다."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    if not project.output_path:
        raise HTTPException(status_code=404, detail="렌더링된 파일이 없습니다.")

    if not os.path.exists(project.output_path):
        raise HTTPException(
            status_code=404,
            detail=f"출력 파일을 찾을 수 없습니다: {project.output_path}",
        )

    filename = f"alphacut_{project_id}_final.mp4"
    return FileResponse(
        path=project.output_path,
        media_type="video/mp4",
        filename=filename,
    )
