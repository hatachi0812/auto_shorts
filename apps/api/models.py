from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    # pending/downloading/transcribing/highlighting/ready/rendering/done/error
    status = Column(String, default="pending")
    source_url = Column(String, nullable=True)
    source_path = Column(String, nullable=True)
    output_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    subtitles = relationship("Subtitle", back_populates="project", cascade="all, delete-orphan")
    templates = relationship("Template", back_populates="project", cascade="all, delete-orphan")
    highlights = relationship("Highlight", back_populates="project", cascade="all, delete-orphan")


class Subtitle(Base):
    __tablename__ = "subtitles"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    text = Column(Text, nullable=False)
    style_json = Column(Text, nullable=True)  # JSON: { x, y, fontSize, color, fontFamily }

    project = relationship("Project", back_populates="subtitles")


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    layout_json = Column(Text, nullable=True)  # JSON: { subtitleRegion, logoRegion, aspectRatio }
    font_json = Column(Text, nullable=True)

    project = relationship("Project", back_populates="templates")


class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    title = Column(String, nullable=False)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    order = Column(Integer, default=0)

    project = relationship("Project", back_populates="highlights")
