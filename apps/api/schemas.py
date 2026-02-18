from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class ProjectCreate(BaseModel):
    title: str
    source_url: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    title: str
    status: str
    source_url: Optional[str]
    source_path: Optional[str]
    output_path: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectStatusResponse(BaseModel):
    id: int
    status: str

    model_config = {"from_attributes": True}


class SubtitleResponse(BaseModel):
    id: int
    project_id: int
    start_time: float
    end_time: float
    text: str
    style_json: Optional[str]

    model_config = {"from_attributes": True}


class SubtitleUpdate(BaseModel):
    subtitles: list[dict]


class HighlightResponse(BaseModel):
    id: int
    project_id: int
    title: str
    start_time: float
    end_time: float
    reason: Optional[str]
    order: int

    model_config = {"from_attributes": True}


class RenderRequest(BaseModel):
    highlight_ids: Optional[List[int]] = None
    include_subtitles: bool = True


class RenderProgressResponse(BaseModel):
    project_id: int
    status: str
    progress: int
    stage: str
    output_url: Optional[str]
