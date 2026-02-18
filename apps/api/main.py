from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import engine
import models

from routers import projects, ingest, ai, render

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Alphacut API",
    description="숏폼 자동 제작 도구 - 로컬 FastAPI 백엔드",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MEDIA_BASE_PATH = os.getenv("MEDIA_BASE_PATH", "./media")
outputs_path = os.path.join(MEDIA_BASE_PATH, "outputs")
os.makedirs(outputs_path, exist_ok=True)
app.mount("/media/outputs", StaticFiles(directory=outputs_path), name="outputs")

app.include_router(projects.router)
app.include_router(ingest.router)
app.include_router(ai.router)
app.include_router(render.router)


@app.get("/")
def root():
    return {"message": "Alphacut API가 정상 동작 중입니다.", "docs": "/docs"}
