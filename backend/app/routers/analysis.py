"""WebSocket analysis endpoint with granular validation and error recovery."""
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ..agents import run_pipeline
from ..schemas import PullRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/analyze")
async def analyze_socket(ws: WebSocket) -> None:
    """Stream risk analysis over WebSocket.

    Protocol:
    - Client sends a PullRequest JSON payload after connection.
    - Server streams ``{"type":"agent",...}`` progress frames with progress% and ts.
    - Server emits ``{"type":"report","report":{...}}`` on success.
    - Server emits ``{"type":"error","message":"...","code":"..."}`` on failure.
    - Connection stays open for subsequent requests in the same session.
    """
    await ws.accept()
    logger.info("ws.connected", extra={"client": str(ws.client)})

    try:
        while True:
            # ── Receive ───────────────────────────────────────────────────────
            try:
                payload = await ws.receive_json()
            except ValueError:
                await ws.send_json({
                    "type": "error", "code": "invalid_json",
                    "message": "Invalid JSON payload \u2014 could not decode frame.",
                })
                continue

            # ── Validate payload ──────────────────────────────────────────────
            try:
                pr = PullRequest.model_validate(payload)
            except ValidationError as exc:
                errors = exc.errors()[:5]
                detail = "; ".join(
                    f"{'.'.join(str(l) for l in e['loc'])}: {e['msg']}"
                    for e in errors
                )
                await ws.send_json({
                    "type":    "error",
                    "code":    "validation_error",
                    "message": f"Payload validation failed ({exc.error_count()} error(s)): {detail}",
                    "errors":  errors,
                })
                logger.warning(
                    "ws.validation_error",
                    extra={"error_count": exc.error_count(), "detail": detail},
                )
                continue

            # ── Run pipeline ──────────────────────────────────────────────────
            logger.info("ws.pipeline_start", extra={"title": pr.title, "files": len(pr.files)})
            try:
                async for event in run_pipeline(pr):
                    await ws.send_json(event)
            except Exception as exc:
                logger.exception("ws.pipeline_error", extra={"title": pr.title})
                await ws.send_json({
                    "type":    "error",
                    "code":    "pipeline_error",
                    "message": f"Analysis failed: {exc}",
                })

    except WebSocketDisconnect:
        logger.info("ws.disconnected", extra={"client": str(ws.client)})
    except Exception as exc:
        logger.exception("ws.unexpected_error")
        try:
            await ws.send_json({
                "type": "error", "code": "server_error",
                "message": "An unexpected server error occurred.",
            })
        except Exception:
            pass
