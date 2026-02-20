from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from config import settings
from services.audio_processing import AudioProcessor
from utils.logging_config import get_logger

logger = get_logger("api.audio")

router = APIRouter(prefix="/audio", tags=["audio"])

MEDIA_TYPES = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
}


def _resolve_audio_path(date: str, filename: str) -> Path:
    """Resolve and validate audio file path, preventing path traversal."""
    for part in (date, filename):
        if ".." in part or "/" in part or "\\" in part:
            logger.warning(f"Path traversal attempt blocked: date={date!r} filename={filename!r}")
            raise HTTPException(status_code=400, detail="Invalid path")

    path = (settings.outputs_dir / date / filename).resolve()

    if not str(path).startswith(str(settings.outputs_dir.resolve())):
        logger.warning(f"Path escaped outputs_dir: {path}")
        raise HTTPException(status_code=403, detail="Access denied")

    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")

    return path


@router.get("/{date}/{filename}")
async def serve_audio(date: str, filename: str):
    path = _resolve_audio_path(date, filename)
    media_type = MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream")
    logger.debug(f"Serving audio: {path.name} ({media_type})")
    return FileResponse(str(path), media_type=media_type, filename=filename)


@router.get("/{date}/{filename}/export")
async def export_audio(
    date: str,
    filename: str,
    format: str = Query("wav", pattern="^(wav|mp3|flac|ogg)$"),
):
    """Export audio in a specific format."""
    source = _resolve_audio_path(date, filename)

    if source.suffix.lstrip(".") == format:
        media_type = MEDIA_TYPES.get(f".{format}", "application/octet-stream")
        return FileResponse(str(source), media_type=media_type, filename=filename)

    logger.info(f"Converting {source.name} to {format}")
    try:
        converted = AudioProcessor.convert_format(source, format)
        media_type = MEDIA_TYPES.get(f".{format}", "application/octet-stream")
        logger.debug(f"Conversion complete: {converted.name}")
        return FileResponse(
            str(converted),
            media_type=media_type,
            filename=converted.name,
        )
    except RuntimeError as e:
        logger.error(f"Format conversion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{date}/{filename}/normalize")
async def normalize_audio(date: str, filename: str):
    """Normalize audio loudness."""
    source = _resolve_audio_path(date, filename)
    logger.info(f"Normalizing: {source.name}")
    try:
        result = AudioProcessor.normalize_audio(source)
        logger.debug(f"Normalized output: {result.name}")
        return {"audio_url": f"/api/audio/{date}/{result.name}"}
    except Exception as e:
        logger.error(f"Normalization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Normalization failed: {e}")


@router.post("/{date}/{filename}/trim")
async def trim_silence(date: str, filename: str):
    """Trim leading/trailing silence."""
    source = _resolve_audio_path(date, filename)
    logger.info(f"Trimming silence: {source.name}")
    try:
        result = AudioProcessor.trim_silence(source)
        logger.debug(f"Trimmed output: {result.name}")
        return {"audio_url": f"/api/audio/{date}/{result.name}"}
    except Exception as e:
        logger.error(f"Trim failed: {e}")
        raise HTTPException(status_code=500, detail=f"Trim failed: {e}")
