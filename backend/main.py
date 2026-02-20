import threading
import time
import uuid
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from utils.logging_config import setup_logging, get_logger
from config import settings
from api.router import api_router
from engines.engine_manager import engine_manager
from engines.kokoro_engine import KokoroEngine
from engines.fish_speech_engine import FishSpeechEngine
from engines.f5tts_engine import F5TTSEngine

logger = get_logger("main")


def register_engines():
    """Register all available TTS engines."""
    kokoro = KokoroEngine(outputs_dir=settings.outputs_dir)
    engine_manager.register(kokoro)
    logger.info(f"Registered engine: kokoro (available={kokoro.is_available()})")

    fish = FishSpeechEngine(
        models_dir=settings.models_dir,
        voices_dir=settings.voices_dir,
        outputs_dir=settings.outputs_dir,
    )
    engine_manager.register(fish)
    logger.info(f"Registered engine: fish-speech (available={fish.is_available()})")

    f5 = F5TTSEngine(
        models_dir=settings.models_dir,
        voices_dir=settings.voices_dir,
        outputs_dir=settings.outputs_dir,
    )
    engine_manager.register(f5)
    logger.info(f"Registered engine: f5-tts (available={f5.is_available()})")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("AI Voice Studio starting up...")
    settings.ensure_directories()
    register_engines()
    logger.info(f"Server: http://{settings.host}:{settings.port}")
    yield
    # Shutdown
    logger.info("Shutting down -- cleaning up...")
    active = engine_manager.get_active_engine()
    if active:
        try:
            await active.unload_model()
            logger.info(f"Unloaded engine: {engine_manager.get_active_name()}")
        except Exception as e:
            logger.warning(f"Error unloading engine: {e}")
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("GPU memory cleared")
    except Exception:
        pass
    # Close WebSocket connections
    from api.ws import ws_manager
    for conn in ws_manager.active_connections[:]:
        try:
            await conn.close()
        except Exception:
            pass
    logger.info("Shutdown complete")


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# CORS for dev and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8765",
        "http://127.0.0.1:8765",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start = time.time()
    logger.debug(f"[{request_id}] {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        elapsed = time.time() - start
        logger.debug(f"[{request_id}] {response.status_code} ({elapsed:.2f}s)")
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as e:
        elapsed = time.time() - start
        logger.exception(f"[{request_id}] Unhandled error after {elapsed:.2f}s: {e}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request_id},
        )


# Mount API routes
app.include_router(api_router, prefix="/api")

# Serve React build if it exists (production mode)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
    logger.info(f"Serving frontend from {frontend_dist}")


def open_browser_when_ready():
    """Poll the server until it responds, then open the browser."""
    import urllib.request
    url = f"http://{settings.host}:{settings.port}/api/health"
    for _ in range(30):
        time.sleep(0.5)
        try:
            urllib.request.urlopen(url, timeout=2)
            webbrowser.open(f"http://{settings.host}:{settings.port}")
            return
        except Exception:
            pass
    # Fallback: open anyway after 15s
    webbrowser.open(f"http://{settings.host}:{settings.port}")


if __name__ == "__main__":
    setup_logging(log_dir=settings.logs_dir)
    logger.info("Starting AI Voice Studio...")
    threading.Thread(target=open_browser_when_ready, daemon=True).start()
    uvicorn.run(app, host=settings.host, port=settings.port)
