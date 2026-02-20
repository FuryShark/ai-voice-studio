"""Parler-TTS voice generation service.

Generates voice sample audio from natural language descriptions.
Operates independently of EngineManager -- loads/unloads its own model.
"""

import asyncio
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from utils.logging_config import get_logger

logger = get_logger("services.parler")


class GenerationCancelled(Exception):
    """Raised when generation is cancelled due to client disconnect."""


# Available voice generation models with quality/speed ratings (1-5 stars)
VOICE_MODELS = {
    "parler-mini-v1.1": {
        "id": "parler-mini-v1.1",
        "hf_name": "parler-tts/parler-tts-mini-v1.1",
        "name": "Parler Mini v1.1",
        "quality": 4,
        "speed": 4,
        "vram_gb": 1.1,
        "download_gb": 2.2,
        "description": "Best balance of quality and speed. Good for most voices.",
        "sample_rate": 44100,
        "default": True,
    },
    "parler-large-v1": {
        "id": "parler-large-v1",
        "hf_name": "parler-tts/parler-tts-large-v1",
        "name": "Parler Large v1",
        "quality": 5,
        "speed": 2,
        "vram_gb": 2.3,
        "download_gb": 4.5,
        "description": "Highest quality but slow (~5-7 min). Rich detail, natural prosody, accurate accents.",
        "sample_rate": 44100,
        "default": False,
    },
    "parler-mini-v1": {
        "id": "parler-mini-v1",
        "hf_name": "parler-tts/parler-tts-mini-v1",
        "name": "Parler Mini v1",
        "quality": 3,
        "speed": 4,
        "vram_gb": 1.1,
        "download_gb": 2.2,
        "description": "Fast generation, smaller download. Some mispronunciations. Good for quick tests.",
        "sample_rate": 44100,
        "default": False,
    },
}


