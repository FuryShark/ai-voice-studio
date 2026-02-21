# AI Voice Studio

Local AI-powered voice creation tool. Design custom voice profiles from natural language descriptions or audio samples, then export them for use in other software. All processing runs on your GPU — no cloud APIs, no fees, complete privacy.

## What It Does

- **Create voices from text** — Describe a voice in plain English (e.g. "a warm female voice with a slight British accent") and Parler-TTS generates a matching voice profile
- **Create voices from audio** — Upload a short audio clip and save it as a reusable voice profile
- **Voice library** — Browse, preview, export, and import your voice collection
- **GPU monitoring** — Live VRAM usage, temperature, and utilization in the UI
- **Real-time progress** — WebSocket-based feedback during model downloads and voice generation

## Quick Start

### Windows

**Prerequisites:** [Python 3.10+](https://www.python.org/downloads/) (check "Add to PATH" during install) and [Node.js 18+](https://nodejs.org/)

Double-click **`start.bat`** — it handles everything automatically:
- Creates a Python virtual environment
- Installs PyTorch with CUDA support (auto-detects your GPU)
- Installs all Python and Node.js dependencies
- Installs espeak-ng (required for Kokoro TTS)
- Builds the frontend
- Starts the server and opens your browser to `http://localhost:8765`

First run takes several minutes (downloading models and dependencies). Subsequent launches are fast.

### Mac / Linux

**Prerequisites:** Python 3.10+, Node.js 18+, and espeak-ng

```bash
# Install espeak-ng first
# Ubuntu/Debian: sudo apt install espeak-ng
# macOS:         brew install espeak-ng

chmod +x start.sh
./start.sh
```

### Manual Setup

```bash
# 1. Create and activate virtual environment
python -m venv venv
source venv/bin/activate    # Linux/Mac
venv\Scripts\activate       # Windows

# 2. Install PyTorch (pick one)
# With CUDA (NVIDIA GPU):
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
# CPU only:
pip install torch torchaudio

# 3. Install Python dependencies
pip install -r backend/requirements.txt

# 4. Install TTS engines
pip install "kokoro>=0.8" soundfile    # Kokoro TTS engine
pip install parler-tts                  # Voice creation from text descriptions

# 5. Install espeak-ng (required for Kokoro)
# Windows: https://github.com/espeak-ng/espeak-ng/releases (download .msi)
# Ubuntu:  sudo apt install espeak-ng
# macOS:   brew install espeak-ng

# 6. Build frontend
cd frontend && npm install && npm run build && cd ..

# 7. Launch
python backend/main.py
# Opens browser at http://localhost:8765
```

## Project Structure

```
ai-voice-studio/
  backend/             # FastAPI server (Python, port 8765)
    api/               # REST + WebSocket endpoints
    engines/           # TTS engine implementations (Kokoro, etc.)
    services/          # Parler-TTS, voice library, audio processing
    config.py          # Settings, paths, device auto-detection
    main.py            # App entry point
    data/              # Runtime data — voices, previews, models (gitignored)
  frontend/            # React 19 + TypeScript + Vite 7 + Tailwind v4
    src/
      pages/           # Create, Library, Settings
      components/      # UI components organized by feature
      lib/             # API client, utilities, WebSocket provider
  start.bat            # Windows one-click launcher
  start.sh             # Mac/Linux launcher
  CLAUDE.md            # Full architecture reference for AI assistants
```

## Requirements

- **Python** 3.10+
- **Node.js** 18+ (for building the frontend)
- **NVIDIA GPU** with CUDA recommended (CPU works but is much slower)
- **espeak-ng** (required for Kokoro TTS engine)
- **~4 GB disk space** for dependencies and models on first run

## Alternative: Qwen3-TTS VoiceDesign

[Qwen3-TTS 1.7B VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) is an alternative model that accepts natural language voice descriptions, similar to Parler-TTS but with potentially better accuracy at following descriptions. It supports 10 languages and runs at ~5.5 GB VRAM (bf16).

**Trade-offs vs Parler-TTS:**
- Better at following voice descriptions (gender, accent, tone)
- 10 languages (EN, FR, ES, PT, DE, IT, RU, ZH, JA, KO)
- Slower generation (3-5x slower than Parler Mini, autoregressive architecture)
- Tighter VRAM fit on 8 GB cards — Flash Attention 2 recommended
- 24 kHz output vs Parler's 44.1 kHz
- Has a dependency conflict with `parler-tts` (both pin different `transformers` versions)

**Installation (experimental — may conflict with parler-tts):**

```bash
# Activate your venv first
pip install qwen-tts

# This will upgrade transformers from 4.46.1 to 4.57.3
# Parler-TTS will likely still work but is not officially supported at this version

# Optional but recommended for VRAM savings (requires Visual Studio Build Tools + CUDA toolkit on Windows):
pip install flash-attn --no-build-isolation
```

**Additional Windows requirements:**
- [SoX](https://sourceforge.net/projects/sox/) must be installed and on PATH (required by `qwen-tts`)
- Flash Attention 2 compilation needs [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with C++ workload

**Basic usage (Python):**

```python
import torch
import soundfile as sf
from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    device_map="cuda:0",
    dtype=torch.bfloat16,
)

wavs, sr = model.generate_voice_design(
    text="Hello, this is a preview of my custom voice.",
    language="English",
    instruct="A warm, friendly adult male voice with a calm tone and moderate pace.",
)
sf.write("output.wav", wavs[0], sr)  # 24 kHz mono WAV
```

Qwen3-TTS is not currently integrated into the app UI. This section is here as a reference if you want to experiment with it manually or contribute an integration.

## Troubleshooting

### "Python is not installed" or "not recognized"
Make sure Python is added to your PATH. On Windows, re-run the Python installer and check "Add Python to PATH".

### PyTorch / CUDA issues
If you have an NVIDIA GPU but PyTorch isn't using it, reinstall with CUDA support:
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### espeak-ng not found
Kokoro TTS requires espeak-ng. Install it for your platform:
- **Windows**: Download the `.msi` from [espeak-ng releases](https://github.com/espeak-ng/espeak-ng/releases/tag/1.52.0)
- **Ubuntu/Debian**: `sudo apt install espeak-ng`
- **macOS**: `brew install espeak-ng`

### Frontend build fails
Make sure Node.js 18+ is installed. Then:
```bash
cd frontend
rm -rf node_modules
npm install
npm run build
```

### Parler-TTS "Describe a Voice" not working
Check that parler-tts is installed: `pip install parler-tts`. The first time you generate a voice, it downloads the model (~2 GB). Check the terminal for download progress.

### Port 8765 already in use
Another instance may be running. Kill it or change the port by setting the `PORT` environment variable before launching.

### Fresh start
Delete the `venv` folder and run `start.bat` / `start.sh` again to reinstall everything from scratch.

## License

MIT
