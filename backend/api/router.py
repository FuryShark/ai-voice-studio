import os
import signal

import torch
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from utils.logging_config import get_logger
from .tts import router as tts_router
from .audio import router as audio_router
from .voices import router as voices_router
from .voice_create import router as voice_create_router
from .previews import router as previews_router
from .ws import router as ws_router
from .gpu import router as gpu_router

logger = get_logger("api.router")

api_router = APIRouter()

# Include sub-routers
api_router.include_router(tts_router)
api_router.include_router(audio_router)
api_router.include_router(voices_router)
api_router.include_router(voice_create_router)
api_router.include_router(previews_router)
api_router.include_router(ws_router)
api_router.include_router(gpu_router)


@api_router.get("/health")
async def health_check():
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
    logger.debug(f"Health check: gpu={gpu_available}, name={gpu_name}")
    return {
        "status": "ok",
        "gpu_available": gpu_available,
        "gpu_name": gpu_name,
    }


@api_router.post("/restart")
async def restart_server():
    """Restart the server by exiting with code 42 (caught by start.bat loop)."""
    import threading

    logger.info("Server restart requested")

    def _shutdown():
        import time
        time.sleep(0.5)
        os._exit(42)

    threading.Thread(target=_shutdown, daemon=True).start()
    return JSONResponse({"status": "restarting"})
