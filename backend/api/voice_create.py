"""Voice creation API endpoints.

Handles creating voices from text prompts (Parler-TTS) and audio references.
"""

import shutil
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, File, Request, UploadFile, Form

from config import settings
from engines.base import VoiceProfile
from services.parler_service import ParlerVoiceService, GenerationCancelled
from services.voice_library import VoiceLibrary
from utils.logging_config import get_logger

logger = get_logger("api.voice_create")

router = APIRouter(prefix="/voices/create", tags=["voice-create"])

voice_library = VoiceLibrary(settings.voices_dir)
parler_service = ParlerVoiceService(
    previews_dir=settings.previews_dir,
    device=settings.device,
)


@router.get("/parler-status")
async def parler_status():
    """Check if Parler-TTS is installed and available."""
    available = parler_service.is_available()
    return {
        "available": available,
        "models": parler_service.get_models() if available else [],
    }


@router.post("/preview-from-prompt")
async def preview_from_prompt(
    request: Request,
    description: str = Form(...),
    sample_text: str = Form("Hello, this is a preview of my custom voice. I hope you like how it sounds."),
    model_id: str = Form("parler-mini-v1.1"),
    temperature: float = Form(1.0),
):
    """Generate a preview audio from a voice description using Parler-TTS.

    Does NOT save a voice profile -- just generates audio for the user to hear.
    """
    if not parler_service.is_available():
        raise HTTPException(
            status_code=400,
            detail="Parler-TTS is not installed. Run: pip install parler-tts",
        )

    logger.info(f"Preview from prompt [{model_id}]: '{description[:80]}' (temp={temperature})")

    try:
        audio_path, duration = await parler_service.generate_preview(
            description=description,
            sample_text=sample_text,
            model_id=model_id,
            temperature=temperature,
            request=request,
        )
    except GenerationCancelled:
        logger.info("Generation cancelled (client disconnected)")
        raise HTTPException(status_code=499, detail="Generation cancelled")
    except Exception as e:
        logger.error(f"Preview generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Preview generation failed: {e}")

    # Build URL for serving the preview audio
    date_part = audio_path.parent.name
    file_part = audio_path.name
    audio_url = f"/api/previews/{date_part}/{file_part}"

    return {
        "audio_url": audio_url,
        "duration": duration,
        "model_id": model_id,
    }


@router.post("/save-from-prompt")
async def save_from_prompt(
    name: str = Form(...),
    description: str = Form(...),
    audio_url: str = Form(...),
    engine: str = Form("parler-tts"),
):
    """Save a previously previewed voice as a voice profile.

    Copies the preview audio as reference.wav for the new voice profile.
    """
    logger.info(f"Saving voice from prompt: name={name!r}")

    # Resolve the preview audio file from the URL
    # audio_url is like /api/previews/20260220/preview_abc123.wav
    parts = audio_url.strip("/").split("/")
    if len(parts) < 4:
        raise HTTPException(status_code=400, detail="Invalid audio URL")

    date_part = parts[-2]
    file_part = parts[-1]

    # Path traversal protection
    for part in (date_part, file_part):
        if ".." in part or "/" in part or "\\" in part:
            raise HTTPException(status_code=400, detail="Invalid audio URL")

    preview_path = (settings.previews_dir / date_part / file_part).resolve()
    if not str(preview_path).startswith(str(settings.previews_dir.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    if not preview_path.exists():
        raise HTTPException(status_code=404, detail="Preview audio not found. Generate a preview first.")

    # Create voice profile
    voice_id = str(uuid.uuid4())
    voice_dir = settings.voices_dir / voice_id
    voice_dir.mkdir(parents=True, exist_ok=True)

    # Copy preview audio as reference
    ref_path = voice_dir / "reference.wav"
    shutil.copy2(str(preview_path), str(ref_path))

    profile = VoiceProfile(
        id=voice_id,
        name=name,
        engine=engine,
        reference_audio_path=str(ref_path),
        reference_text=None,
        created_at=datetime.now().isoformat(),
        source="prompt",
        description=description,
    )
    voice_library.save_voice(profile)

    logger.info(f"Voice saved from prompt: {name} (id={voice_id})")
    return profile.to_dict()


@router.post("/from-audio")
async def create_from_audio(
    name: str = Form(...),
    reference_text: str = Form(""),
    audio: UploadFile = File(...),
):
    """Create a voice profile from an uploaded audio reference.

    Simply saves the audio as a reference file for the voice profile.
    No cloning engine is required.
    """
    logger.info(f"Create from audio: name={name!r}, file={audio.filename}")

    # Create voice profile directory
    voice_id = str(uuid.uuid4())
    voice_dir = settings.voices_dir / voice_id
    voice_dir.mkdir(parents=True, exist_ok=True)

    # Save uploaded audio as reference
    ref_path = voice_dir / "reference.wav"
    content = await audio.read()
    ref_path.write_bytes(content)
    logger.debug(f"Saved reference audio: {ref_path} ({len(content)} bytes)")

    profile = VoiceProfile(
        id=voice_id,
        name=name,
        engine="reference",
        reference_audio_path=str(ref_path),
        reference_text=reference_text or None,
        created_at=datetime.now().isoformat(),
        source="audio",
        description=None,
    )
    voice_library.save_voice(profile)

    logger.info(f"Voice created from audio: {name} (id={voice_id})")
    return profile.to_dict()
