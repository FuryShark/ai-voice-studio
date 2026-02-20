from typing import Optional

from .base import TTSEngine
from utils.logging_config import get_logger

logger = get_logger("engines.manager")


class EngineManager:
    """Registry of TTS engines. Handles loading, unloading, and switching."""

    def __init__(self):
        self._engines: dict[str, TTSEngine] = {}
        self._active_engine: Optional[TTSEngine] = None
        self._active_name: Optional[str] = None

    def register(self, engine: TTSEngine) -> None:
        name = engine.get_name()
        self._engines[name] = engine
        logger.debug(f"Registered engine: {name}")

    def get_engine(self, name: str) -> TTSEngine:
        if name not in self._engines:
            raise ValueError(f"Unknown engine: {name}")
        return self._engines[name]

    def get_available_engines(self) -> list[dict]:
        result = []
        for name, engine in self._engines.items():
            result.append({
                "name": name,
                "description": engine.get_description(),
                "available": engine.is_available(),
                "supports_cloning": engine.supports_voice_cloning(),
                "supports_emotion": engine.supports_emotion_control(),
                "required_vram_gb": engine.get_required_vram_gb(),
                "builtin_voices": engine.get_available_voices(),
                "loaded": name == self._active_name,
            })
        return result

    async def activate_engine(self, name: str) -> TTSEngine:
        if name == self._active_name and self._active_engine:
            logger.debug(f"Engine '{name}' already active")
            return self._active_engine

        # Unload current engine first
        if self._active_engine:
            logger.info(f"Unloading engine: {self._active_name}")
            await self._active_engine.unload_model()
            self._active_engine = None
            self._active_name = None

        engine = self.get_engine(name)
        logger.info(f"Loading engine: {name}")
        await engine.load_model()
        self._active_engine = engine
        self._active_name = name
        logger.info(f"Engine '{name}' activated")
        return engine

    def get_active_engine(self) -> Optional[TTSEngine]:
        return self._active_engine

    def get_active_name(self) -> Optional[str]:
        return self._active_name


engine_manager = EngineManager()
