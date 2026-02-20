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
if [ ! -f "venv/.deps-installed" ]; then
    echo ""
    echo "  [SETUP] Installing Python dependencies..."
    echo "          This may take several minutes on first run."
    echo ""

    pip install --upgrade pip --quiet >/dev/null 2>&1

    echo "          Installing core packages..."
    pip install -r backend/requirements.txt --quiet || {
        echo "  [ERROR] Failed to install Python dependencies."
        echo "  Check your internet connection and try again."
        exit 1
    }

    echo "          Installing Kokoro TTS engine..."
    pip install "kokoro>=0.8" soundfile --quiet || {
        echo "  [WARN] Kokoro install failed - you can still use other engines."
    }

    touch "venv/.deps-installed"
    echo "  [OK] Python dependencies installed"
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
    npm install --silent 2>/dev/null || {
        echo "  [ERROR] Failed to install frontend dependencies."
        exit 1
    }

    echo "  [SETUP] Building frontend..."
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
