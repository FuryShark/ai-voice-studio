import json
import re
import uuid
import zipfile
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, HTTPException, File, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from config import settings
from engines.base import VoiceProfile
from services.voice_library import VoiceLibrary
from utils.logging_config import get_logger

logger = get_logger("api.voices")

router = APIRouter(prefix="/voices", tags=["voices"])

voice_library = VoiceLibrary(settings.voices_dir)

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def _validate_voice_id(voice_id: str) -> None:
    """Validate that voice_id is a UUID to prevent path traversal."""
    if not _UUID_RE.match(voice_id):
        raise HTTPException(status_code=400, detail="Invalid voice ID")


@router.get("")
async def list_voices():
    voices = voice_library.list_voices()
    logger.debug(f"Listed {len(voices)} voices")
    return [v.to_dict() for v in voices]


@router.get("/{voice_id}")
async def get_voice(voice_id: str):
    _validate_voice_id(voice_id)
    voice = voice_library.get_voice(voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")
    return voice.to_dict()


@router.delete("/{voice_id}")
async def delete_voice(voice_id: str):
    _validate_voice_id(voice_id)
    if not voice_library.delete_voice(voice_id):
        raise HTTPException(status_code=404, detail="Voice not found")
    logger.info(f"Deleted voice: {voice_id}")
    return {"status": "deleted"}


@router.get("/{voice_id}/audio")
async def get_voice_audio(voice_id: str):
    """Serve the reference audio for a voice profile."""
    _validate_voice_id(voice_id)
    voice = voice_library.get_voice(voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")

    voice_dir = settings.voices_dir / voice_id
    ref_path = voice_dir / "reference.wav"
    if not ref_path.exists():
        raise HTTPException(status_code=404, detail="Reference audio not found")

    return FileResponse(str(ref_path), media_type="audio/wav")


@router.get("/{voice_id}/export")
async def export_voice(voice_id: str):
    _validate_voice_id(voice_id)
    voice = voice_library.get_voice(voice_id)
    if not voice:
        raise HTTPException(status_code=404, detail="Voice not found")

    voice_dir = settings.voices_dir / voice_id
    if not voice_dir.exists():
        raise HTTPException(status_code=404, detail="Voice directory not found")

    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in voice_dir.iterdir():
            if file_path.is_file():
                zf.write(file_path, file_path.name)

    buf.seek(0)
    safe_name = voice.name.replace(" ", "_").replace("/", "_")
    logger.info(f"Exported voice: {voice.name} (id={voice_id})")

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'},
    )


@router.post("/import")
async def import_voice(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Please upload a .zip file")

    content = await file.read()
    logger.info(f"Import request: {file.filename} ({len(content)} bytes)")

    try:
        zf = zipfile.ZipFile(BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid zip file")

    if "metadata.json" not in zf.namelist():
        raise HTTPException(status_code=400, detail="Invalid voice archive: missing metadata.json")

    # Read and update metadata with new ID
    meta_raw = json.loads(zf.read("metadata.json"))
    new_id = str(uuid.uuid4())
    meta_raw["id"] = new_id

    # Extract to new voice directory
    voice_dir = settings.voices_dir / new_id
    voice_dir.mkdir(parents=True, exist_ok=True)

    for name in zf.namelist():
        if name == "metadata.json":
            continue
        zf.extract(name, voice_dir)

    # Save updated metadata
    with open(voice_dir / "metadata.json", "w") as f:
        json.dump(meta_raw, f, indent=2)

    profile = VoiceProfile.load(voice_dir / "metadata.json")
    logger.info(f"Imported voice: {profile.name} (id={new_id})")
    return profile.to_dict()
