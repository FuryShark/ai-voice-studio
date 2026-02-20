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

logger = get_logger("engines.fish_speech")


EMOTION_PRESETS = {
    "happy": "(happy)",
    "sad": "(sad)",
    "angry": "(angry)",
    "excited": "(excited)",
    "calm": "(relaxed)",
    "whisper": "(whispering)",
    "shout": "(shouting)",
    "nervous": "(nervous)",
    "confident": "(confident)",
    "sarcastic": "(sarcastic)",
    "tender": "(soft tone)",
    "urgent": "(in a hurry tone)",
    "laughing": "(laughing)",
    "crying": "(crying loudly)",
    "fearful": "(scared)",
    "disgusted": "(disgusted)",
    "surprised": "(surprised)",
    "amused": "(amused)",
}

ALL_EMOTION_MARKERS = [
    "angry", "sad", "excited", "surprised", "satisfied", "delighted",
    "scared", "worried", "upset", "nervous", "frustrated", "depressed",
    "empathetic", "embarrassed", "disgusted", "moved", "proud",
    "relaxed", "grateful", "confident", "interested", "curious",
    "confused", "joyful", "disdainful", "unhappy", "anxious",
    "hysterical", "indifferent", "impatient", "guilty", "scornful",
    "panicked", "furious", "reluctant", "keen", "disapproving",
    "serious", "sarcastic", "conciliative", "comforting", "sincere",
    "sneering", "hesitating", "yielding", "painful", "awkward", "amused",
    "in a hurry tone", "shouting", "screaming", "whispering", "soft tone",
    "laughing", "chuckling", "sobbing", "crying loudly", "sighing",
    "panting", "groaning",
]


class FishSpeechEngine(TTSEngine):
    SAMPLE_RATE = 44100

    def __init__(self, models_dir: Path, voices_dir: Path, outputs_dir: Path):
        self._models_dir = models_dir
        self._voices_dir = voices_dir
        self._outputs_dir = outputs_dir
        self._model = None
        self._loaded = False

    def get_name(self) -> str:
        return "fish-speech"

    def get_description(self) -> str:
        return "Fish Speech S1: Highest quality with voice cloning and 50+ emotion controls."

    def is_available(self) -> bool:
        try:
            from fish_speech.utils.schema import ServeTTSRequest  # noqa: F401
            return True
        except ImportError:
            return False

    def get_required_vram_gb(self) -> float:
        return 4.0

    def supports_voice_cloning(self) -> bool:
        return True

    def supports_emotion_control(self) -> bool:
        return True

    def get_available_voices(self) -> list[str]:
        voices = []
        if self._voices_dir.exists():
            for voice_dir in self._voices_dir.iterdir():
                if voice_dir.is_dir():
                    meta_path = voice_dir / "metadata.json"
                    if meta_path.exists():
                        meta = json.loads(meta_path.read_text())
                        if meta.get("engine") == "fish-speech":
                            voices.append(meta["name"])
        return voices

    async def load_model(self) -> None:
        logger.info("Loading Fish Speech model...")
        start = time.time()
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._load_model_sync)
        self._loaded = True
        logger.info(f"Fish Speech model loaded in {time.time() - start:.1f}s (mode={'api' if self._model != 'cli_mode' else 'cli'})")

    def _load_model_sync(self):
        try:
            from fish_speech.inference import TTSInference
            from config import settings
            self._model = TTSInference(device=settings.device)
            logger.debug(f"Fish Speech API mode, device={settings.device}")
        except ImportError:
            self._model = "cli_mode"
            logger.debug("Fish Speech CLI fallback mode")

    async def unload_model(self) -> None:
        self._model = None
        self._loaded = False
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info("Fish Speech model unloaded")

    async def generate(
        self,
        request: GenerationRequest,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> GenerationResult:
        if not self._loaded:
            raise RuntimeError("Fish Speech model not loaded")

        if progress_callback:
            progress_callback(0.1, "Preparing text...")

        text = request.text
        if request.emotion:
            marker = EMOTION_PRESETS.get(request.emotion, f"({request.emotion})")
            text = f"{marker}{text}"
            logger.debug(f"Injected emotion marker: {marker}")

        logger.info(f"Generating: text_len={len(text)}, temp={request.temperature}")
        start = time.time()

        if progress_callback:
            progress_callback(0.3, "Generating speech...")

        loop = asyncio.get_running_loop()
        output_path = await loop.run_in_executor(
            None,
            lambda: self._generate_sync(text, request),
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
            engine_used="fish-speech",
        )

    def _generate_sync(self, text: str, request: GenerationRequest) -> Path:
        file_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().strftime("%Y%m%d")
        output_dir = self._outputs_dir / timestamp
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{file_id}.wav"

        ref_audio = None
        ref_text = None
        if request.voice and request.voice.reference_audio_path:
            ref_audio = request.voice.reference_audio_path
            ref_text = request.voice.reference_text or ""

        try:
            if self._model and self._model != "cli_mode":
                audio = self._model.generate(
                    text=text,
                    reference_audio=ref_audio,
                    reference_text=ref_text,
                    temperature=request.temperature,
                )
                sf.write(str(output_path), audio, self.SAMPLE_RATE)
            else:
                import subprocess
                import sys

                cmd = [
                    sys.executable, "-m", "fish_speech.infer",
                    "--text", text,
                    "--output", str(output_path),
                ]
                if ref_audio:
                    cmd.extend(["--reference-audio", str(ref_audio)])
                if ref_text:
                    cmd.extend(["--reference-text", ref_text])

                logger.debug(f"Running Fish Speech CLI: {' '.join(cmd[:6])}...")
                subprocess.run(cmd, check=True, capture_output=True)
        except Exception as e:
            logger.error(f"Fish Speech generation failed: {e}")
            raise RuntimeError(f"Fish Speech generation failed: {e}")

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
            engine="fish-speech",
            reference_audio_path=str(dest),
            reference_text=reference_text,
            settings={},
            created_at=datetime.now().isoformat(),
        )

        profile.save(voice_dir / "metadata.json")
        logger.info(f"Cloned voice: {voice_name} (id={voice_id})")
        return profile

    @staticmethod
    def get_emotion_presets() -> dict[str, str]:
        return EMOTION_PRESETS

    @staticmethod
    def get_all_emotion_markers() -> list[str]:
        return ALL_EMOTION_MARKERS
