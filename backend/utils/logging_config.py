import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logging(log_dir: Path | None = None, level: int = logging.DEBUG) -> None:
    """Configure logging for the entire application.

    - Console handler (INFO+) for user-facing output
    - File handler (DEBUG) for detailed debugging with rotation
    """
    root = logging.getLogger("voice_studio")
    root.setLevel(level)
    root.handlers.clear()

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)-7s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler -- INFO level
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(fmt)
    root.addHandler(console)

    # File handler -- DEBUG level with rotation (10MB, keep 3 backups)
    if log_dir:
        log_dir.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            log_dir / "voice_studio.log",
            maxBytes=10 * 1024 * 1024,
            backupCount=3,
            encoding="utf-8",
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(fmt)
        root.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    """Get a child logger under the voice_studio namespace."""
    return logging.getLogger(f"voice_studio.{name}")
