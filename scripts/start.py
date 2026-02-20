"""
AI Voice Studio - Startup Script
Run this to install deps, build the frontend (if needed), and launch the app.
"""
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"
FRONTEND_DIST = FRONTEND_DIR / "dist"
DEPS_MARKER = PROJECT_ROOT / "venv" / ".deps-installed"


def check_node():
    try:
        subprocess.run(["node", "--version"], capture_output=True, check=True)
        return True
    except FileNotFoundError:
        return False


def install_deps():
    """Install Python dependencies if not already done."""
    if DEPS_MARKER.exists():
        print("[OK] Python dependencies already installed.")
        return

    print("[SETUP] Installing Python dependencies...")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r",
         str(BACKEND_DIR / "requirements.txt"), "--quiet"],
        check=True,
    )

    print("[SETUP] Installing Kokoro TTS engine...")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "kokoro>=0.8", "soundfile", "--quiet"],
    )
    if result.returncode != 0:
        print("[WARN] Kokoro install failed - other engines will still work.")

    DEPS_MARKER.parent.mkdir(parents=True, exist_ok=True)
    DEPS_MARKER.write_text("done")
    print("[OK] Python dependencies installed.")


def build_frontend():
    if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
        print("[OK] Frontend already built.")
        return True

    if not check_node():
        print("[ERROR] Node.js not found. Install Node.js 18+ to build the frontend.")
        return False

    print("[BUILD] Installing frontend dependencies...")
    subprocess.run(["npm", "install"], cwd=str(FRONTEND_DIR), check=True)

    print("[BUILD] Building frontend...")
    subprocess.run(["npm", "run", "build"], cwd=str(FRONTEND_DIR), check=True)

    print("[OK] Frontend built successfully.")
    return True


def main():
    print("=" * 50)
    print("  AI Voice Studio")
    print("=" * 50)
    print()

    # Install Python deps
    install_deps()

    # Build frontend if needed
    if not build_frontend():
        print("\nFrontend build failed. You can still use the API at http://localhost:8765/api/health")
        print()

    # Ensure backend data directories exist
    (BACKEND_DIR / "data").mkdir(exist_ok=True)

    # Launch backend
    print("[START] Launching backend server...")
    print("[INFO] Opening browser at http://localhost:8765")
    print("[INFO] Press Ctrl+C to stop\n")

    subprocess.run(
        [sys.executable, str(BACKEND_DIR / "main.py")],
        cwd=str(BACKEND_DIR),
    )


if __name__ == "__main__":
    main()
