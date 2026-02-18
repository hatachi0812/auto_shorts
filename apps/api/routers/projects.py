import os
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Project, Subtitle
from schemas import ProjectCreate, ProjectResponse, ProjectStatusResponse, SubtitleResponse, SubtitleUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(title=payload.title, source_url=payload.source_url)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.created_at.desc()).all()


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    return project


@router.get("/{project_id}/status", response_model=ProjectStatusResponse)
def get_project_status(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    return project


@router.get("/{project_id}/subtitles", response_model=List[SubtitleResponse])
def get_subtitles(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    return db.query(Subtitle).filter(Subtitle.project_id == project_id).order_by(Subtitle.start_time).all()


@router.put("/{project_id}/subtitles")
def update_subtitles(project_id: int, payload: SubtitleUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")

    db.query(Subtitle).filter(Subtitle.project_id == project_id).delete()

    for item in payload.subtitles:
        subtitle = Subtitle(
            project_id=project_id,
            start_time=item.get("start_time", 0),
            end_time=item.get("end_time", 0),
            text=item.get("text", ""),
            style_json=json.dumps(item.get("style_json")) if item.get("style_json") else None,
        )
        db.add(subtitle)

    db.commit()
    return {"message": "자막이 저장되었습니다.", "count": len(payload.subtitles)}


@router.get("/{project_id}/video")
def get_project_video(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    if not project.source_path:
        raise HTTPException(status_code=404, detail="다운로드된 영상이 없습니다.")
    if not os.path.exists(project.source_path):
        raise HTTPException(status_code=404, detail=f"영상 파일을 찾을 수 없습니다: {project.source_path}")
    return FileResponse(
        project.source_path,
        media_type="video/mp4",
        headers={"Accept-Ranges": "bytes"},
    )


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="프로젝트를 찾을 수 없습니다.")
    db.delete(project)
    db.commit()
    return {"message": "프로젝트가 삭제되었습니다."}
