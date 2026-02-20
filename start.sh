#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo ""
echo "  ======================================================"
echo "      AI Voice Studio - One Click Launcher"
echo "  ======================================================"
echo ""

# =========================================================
#  Check Python
# =========================================================
PYTHON=""
if command -v python3 &>/dev/null; then
    PYTHON="python3"
elif command -v python &>/dev/null; then
    PYTHON="python"
else
    echo "  [ERROR] Python is not installed!"
    echo ""
    echo "  Install Python 3.10+ from: https://www.python.org/downloads/"
    echo "  Or use your package manager:"
    echo "    Ubuntu/Debian: sudo apt install python3 python3-venv"
    echo "    macOS:         brew install python"
    echo ""
    exit 1
fi

echo "  [OK] $($PYTHON --version) found"

# =========================================================
#  Check Node.js
# =========================================================
if ! command -v node &>/dev/null; then
    echo "  [ERROR] Node.js is not installed!"
    echo ""
    echo "  Install Node.js from: https://nodejs.org/"
    echo "  Or use your package manager:"
    echo "    Ubuntu/Debian: sudo apt install nodejs npm"
    echo "    macOS:         brew install node"
    echo ""
    exit 1
fi

echo "  [OK] Node.js $(node --version) found"

# =========================================================
#  Detect GPU
# =========================================================
HAS_NVIDIA=0
if command -v nvidia-smi &>/dev/null; then
    HAS_NVIDIA=1
    echo "  [OK] NVIDIA GPU detected - CUDA acceleration enabled"
else
    echo "  [NOTE] No NVIDIA GPU detected - will run in CPU mode"
fi

# =========================================================
#  Create virtual environment (first run only)
# =========================================================
if [ ! -d "venv" ]; then
    echo ""
    echo "  [SETUP] Creating Python virtual environment..."
    $PYTHON -m venv venv
    echo "  [OK] Virtual environment created"
fi

# Activate venv
source venv/bin/activate

# =========================================================
#  Install Python dependencies (first run only)
# =========================================================
if [ ! -f "venv/.deps-v4" ]; then
    echo ""
    echo "  [SETUP] Installing Python dependencies..."
    echo "          This may take several minutes on first run."
    echo ""

    pip install --upgrade pip --quiet >/dev/null 2>&1

    if [ "$HAS_NVIDIA" = "1" ]; then
        echo "          [1/4] Installing PyTorch with CUDA support..."
        pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121 || {
            echo "  [ERROR] Failed to install PyTorch with CUDA."
            echo "  Check your internet connection and try again."
            exit 1
        }
    else
        echo "          [1/4] Installing PyTorch (CPU only)..."
        pip install torch torchaudio || {
            echo "  [ERROR] Failed to install PyTorch."
            echo "  Check your internet connection and try again."
            exit 1
        }
    fi

    echo "          [2/4] Installing core packages..."
    pip install -r backend/requirements.txt || {
        echo "  [ERROR] Failed to install Python dependencies."
        echo "  Check your internet connection and try again."
        exit 1
    }

    echo "          [3/4] Installing Kokoro TTS engine..."
    pip install "kokoro>=0.8" soundfile 2>/dev/null || {
        echo "  [WARN] Kokoro install had issues - will still work with other engines."
    }

    echo "          [4/4] Installing Parler-TTS voice designer..."
    pip install parler-tts 2>/dev/null || {
        echo "  [WARN] Parler-TTS install had issues - text-prompted voice creation will not work."
    }

    touch "venv/.deps-v4"
    echo ""
    echo "  [OK] All Python dependencies installed"
else
    echo "  [OK] Python dependencies already installed"
fi

# =========================================================
#  Check espeak-ng (required by Kokoro)
# =========================================================
if ! command -v espeak-ng &>/dev/null; then
    echo ""
    echo "  [NOTE] espeak-ng is not installed."
    echo "         Kokoro voices need espeak-ng to work."
    echo ""
    echo "         Install it:"
    echo "           Ubuntu/Debian: sudo apt install espeak-ng"
    echo "           macOS:         brew install espeak-ng"
    echo ""
    echo "  Press Enter to continue anyway (other engines still work)..."
    read -r
fi

# =========================================================
#  Build frontend (first run only)
# =========================================================
if [ ! -f "frontend/dist/index.html" ]; then
    echo ""
    echo "  [SETUP] Installing frontend dependencies..."
    cd frontend
    npm install || {
        echo "  [ERROR] Failed to install frontend dependencies."
        exit 1
    }

    echo "  [SETUP] Building frontend - this may take a minute..."
    npm run build || {
        echo "  [ERROR] Frontend build failed."
        exit 1
    }
    cd ..
    echo "  [OK] Frontend built successfully"
else
    echo "  [OK] Frontend already built"
fi

# =========================================================
#  Launch!
# =========================================================
echo ""
echo "  ======================================================"
echo "    Starting AI Voice Studio..."
echo "    Your browser will open automatically."
echo "    Press Ctrl+C to stop the server."
echo "  ======================================================"
echo ""

$PYTHON backend/main.py

echo ""
echo "  Server stopped."
