"""DiffSight FastAPI application — production-hardened entry point.

Features:
- Structured JSON logging (key=value extra fields via standard logging)
- Lifespan hooks for startup/shutdown telemetry
- Global exception handler returning structured JSON errors
- Request timing middleware (X-Response-Time-Ms header)
- CORS configured from env variable (comma-separated origins)
"""
import logging
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routers import analysis

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}',
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("diffsight")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", extra={"service": "diffsight", "version": "0.2.0"})
    yield
    logger.info("shutdown", extra={"service": "diffsight"})


app = FastAPI(
    title="DiffSight",
    version="0.2.0",
    description="Semantic pull request risk analysis via multi-agent AST pipeline.",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
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


# ── Global error handler ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def _global_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_error", extra={"path": request.url.path})
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "An unexpected error occurred."},
    )


# ── Request timing middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def _timing(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = int((time.perf_counter() - t0) * 1000)
    response.headers["X-Response-Time-Ms"] = str(ms)
    logger.info(
        "http_request",
        extra={
            "method": request.method,
            "path":   request.url.path,
            "status": response.status_code,
            "ms":     ms,
        },
    )
    return response


# ── Health / root ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "version": "0.2.0"}


@app.get("/", tags=["meta"])
async def root() -> dict:
    return {"service": "DiffSight", "version": "0.2.0", "docs": "/docs"}
