import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

from utils.logging_config import get_logger

logger = get_logger("services.audio")


class AudioProcessor:
    """Audio post-processing: format conversion, normalization, silence trimming."""

    @staticmethod
    def convert_format(input_path: Path, output_format: str) -> Path:
        output_path = input_path.with_suffix(f".{output_format}")
        input_size = input_path.stat().st_size
        logger.info(f"Converting {input_path.name} ({input_size} bytes) -> {output_format}")

        if output_format in ("wav", "flac", "ogg"):
            data, sr = sf.read(str(input_path))
            sf.write(str(output_path), data, sr, format=output_format.upper())
        elif output_format == "mp3":
            try:
                result = subprocess.run(
                    [
                        "ffmpeg", "-y", "-i", str(input_path),
                        "-codec:a", "libmp3lame", "-qscale:a", "2",
                        str(output_path),
                    ],
                    check=True,
                    capture_output=True,
                )
                logger.debug(f"ffmpeg completed: {result.returncode}")
            except FileNotFoundError:
                raise RuntimeError(
                    "ffmpeg not found. Install ffmpeg and add it to your PATH for MP3 export."
                )
            except subprocess.CalledProcessError as e:
                logger.error(f"ffmpeg failed: {e.stderr.decode()}")
                raise RuntimeError(f"MP3 conversion failed: {e.stderr.decode()}")
        else:
            raise ValueError(f"Unsupported format: {output_format}")

        output_size = output_path.stat().st_size
        logger.info(f"Conversion complete: {output_path.name} ({output_size} bytes)")
        return output_path

    @staticmethod
    def normalize_audio(input_path: Path, target_db: float = -20.0) -> Path:
        data, sr = sf.read(str(input_path))

        rms = np.sqrt(np.mean(data ** 2))
        if rms > 0:
            current_db = 20 * np.log10(rms)
            gain_db = target_db - current_db
            gain = 10 ** (gain_db / 20)
            data = data * gain
            data = np.clip(data, -1.0, 1.0)
            logger.info(f"Normalized {input_path.name}: {current_db:.1f}dB -> {target_db:.1f}dB (gain={gain_db:.1f}dB)")
        else:
            logger.warning(f"Audio is silent, skipping normalization: {input_path.name}")

        output_path = input_path.with_stem(input_path.stem + "_normalized")
        sf.write(str(output_path), data, sr)
        return output_path

    @staticmethod
    def trim_silence(
        input_path: Path,
        threshold_db: float = -40.0,
        min_silence_ms: int = 100,
    ) -> Path:
        data, sr = sf.read(str(input_path))
        original_duration = len(data) / sr

        if data.ndim > 1:
            mono = np.mean(data, axis=1)
        else:
            mono = data

        threshold = 10 ** (threshold_db / 20)
        min_samples = int(sr * min_silence_ms / 1000)

        above_threshold = np.abs(mono) > threshold

        if not np.any(above_threshold):
            logger.warning(f"Audio is all silence: {input_path.name}")
            return input_path

        start = max(0, np.argmax(above_threshold) - min_samples)
        end = min(len(mono), len(mono) - np.argmax(above_threshold[::-1]) + min_samples)

        trimmed = data[start:end]
        trimmed_duration = len(trimmed) / sr
        output_path = input_path.with_stem(input_path.stem + "_trimmed")
        sf.write(str(output_path), trimmed, sr)
        logger.info(f"Trimmed {input_path.name}: {original_duration:.1f}s -> {trimmed_duration:.1f}s")
        return output_path
