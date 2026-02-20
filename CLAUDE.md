# AI Voice Studio

Local AI-powered voice creation tool. Create custom voice profiles from text descriptions or audio references, then export them for use in other software. All processing runs on your GPU — no cloud APIs, no fees.

## Architecture

- **Backend**: Python FastAPI (`backend/`) — REST API + WebSocket on port 8765
- **Frontend**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 (`frontend/`) — built to `frontend/dist/`, served by backend
- **Voice Creation**: Two methods:
  - **Parler-TTS** — Describe a voice in natural language, generate a preview, save to library
  - **Audio Reference** — Upload a voice sample, save as a voice profile
- **Launch**: `start.bat` (Windows) — creates venv, installs deps, builds frontend, starts server + opens browser

## Quick Start

```bash
# One-click launcher (handles everything)
start.bat

# Or manually:
cd frontend && npm run build && cd ..
python backend/main.py
```

## Development

```bash
# Terminal 1: Backend
python backend/main.py

# Terminal 2: Frontend dev server (port 5173, proxies /api to 8765)
cd frontend && npm run dev
```

## Project Structure

### Backend (`backend/`)
```
main.py                         — FastAPI app, engine registration, browser launch
config.py                       — Settings (paths, port, device auto-detection)
api/
  router.py                     — Main API router, includes all sub-routers
  voice_create.py               — POST /preview-from-prompt, /save-from-prompt, /from-audio
  voices.py                     — GET/DELETE /voices, GET /voices/{id}/audio, export, import
  tts.py                        — GET /tts/engines, POST /tts/engines/install/{name}
  gpu.py                        — GET /gpu/status, POST /gpu/fix-cuda
  previews.py                   — Serve preview audio files
  audio.py                      — Serve/export audio files
  ws.py                         — WebSocket at /ws/progress (model download + generation progress)
engines/
  base.py                       — TTSEngine ABC, VoiceProfile dataclass, GenerationRequest/Result
  engine_manager.py             — Engine registry, load/unload, VRAM-aware switching
  kokoro_engine.py              — Kokoro integration
  fish_speech_engine.py         — Fish Speech (registered but not installed by default)
  f5tts_engine.py               — F5-TTS (registered but not installed by default)
services/
  parler_service.py             — Parler-TTS model: load, generate preview, auto-unload
  voice_library.py              — File-based voice profile storage (metadata.json + reference.wav)
  audio_processing.py           — Format conversion, normalize, trim
utils/
  logging_config.py             — Structured logging setup
data/                           — Runtime data (gitignored): voices/, previews/, outputs/, models/
```

### Frontend (`frontend/src/`)
```
pages/
  CreatePage.tsx                — Two-tab voice creation: "Describe a Voice" / "From Audio Reference"
  LibraryPage.tsx               — Voice grid with preview, export, delete
  SettingsPage.tsx              — Parler-TTS status, GPU status, engine list
components/
  create/
    PromptVoiceCreator.tsx      — Text description → Parler-TTS preview → save to library
    PromptBuilder.tsx           — Voice description builder with attribute dropdowns
    AudioVoiceCreator.tsx       — Audio upload → save as voice profile
  layout/
    MainLayout.tsx              — Page routing via activePage state (not React Router)
    Sidebar.tsx                 — Create / Library / Settings nav
    Header.tsx                  — Top bar with GPU status dot
  voices/
    VoiceCard.tsx               — Voice card with audio preview, source badge, export
    AudioUploader.tsx           — Drag-and-drop audio file upload
  ui/
    ConfirmDialog.tsx           — Modal confirmation dialog
    ErrorBoundary.tsx           — React error boundary
lib/
  api.ts                        — Typed fetch wrapper for all endpoints
  utils.ts                      — cn() helper (clsx + tailwind-merge)
types/
  index.ts                      — VoiceProfile, EngineInfo, PreviewResponse, PageId, etc.
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check + GPU info |
| GET | `/api/tts/engines` | List registered TTS engines |
| POST | `/api/tts/engines/install/{name}` | Install engine via pip (streams progress via WS) |
| GET | `/api/voices/create/parler-status` | Check Parler-TTS availability |
| POST | `/api/voices/create/preview-from-prompt` | Generate voice preview from description |
| POST | `/api/voices/create/save-from-prompt` | Save previewed voice to library |
| POST | `/api/voices/create/from-audio` | Create voice from uploaded audio |
| GET | `/api/voices` | List all voice profiles |
| GET | `/api/voices/{id}` | Get voice profile |
| GET | `/api/voices/{id}/audio` | Serve reference audio |
| GET | `/api/voices/{id}/export` | Export voice as ZIP |
| POST | `/api/voices/import` | Import voice from ZIP |
| DELETE | `/api/voices/{id}` | Delete voice |
| GET | `/api/gpu/status` | GPU memory, utilization, temperature |
| POST | `/api/gpu/fix-cuda` | Reinstall PyTorch with CUDA support |
| GET | `/api/previews/{date}/{filename}` | Serve preview audio |
| WS | `/api/ws/progress` | Real-time progress (model download, generation) |

## Conventions

- **Backend imports**: Absolute (e.g., `from engines.base import VoiceProfile`), not relative
- **Async ML calls**: Use `asyncio.get_event_loop().run_in_executor(None, fn)` for sync model inference
- **Device handling**: Use `settings.device` from config — never hard-code "cuda"
- **Frontend styling**: Tailwind v4 with `@theme` block in `index.css`
- **Theme**: Japanese "Kurayami" — sumi ink backgrounds, torii vermillion primary (`#c53d2e`), kintsugi gold accents (`#d4a259`), tea green for success (`#6b8f71`)
- **Navigation**: State-based page switching in MainLayout (not React Router)
- **VoiceProfile**: Has `source` field ("audio" | "prompt") and optional `description`

## Dependencies

- Python 3.10+, Node.js 18+
- espeak-ng (auto-installed by start.bat) — required for Kokoro
- GPU: NVIDIA with CUDA recommended (CPU works but slower)
- Key pip: fastapi, uvicorn, torch, soundfile, pynvml, kokoro, parler-tts
- Fish Speech / F5-TTS NOT installed by default (conflicting deps that break pydantic/numpy)

## start.bat Installer

Uses versioned dependency markers (`venv\.deps-v4`) to track install state.
Installs: core packages → Kokoro → Parler-TTS.
**Caution**: Never use literal parentheses `()` in echo statements inside batch `if ( ... )` blocks — they break the parser.
