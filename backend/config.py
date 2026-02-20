from pathlib import Path

import torch

from utils.logging_config import get_logger

logger = get_logger("config")


class Settings:
    app_name: str = "AI Voice Studio"
    host: str = "127.0.0.1"
    port: int = 8765

    # Directories
    base_dir: Path = Path(__file__).parent
    data_dir: Path = base_dir / "data"
    models_dir: Path = data_dir / "models"
    voices_dir: Path = data_dir / "voices"
    outputs_dir: Path = data_dir / "outputs"
    previews_dir: Path = data_dir / "previews"
    logs_dir: Path = data_dir / "logs"

    # Device
    device: str = "cuda" if torch.cuda.is_available() else "cpu"

    def ensure_directories(self):
        for d in [
            self.data_dir,
            self.models_dir,
            self.voices_dir,
            self.outputs_dir,
            self.previews_dir,
            self.logs_dir,
        ]:
            d.mkdir(parents=True, exist_ok=True)


settings = Settings()
logger.info(f"Device: {settings.device}")
