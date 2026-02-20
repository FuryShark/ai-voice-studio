import asyncio
import json
import shutil
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf

from .base import TTSEngine, GenerationRequest, GenerationResult, VoiceProfile, ProgressCallback
from utils.logging_config import get_logger

logger = get_logger("engines.f5tts")


class F5TTSEngine(TTSEngine):
    SAMPLE_RATE = 24000

    def __init__(self, models_dir: Path, voices_dir: Path, outputs_dir: Path):
        self._models_dir = models_dir
        self._voices_dir = voices_dir
        self._outputs_dir = outputs_dir
        self._model = None
        self._loaded = False

    def get_name(self) -> str:
        return "f5-tts"

    def get_description(self) -> str:
        return "F5-TTS: Excellent zero-shot voice cloning with multilingual support."

    def is_available(self) -> bool:
        try:
            from f5_tts.api import F5TTS  # noqa: F401
            return True
        except ImportError:
            return False

    def get_required_vram_gb(self) -> float:
        return 12.0

    def supports_voice_cloning(self) -> bool:
        return True

    def supports_emotion_control(self) -> bool:
        return False

    def get_available_voices(self) -> list[str]:
        voices = []
        if self._voices_dir.exists():
            for voice_dir in self._voices_dir.iterdir():
                if voice_dir.is_dir():
                    meta_path = voice_dir / "metadata.json"
                    if meta_path.exists():
                        meta = json.loads(meta_path.read_text())
                        if meta.get("engine") == "f5-tts":
                            voices.append(meta["name"])
        return voices

    async def load_model(self) -> None:
        logger.info("Loading F5-TTS model...")
        start = time.time()
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._load_model_sync)
        self._loaded = True
        logger.info(f"F5-TTS model loaded in {time.time() - start:.1f}s")

    def _load_model_sync(self):
        from f5_tts.api import F5TTS
        self._model = F5TTS()

    async def unload_model(self) -> None:
        self._model = None
        self._loaded = False
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info("F5-TTS model unloaded")

    async def generate(
        self,
        request: GenerationRequest,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> GenerationResult:
        if not self._loaded or not self._model:
            raise RuntimeError("F5-TTS model not loaded")

        logger.info(f"Generating: text_len={len(request.text)}, seed={request.seed}")
        start = time.time()

        if progress_callback:
            progress_callback(0.1, "Starting F5-TTS generation...")

        loop = asyncio.get_running_loop()
        output_path = await loop.run_in_executor(
            None,
            lambda: self._generate_sync(request),
        )

        if progress_callback:
            progress_callback(1.0, "Complete")

        info = sf.info(str(output_path))
        elapsed = time.time() - start
        logger.info(f"Generated {info.duration:.1f}s audio in {elapsed:.1f}s -> {output_path.name}")

        return GenerationResult(
            audio_path=output_path,
            sample_rate=int(info.samplerate),
            duration_seconds=info.duration,
            engine_used="f5-tts",
        )

    def _generate_sync(self, request: GenerationRequest) -> Path:
        file_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().strftime("%Y%m%d")
        output_dir = self._outputs_dir / timestamp
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{file_id}.wav"

        ref_file = None
        ref_text = ""
        if request.voice and request.voice.reference_audio_path:
            ref_file = request.voice.reference_audio_path
            ref_text = request.voice.reference_text or ""

        wav, sr, _ = self._model.infer(
            ref_file=ref_file,
            ref_text=ref_text,
            gen_text=request.text,
            file_wave=str(output_path),
            seed=request.seed if request.seed else -1,
        )

        return output_path

    async def clone_voice(
        self,
        audio_path: Path,
        voice_name: str,
        reference_text: Optional[str] = None,
    ) -> VoiceProfile:
        voice_id = str(uuid.uuid4())
        voice_dir = self._voices_dir / voice_id
        voice_dir.mkdir(parents=True, exist_ok=True)

        dest = voice_dir / "reference.wav"
        shutil.copy2(str(audio_path), str(dest))

        profile = VoiceProfile(
            id=voice_id,
            name=voice_name,
            engine="f5-tts",
            reference_audio_path=str(dest),
            reference_text=reference_text,
            settings={},
            created_at=datetime.now().isoformat(),
        )

        profile.save(voice_dir / "metadata.json")
        logger.info(f"Cloned voice: {voice_name} (id={voice_id})")
        return profile
