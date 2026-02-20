import shutil
from pathlib import Path
from typing import Optional

from engines.base import VoiceProfile
from utils.logging_config import get_logger

logger = get_logger("services.voice_library")


class VoiceLibrary:
    """Manages saved voice profiles."""

    def __init__(self, voices_dir: Path):
        self._voices_dir = voices_dir
        self._voices_dir.mkdir(parents=True, exist_ok=True)

    def list_voices(self) -> list[VoiceProfile]:
        voices = []
        if not self._voices_dir.exists():
            return voices

        for voice_dir in sorted(self._voices_dir.iterdir()):
            if voice_dir.is_dir():
                meta_path = voice_dir / "metadata.json"
                if meta_path.exists():
                    try:
                        profile = VoiceProfile.load(meta_path)
                        voices.append(profile)
                    except Exception as e:
                        logger.warning(f"Failed to load voice from {voice_dir.name}: {e}")
                        continue
        logger.debug(f"Loaded {len(voices)} voice profiles")
        return voices

    def get_voice(self, voice_id: str) -> Optional[VoiceProfile]:
        meta_path = self._voices_dir / voice_id / "metadata.json"
        if meta_path.exists():
            try:
                return VoiceProfile.load(meta_path)
            except Exception as e:
                logger.error(f"Failed to load voice {voice_id}: {e}")
        return None

    def delete_voice(self, voice_id: str) -> bool:
        voice_dir = self._voices_dir / voice_id
        if voice_dir.exists():
            shutil.rmtree(str(voice_dir))
            logger.info(f"Deleted voice: {voice_id}")
            return True
        return False

    def save_voice(self, profile: VoiceProfile) -> None:
        voice_dir = self._voices_dir / profile.id
        voice_dir.mkdir(parents=True, exist_ok=True)
        profile.save(voice_dir / "metadata.json")
        logger.info(f"Saved voice: {profile.name} (id={profile.id})")
