import asyncio
import sys

from fastapi import APIRouter, HTTPException

from engines.engine_manager import engine_manager
from utils.logging_config import get_logger

logger = get_logger("api.tts")

router = APIRouter(prefix="/tts", tags=["tts"])

# Pip install commands per engine (and parler-tts)
INSTALL_COMMANDS: dict[str, list[str]] = {
    "kokoro": ["kokoro>=0.8", "soundfile"],
    "fish-speech": ["fish-speech"],
    "f5-tts": ["f5-tts"],
    "parler-tts": ["parler-tts"],
}


@router.get("/engines")
async def list_engines():
    engines = engine_manager.get_available_engines()
    logger.debug(f"Listed {len(engines)} engines")
    return engines


@router.get("/engines/{name}/voices")
async def list_engine_voices(name: str):
    try:
        engine = engine_manager.get_engine(name)
        voices = engine.get_available_voices()
        logger.debug(f"Engine '{name}' has {len(voices)} voices")
        return voices
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


async def _run_pip(args: list[str], ws_manager, engine_name: str) -> tuple[int, list[str]]:
    """Run a pip command, streaming output via WebSocket. Returns (exit_code, output_lines)."""
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "pip", *args,
        "--no-input",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )

    output_lines: list[str] = []
    while True:
        line = await proc.stdout.readline()
        if not line:
            break
        text = line.decode("utf-8", errors="replace").strip()
        if text:
            output_lines.append(text)
            await ws_manager.broadcast({
                "type": "install_progress",
                "engine": engine_name,
                "stage": "installing",
                "message": text,
            })

    await proc.wait()
    return proc.returncode, output_lines


@router.post("/engines/install/{name}")
async def install_engine(name: str):
    """Install an engine's pip packages and broadcast progress via WebSocket.

    On Windows, locked .pyd files can cause "Access is denied" errors when pip
    tries to upgrade in-use packages.  We handle this by:
      1. Upgrading pip itself first (modern pip uses rename-tricks on Windows)
      2. Attempting the install
      3. On permission failure, retrying without upgrading existing deps
    """
    packages = INSTALL_COMMANDS.get(name)
    if not packages:
        raise HTTPException(status_code=404, detail=f"Unknown package: {name}")

    from api.ws import ws_manager

    logger.info(f"Installing packages for '{name}': {packages}")

    await ws_manager.broadcast({
        "type": "install_progress",
        "engine": name,
        "stage": "starting",
        "message": f"Preparing to install {name}...",
    })

    try:
        # Step 1: Upgrade pip (old pip is much worse at handling locked files on Windows)
        await ws_manager.broadcast({
            "type": "install_progress",
            "engine": name,
            "stage": "installing",
            "message": "Upgrading pip...",
        })
        rc, _ = await _run_pip(["install", "--upgrade", "pip"], ws_manager, name)
        if rc != 0:
            logger.warning("pip upgrade failed, continuing anyway")

        # Step 2: Install the packages
        await ws_manager.broadcast({
            "type": "install_progress",
            "engine": name,
            "stage": "installing",
            "message": f"Installing {name}...",
        })
        rc, output_lines = await _run_pip(
            ["install", *packages, "--no-cache-dir"],
            ws_manager, name,
        )

        # Step 3: If failed with permission error, retry without upgrading locked deps
        if rc != 0:
            full_output = "\n".join(output_lines)
            is_permission_error = (
                "Access is denied" in full_output
                or "Permission denied" in full_output
                or "WinError 5" in full_output
            )

            if is_permission_error:
                logger.warning(f"Permission error installing '{name}', retrying with --no-deps")
                await ws_manager.broadcast({
                    "type": "install_progress",
                    "engine": name,
                    "stage": "installing",
                    "message": "Locked files detected, retrying without upgrading existing packages...",
                })
                rc, output_lines = await _run_pip(
                    ["install", *packages, "--no-cache-dir", "--no-deps"],
                    ws_manager, name,
                )

        if rc == 0:
            logger.info(f"Successfully installed '{name}'")
            await ws_manager.broadcast({
                "type": "install_progress",
                "engine": name,
                "stage": "complete",
                "message": f"{name} installed successfully! Restart the server to activate.",
            })
            return {"status": "ok", "engine": name, "message": "Installed successfully"}
        else:
            error_msg = "\n".join(output_lines[-5:])
            logger.error(f"Failed to install '{name}': exit code {rc}")

            # Give a helpful message for the common Windows lock issue
            full_output = "\n".join(output_lines)
            if "Access is denied" in full_output or "WinError 5" in full_output:
                hint = (
                    f"Windows is blocking file replacement because the server has them loaded. "
                    f"Stop the server, run 'pip install {' '.join(packages)}' manually, then restart."
                )
            else:
                hint = error_msg

            await ws_manager.broadcast({
                "type": "install_progress",
                "engine": name,
                "stage": "error",
                "message": hint,
            })
            raise HTTPException(status_code=500, detail=hint)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Install error for '{name}': {e}")
        await ws_manager.broadcast({
            "type": "install_progress",
            "engine": name,
            "stage": "error",
            "message": str(e),
        })
        raise HTTPException(status_code=500, detail=str(e))
