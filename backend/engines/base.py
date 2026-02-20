from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional, Callable
import json


@dataclass
class VoiceProfile:
    id: str
    name: str
    engine: str
    reference_audio_path: Optional[str] = None
    reference_text: Optional[str] = None
    settings: dict = field(default_factory=dict)
    created_at: str = ""
    source: str = "audio"  # "audio" | "prompt"
    description: Optional[str] = None  # Text description for prompt-created voices

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "VoiceProfile":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    def save(self, path: Path):
        path.write_text(json.dumps(self.to_dict(), indent=2))

    @classmethod
    def load(cls, path: Path) -> "VoiceProfile":
        return cls.from_dict(json.loads(path.read_text()))


@dataclass
class GenerationRequest:
    text: str
    voice: Optional[VoiceProfile] = None
    emotion: Optional[str] = None
    speed: float = 1.0
    temperature: float = 0.7
    seed: Optional[int] = None
    output_format: str = "wav"


@dataclass
class GenerationResult:
    audio_path: Path
    sample_rate: int
    duration_seconds: float
    engine_used: str


ProgressCallback = Callable[[float, str], None]


class TTSEngine(ABC):
    """Abstract base class for all TTS engines."""

    @abstractmethod
    def get_name(self) -> str:
        ...

    @abstractmethod
    def get_description(self) -> str:
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Check if model weights are downloaded."""
        ...

    @abstractmethod
    def get_required_vram_gb(self) -> float:
        ...

    @abstractmethod
    def supports_voice_cloning(self) -> bool:
        ...

    @abstractmethod
    def supports_emotion_control(self) -> bool:
        ...

    @abstractmethod
    def get_available_voices(self) -> list[str]:
        ...

    @abstractmethod
    async def load_model(self) -> None:
        ...

    @abstractmethod
    async def unload_model(self) -> None:
        ...

    @abstractmethod
    async def generate(
        self,
        request: GenerationRequest,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> GenerationResult:
        ...

    async def clone_voice(
        self,
        audio_path: Path,
        voice_name: str,
        reference_text: Optional[str] = None,
    ) -> VoiceProfile:
        raise NotImplementedError(f"{self.get_name()} does not support voice cloning")
