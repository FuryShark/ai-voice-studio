import asyncio
import sys

from fastapi import APIRouter, HTTPException

from utils.logging_config import get_logger

logger = get_logger("api.gpu")

router = APIRouter(prefix="/gpu", tags=["gpu"])


@router.get("/status")
async def gpu_status():
    """Get detailed GPU status: memory usage, temperature, utilization."""
    try:
        import pynvml
        pynvml.nvmlInit()
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)

        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
        utilization = pynvml.nvmlDeviceGetUtilizationRates(handle)

        try:
            temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
        except Exception:
            temp = None

        name = pynvml.nvmlDeviceGetName(handle)
        if isinstance(name, bytes):
            name = name.decode()

        pynvml.nvmlShutdown()

        logger.debug(
            f"GPU status: {name}, "
            f"VRAM {mem_info.used / 1024**3:.1f}/{mem_info.total / 1024**3:.1f}GB, "
            f"util={utilization.gpu}%, temp={temp}C"
        )

        return {
            "available": True,
            "name": name,
            "memory_total_gb": round(mem_info.total / 1024**3, 1),
            "memory_used_gb": round(mem_info.used / 1024**3, 1),
            "memory_free_gb": round(mem_info.free / 1024**3, 1),
            "memory_percent": round(mem_info.used / mem_info.total * 100, 1),
            "gpu_utilization": utilization.gpu,
            "temperature_c": temp,
        }
    except ImportError:
        logger.debug("pynvml not installed, GPU monitoring unavailable")
        return {"available": False, "error": "pynvml not installed"}
    except Exception as e:
        logger.warning(f"GPU monitoring failed: {e}")
        return {"available": False, "error": str(e)}


async def _run_pip_cuda(args: list[str], ws_manager) -> tuple[int, list[str]]:
    """Run a pip command for CUDA fix, streaming output via WebSocket."""
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
                "engine": "cuda",
                "stage": "installing",
                "message": text,
            })

    await proc.wait()
    return proc.returncode, output_lines


@router.post("/fix-cuda")
async def fix_cuda():
    """Reinstall PyTorch with CUDA support and broadcast progress via WebSocket."""
    import torch

    if torch.cuda.is_available():
        return {"status": "ok", "message": "CUDA is already available"}

    from api.ws import ws_manager

    logger.info("Reinstalling PyTorch with CUDA support")

    await ws_manager.broadcast({
        "type": "install_progress",
        "engine": "cuda",
        "stage": "starting",
        "message": "Reinstalling PyTorch with CUDA support...",
    })

    try:
        # Uninstall existing CPU-only torch
        await ws_manager.broadcast({
            "type": "install_progress",
            "engine": "cuda",
            "stage": "installing",
            "message": "Removing CPU-only PyTorch...",
        })
        rc, _ = await _run_pip_cuda(
            ["uninstall", "torch", "torchaudio", "-y"],
            ws_manager,
        )
        if rc != 0:
            logger.warning("torch uninstall returned non-zero, continuing anyway")

        # Install CUDA version
        await ws_manager.broadcast({
            "type": "install_progress",
            "engine": "cuda",
            "stage": "installing",
            "message": "Downloading PyTorch with CUDA 12.1 (this may take a few minutes)...",
        })
        rc, output_lines = await _run_pip_cuda(
            ["install", "torch", "torchaudio", "--index-url", "https://download.pytorch.org/whl/cu121", "--no-cache-dir"],
            ws_manager,
        )

        if rc == 0:
            logger.info("Successfully installed PyTorch with CUDA")
            await ws_manager.broadcast({
                "type": "install_progress",
                "engine": "cuda",
                "stage": "complete",
                "message": "PyTorch CUDA installed! Restart the server for changes to take effect.",
            })
            return {"status": "ok", "message": "PyTorch CUDA installed. Restart required."}
        else:
            error_msg = "\n".join(output_lines[-5:])
            logger.error(f"Failed to install CUDA PyTorch: exit code {rc}")
            await ws_manager.broadcast({
                "type": "install_progress",
                "engine": "cuda",
                "stage": "error",
                "message": error_msg,
            })
            raise HTTPException(status_code=500, detail=error_msg)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CUDA fix error: {e}")
        await ws_manager.broadcast({
            "type": "install_progress",
            "engine": "cuda",
            "stage": "error",
            "message": str(e),
        })
        raise HTTPException(status_code=500, detail=str(e))
