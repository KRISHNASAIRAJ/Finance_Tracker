from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.routers import auth, finance, garage, tasks, personal, sync
import app.models

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Meridian API",
    version="1.0.0",
    description="Backend for Meridian Personal Life Tracker",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(finance.router, prefix="/api/v1")
app.include_router(garage.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(personal.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok", "app": "meridian"}
