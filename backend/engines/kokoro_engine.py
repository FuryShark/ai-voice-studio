import asyncio
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf

from .base import TTSEngine, GenerationRequest, GenerationResult, VoiceProfile, ProgressCallback
from utils.logging_config import get_logger

logger = get_logger("engines.kokoro")


class KokoroEngine(TTSEngine):
    SAMPLE_RATE = 24000
    BUILTIN_VOICES = [
        "af_heart", "af_bella", "af_nicole", "af_sarah", "af_sky",
        "am_adam", "am_michael",
        "bf_emma", "bf_isabella",
        "bm_george", "bm_lewis",
    ]

    def __init__(self, outputs_dir: Path):
        self._pipeline = None
        self._outputs_dir = outputs_dir

    def get_name(self) -> str:
        return "kokoro"

    def get_description(self) -> str:
        return "Kokoro-82M: Fast, lightweight TTS with natural voices. Best for quick previews."

    def is_available(self) -> bool:
        try:
            import kokoro  # noqa: F401
            return True
        except ImportError:
            return False

    def get_required_vram_gb(self) -> float:
        return 2.0

    def supports_voice_cloning(self) -> bool:
        return False

    def supports_emotion_control(self) -> bool:
        return False

    def get_available_voices(self) -> list[str]:
        return self.BUILTIN_VOICES

    async def load_model(self) -> None:
        from kokoro import KPipeline
        logger.info("Loading Kokoro model...")
        start = time.time()
        loop = asyncio.get_running_loop()
        self._pipeline = await loop.run_in_executor(
            None, lambda: KPipeline(lang_code="a")
        )
        logger.info(f"Kokoro model loaded in {time.time() - start:.1f}s")

    async def unload_model(self) -> None:
        self._pipeline = None
        logger.info("Kokoro model unloaded")

    async def generate(
        self,
        request: GenerationRequest,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> GenerationResult:
        if not self._pipeline:
            raise RuntimeError("Kokoro model not loaded. Call load_model() first.")

        voice_name = "af_heart"
        if request.voice and request.voice.settings.get("kokoro_voice"):
            voice_name = request.voice.settings["kokoro_voice"]

        logger.info(f"Generating: voice={voice_name}, speed={request.speed}, text_len={len(request.text)}")
        start = time.time()

        if progress_callback:
            progress_callback(0.1, "Starting generation...")

        loop = asyncio.get_running_loop()
        segments = await loop.run_in_executor(
            None,
            lambda: self._generate_sync(request.text, voice_name, request.speed),
        )

        if not segments:
            raise RuntimeError("No audio generated")

        if progress_callback:
            progress_callback(0.8, "Saving audio...")

        full_audio = np.concatenate(segments)

        file_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().strftime("%Y%m%d")
        output_dir = self._outputs_dir / timestamp
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{file_id}.wav"

        sf.write(str(output_path), full_audio, self.SAMPLE_RATE)

        duration = len(full_audio) / self.SAMPLE_RATE
        elapsed = time.time() - start
        logger.info(f"Generated {duration:.1f}s audio in {elapsed:.1f}s -> {output_path.name}")

        if progress_callback:
            progress_callback(1.0, "Complete")

        return GenerationResult(
            audio_path=output_path,
            sample_rate=self.SAMPLE_RATE,
            duration_seconds=duration,
            engine_used="kokoro",
        )

    def _generate_sync(self, text: str, voice: str, speed: float) -> list:
        segments = []
        generator = self._pipeline(text, voice=voice, speed=speed)
        for _gs, _ps, audio in generator:
            segments.append(audio)
        return segments
