import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import analysis


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    # Startup
    yield
    # Shutdown – nothing to clean up currently


app = FastAPI(
    title="DiffSight",
    version="0.1.0",
    description="Semantic pull request risk analysis via multi-agent AST pipeline.",
    lifespan=lifespan,
)

# Parse allowed origins from env; default to localhost for local dev
_raw_origins = os.getenv("DIFFSIGHT_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    """Liveness probe used by Render and other orchestrators."""
    return {"status": "ok"}


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    """Root route – confirms the API is reachable."""
    return {"service": "DiffSight", "version": "0.1.0", "docs": "/docs"}
