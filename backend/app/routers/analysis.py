import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ..agents import run_pipeline
from ..schemas import PullRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/analyze")
async def analyze_socket(ws: WebSocket) -> None:
    """
    WebSocket endpoint for streaming risk analysis.

    Protocol (JSON frames):
    - Client sends a PullRequest payload after connection is established.
    - Server streams ``{"type": "agent", ...}`` progress frames.
    - Server emits a final ``{"type": "report", "report": {...}}`` frame on success.
    - Server emits ``{"type": "error", "message": "..."}`` on validation or pipeline errors.
    - Connection is kept open for subsequent requests in the same session.
    """
    await ws.accept()
    logger.info("WebSocket connection accepted from %s", ws.client)

    try:
        while True:
            try:
                payload = await ws.receive_json()
            except ValueError:
                await ws.send_json(
                    {"type": "error", "message": "Invalid JSON payload received."}
                )
                continue

            # Validate the incoming pull request payload
            try:
                pr = PullRequest.model_validate(payload)
            except ValidationError as exc:
                err_count = exc.error_count()
                await ws.send_json(
                    {
                        "type": "error",
                        "message": f"Invalid pull request payload: {err_count} validation error(s). "
                        + "; ".join(
                            f"{'.'.join(str(l) for l in e['loc'])}: {e['msg']}"
                            for e in exc.errors()[:3]
                        ),
                    }
                )
                continue

            # Run the multi-agent analysis pipeline
            try:
                async for event in run_pipeline(pr):
                    await ws.send_json(event)
            except Exception as exc:
                logger.exception("Pipeline error for PR '%s'", pr.title)
                await ws.send_json(
                    {"type": "error", "message": f"Analysis failed: {exc}"}
                )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected: %s", ws.client)
    except Exception as exc:
        logger.exception("Unexpected WebSocket error: %s", exc)
        try:
            await ws.send_json(
                {"type": "error", "message": "An unexpected server error occurred."}
            )
        except Exception:
            pass  # client already gone
