# AI Voice Studio

Local AI-powered text-to-speech with voice cloning and emotion control. All processing runs on your GPU — no cloud APIs, no subscription fees, complete privacy.

## Features

- **Multiple TTS Engines** — Kokoro-82M (fast, lightweight), Fish Speech (emotion control + cloning), F5-TTS (voice cloning)
- **Voice Cloning** — Clone any voice from a short audio sample
- **Emotion Control** — Add emotions like happy, sad, angry to speech (Fish Speech)
- **Audiobook Mode** — Paste long text, split into chapters, generate sequentially
- **Generation History** — All generations saved locally with search, playback, and download
- **Advanced Controls** — Temperature, speed, seed, output format (WAV/MP3/FLAC/OGG)
- **Real-time Progress** — WebSocket-based progress updates during generation
- **GPU Monitoring** — Live VRAM usage, temperature, and utilization display

## Quick Start (Windows)

**Prerequisites:** [Python 3.10+](https://www.python.org/downloads/) and [Node.js 18+](https://nodejs.org/)

Double-click **`start.bat`** — it handles everything automatically on first run.

## Quick Start (Mac/Linux)

```bash
chmod +x start.sh
./start.sh
```

## Manual Setup

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# 2. Install Python dependencies
pip install -r backend/requirements.txt
pip install kokoro>=0.8 soundfile  # Default TTS engine

# 3. Install espeak-ng (required for Kokoro)
# Windows: Download .msi from https://github.com/espeak-ng/espeak-ng/releases
# Ubuntu:  sudo apt install espeak-ng
# macOS:   brew install espeak-ng

# 4. Build frontend
cd frontend
npm install
npm run build
cd ..

# 5. Launch
python backend/main.py
# Opens browser at http://localhost:8765
```

## TTS Engines

| Engine | VRAM | Voice Cloning | Emotion Control | Install |
|--------|------|---------------|-----------------|---------|
| **Kokoro-82M** | ~2 GB | No | No | `pip install kokoro>=0.8 soundfile` |
| **Fish Speech** | ~4 GB | Yes | Yes | `pip install fish-speech` |
| **F5-TTS** | ~4 GB | Yes | No | `pip install f5-tts` |

Only Kokoro is installed by default. Add more engines anytime from the Settings page.

## Project Structure

```
ai-voice-studio/
  backend/           # FastAPI server (Python)
    api/             # REST + WebSocket endpoints
    engines/         # TTS engine implementations
    services/        # Voice library, audio processing
    models/          # Pydantic schemas
    utils/           # Logging config
    data/            # Runtime data (outputs, voices, logs)
  frontend/          # React + TypeScript + Vite
    src/
      components/    # UI components
      pages/         # Studio, Voices, Audiobook, History, Settings
      hooks/         # Custom React hooks
      lib/           # API client, utilities
  scripts/           # Launcher scripts
  start.bat          # Windows one-click launcher
  start.sh           # Mac/Linux launcher
```

## Requirements

- **Python** 3.10+
- **Node.js** 18+ (for building the frontend)
- **NVIDIA GPU** recommended (falls back to CPU)
- **espeak-ng** (required for Kokoro engine)

## License

MIT
