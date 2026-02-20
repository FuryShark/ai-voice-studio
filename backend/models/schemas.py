from typing import Literal, Optional

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=100000)
    engine: str = Field(default="kokoro", min_length=1, max_length=50)
    voice_id: Optional[str] = Field(default=None, max_length=200)
    voice_name: Optional[str] = Field(default=None, max_length=100)
    speed: float = Field(default=1.0, ge=0.25, le=4.0)
    emotion: Optional[str] = Field(default=None, max_length=100)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    seed: Optional[int] = Field(default=None, ge=0, le=2147483647)
    format: Literal["wav", "mp3", "flac", "ogg"] = "wav"


class GenerateResponse(BaseModel):
    audio_url: str
    duration: float
    engine: str
    text: str


class EngineInfo(BaseModel):
    name: str
    description: str
    available: bool
    supports_cloning: bool
    supports_emotion: bool
    required_vram_gb: float
    builtin_voices: list[str]
    loaded: bool


class VoiceInfo(BaseModel):
    id: str
    name: str
    engine: str
    created_at: str


class HealthResponse(BaseModel):
    status: str
    gpu_available: bool
    gpu_name: Optional[str] = None