class ParlerVoiceService:
    """Generates voice samples from text descriptions using Parler-TTS."""

    def __init__(self, previews_dir: Path, device: str = "cuda"):
        self._previews_dir = previews_dir
        self._device = device
        self._model = None
        self._tokenizer = None
        self._loaded = False
        self._loaded_model_id: Optional[str] = None

    def is_available(self) -> bool:
        """Check if parler-tts package is installed."""
        try:
            import parler_tts  # noqa: F401
            return True
        except ImportError:
            return False

    def get_models(self) -> list[dict]:
        """Return available model configurations."""
        return list(VOICE_MODELS.values())

    async def _broadcast(self, msg: dict) -> None:
        """Send progress update via WebSocket."""
        try:
            from api.ws import ws_manager
            await ws_manager.broadcast(msg)
        except Exception:
            pass

    async def load(self, model_id: str = "parler-mini-v1.1") -> None:
        """Load a Parler-TTS model into memory."""
        # If already loaded with same model, skip
        if self._loaded and self._loaded_model_id == model_id:
            return

        # If different model is loaded, unload first
        if self._loaded:
            logger.info(f"Switching model: {self._loaded_model_id} -> {model_id}")
            await self.unload()

        model_config = VOICE_MODELS.get(model_id)
        if not model_config:
            raise ValueError(f"Unknown model: {model_id}")

        hf_name = model_config["hf_name"]
        logger.info(f"Loading Parler-TTS model: {hf_name}")

        await self._broadcast({
            "type": "progress",
            "stage": "loading_model",
            "message": f"Loading {model_config['name']} (downloading on first run ~{model_config['download_gb']}GB)...",
            "percent": 10,
        })

        import torch
        from parler_tts import ParlerTTSForConditionalGeneration
        from transformers import AutoTokenizer

        # Unload any active TTS engine to free VRAM
        from engines.engine_manager import engine_manager
        if engine_manager.get_active_engine():
            logger.info(f"Unloading active engine '{engine_manager.get_active_name()}' to free VRAM")
            await engine_manager.deactivate()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        await self._broadcast({
            "type": "progress",
            "stage": "loading_model",
            "message": "Downloading model weights (this only happens once)...",
            "percent": 30,
        })

        loop = asyncio.get_event_loop()
        self._model = await loop.run_in_executor(
            None,
            lambda: ParlerTTSForConditionalGeneration.from_pretrained(
                hf_name,
            ).to(self._device),
        )

        await self._broadcast({
            "type": "progress",
            "stage": "loading_model",
            "message": "Loading tokenizer...",
            "percent": 80,
        })

        self._tokenizer = await loop.run_in_executor(
            None,
            lambda: AutoTokenizer.from_pretrained(hf_name),
        )

        self._loaded = True
        self._loaded_model_id = model_id
        logger.info(f"Parler-TTS model loaded: {model_config['name']}")

        await self._broadcast({
            "type": "progress",
            "stage": "model_ready",
            "message": "Model loaded successfully",
            "percent": 100,
        })

    async def unload(self) -> None:
        """Unload model and free VRAM."""
        if not self._loaded:
            return

        import torch

        del self._model
        del self._tokenizer
        self._model = None
        self._tokenizer = None
        self._loaded = False
        self._loaded_model_id = None

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        logger.info("Parler-TTS model unloaded")

    async def generate_preview(
        self,
        description: str,
        sample_text: str = "Hello, this is a preview of my custom voice. I hope you like how it sounds.",
        model_id: str = "parler-mini-v1.1",
        temperature: float = 1.0,
        request=None,
    ) -> tuple[Path, float]:
        """Generate a short audio sample from a voice description.

        Args:
            description: Natural language description of the voice
            sample_text: Text for the voice to speak in the preview
            model_id: Which model to use for generation
            temperature: Sampling temperature (lower = more consistent, higher = more varied)
            request: FastAPI Request object for disconnect detection

        Returns:
            (audio_path, duration_seconds)
        """
        import torch
        import soundfile as sf

        model_config = VOICE_MODELS.get(model_id, VOICE_MODELS["parler-mini-v1.1"])
        sample_rate = model_config["sample_rate"]

        await self.load(model_id)

        await self._broadcast({
            "type": "progress",
            "stage": "generating",
            "message": f"Generating voice preview with {model_config['name']}...",
            "percent": 50,
        })

        logger.info(
            f"Generating preview [{model_id}]: "
            f"description='{description[:80]}...', text='{sample_text[:50]}...', "
            f"temperature={temperature}"
        )

        loop = asyncio.get_event_loop()

        # Cancel flag checked by StoppingCriteria inside model.generate()
        cancel_event = threading.Event()

        def _generate():
            from transformers import StoppingCriteria, StoppingCriteriaList

            class CancelCheck(StoppingCriteria):
                """Abort generation when the cancel event is set."""
                def __call__(self, input_ids, scores, **kwargs):
                    return cancel_event.is_set()

            input_ids = self._tokenizer(
                description, return_tensors="pt"
            ).input_ids.to(self._device)

            prompt_input_ids = self._tokenizer(
                sample_text, return_tensors="pt"
            ).input_ids.to(self._device)

            # Cap generation length to prevent runaway buzzing.
            # DAC codec: ~86 tokens per second of audio at 44100 Hz.
            word_count = len(sample_text.split())
            est_seconds = max(word_count * 0.5, 3.0)  # ~0.5s per word, min 3s
            max_seconds = min(est_seconds * 2, 30.0)   # 2x buffer, cap 30s
            max_tokens = int(max_seconds * 86)

            gen_kwargs = {
                "input_ids": input_ids,
                "prompt_input_ids": prompt_input_ids,
                "max_new_tokens": max_tokens,
                "stopping_criteria": StoppingCriteriaList([CancelCheck()]),
            }

            # Temperature controls randomness in voice characteristics
            if temperature != 1.0:
                gen_kwargs["temperature"] = temperature
                gen_kwargs["do_sample"] = True

            with torch.no_grad():
                generation = self._model.generate(**gen_kwargs)

            if cancel_event.is_set():
                return None

            return generation.cpu().float().numpy().squeeze()

        # Run generation with periodic heartbeat + disconnect detection
        gen_future = loop.run_in_executor(None, _generate)
        start_time = time.monotonic()
        cancelled = False

        while True:
            try:
                audio = await asyncio.wait_for(asyncio.shield(gen_future), timeout=5.0)
                break
            except asyncio.TimeoutError:
                elapsed = int(time.monotonic() - start_time)

                # Check if client disconnected
                if request is not None:
                    try:
                        if await request.is_disconnected():
                            logger.info(f"Client disconnected after {elapsed}s, cancelling generation")
                            cancel_event.set()
                            cancelled = True
                            # Wait for the thread to finish (should be quick after cancel)
                            audio = await gen_future
                            break
                    except Exception:
                        pass

                await self._broadcast({
                    "type": "progress",
                    "stage": "generating",
                    "message": f"Generating with {model_config['name']}... ({elapsed}s elapsed)",
                    "percent": 50,
                })

        if cancelled or audio is None:
            await self.unload()
            raise GenerationCancelled()

        duration = len(audio) / sample_rate

        # Save to previews directory with date subfolder
        date_str = datetime.now().strftime("%Y%m%d")
        output_dir = self._previews_dir / date_str
        output_dir.mkdir(parents=True, exist_ok=True)

        filename = f"preview_{uuid.uuid4().hex[:12]}.wav"
        output_path = output_dir / filename

        sf.write(str(output_path), audio, sample_rate)
        logger.info(f"Preview generated: {output_path.name} ({duration:.1f}s)")

        await self._broadcast({
            "type": "progress",
            "stage": "complete",
            "message": f"Preview generated ({duration:.1f}s)",
            "percent": 100,
        })

        # Auto-unload to free VRAM for other uses
        await self.unload()

        return output_path, duration
