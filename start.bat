@echo off
REM ============================================================
REM  AI Voice Studio - One Click Launcher
REM ============================================================
call :main
echo.
echo  ------------------------------------------------------
echo  Window will stay open. Press any key to close.
echo  ------------------------------------------------------
pause >nul
exit /b

:main
setlocal enabledelayedexpansion
cd /d "%~dp0"
title AI Voice Studio
color 0F

echo.
echo  ======================================================
echo      AI Voice Studio - One Click Launcher
echo  ======================================================
echo.

REM ========================================================
REM  Check Python (try py, python, python3 in order)
REM ========================================================
echo  [DEBUG] Checking for Python...
set "PYTHON="
py --version >nul 2>nul && set "PYTHON=py"
if not defined PYTHON python --version >nul 2>nul && set "PYTHON=python"
if not defined PYTHON python3 --version >nul 2>nul && set "PYTHON=python3"

if not defined PYTHON (
    color 0C
    echo  [ERROR] Python is not installed.
    echo.
    echo  Please download and install Python 3.10 or newer from:
    echo    https://www.python.org/downloads/
    echo.
    echo  IMPORTANT: Check "Add Python to PATH" during install.
    echo.
    exit /b 1
)

echo  [OK] Python found: !PYTHON!

REM ========================================================
REM  Check Node.js and npm
REM ========================================================
echo  [DEBUG] Checking for Node.js...
node --version >nul 2>nul
if errorlevel 1 (
    color 0C
    echo  [ERROR] Node.js is not installed.
    echo.
    echo  Please download and install Node.js from:
    echo    https://nodejs.org/
    echo.
    echo  Choose the LTS version, then re-run this launcher.
    echo.
    exit /b 1
)

echo  [OK] Node.js found

REM Find npm command
set "NPM_CMD=npm"
where npm.cmd >nul 2>nul && set "NPM_CMD=npm.cmd"
echo  [DEBUG] npm command: !NPM_CMD!

REM ========================================================
REM  Detect GPU
REM ========================================================
set "HAS_NVIDIA=0"
nvidia-smi >nul 2>nul
if not errorlevel 1 (
    set "HAS_NVIDIA=1"
    echo  [OK] NVIDIA GPU detected - CUDA acceleration enabled
) else (
    echo  [NOTE] No NVIDIA GPU detected - will run in CPU mode
)

REM ========================================================
REM  Create virtual environment (first run only)
REM ========================================================
echo  [DEBUG] Checking virtual environment...
if not exist "venv\Scripts\activate.bat" (
    echo.
    echo  [SETUP] Creating Python virtual environment...
    !PYTHON! -m venv venv
    if not exist "venv\Scripts\activate.bat" (
        color 0C
        echo  [ERROR] Failed to create virtual environment.
        echo  Make sure you have Python 3.10 or newer installed.
        exit /b 1
    )
    echo  [OK] Virtual environment created
)

REM Activate venv
echo  [DEBUG] Activating venv...
call "venv\Scripts\activate.bat"

REM ========================================================
REM  Install Python dependencies (first run only)
REM ========================================================
echo  [DEBUG] Checking Python dependencies...
if not exist "venv\.deps-v4" (
    echo.
    echo  [SETUP] Installing Python dependencies...
    echo          This may take several minutes on first run.
    echo.
    call pip install --upgrade pip --quiet >nul 2>nul

    if "!HAS_NVIDIA!"=="1" (
        echo          [1/4] Installing PyTorch with CUDA support...
        call pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
    ) else (
        echo          [1/4] Installing PyTorch - CPU only...
        call pip install torch torchaudio
    )
    if errorlevel 1 (
        color 0C
        echo.
        echo  [ERROR] Failed to install PyTorch.
        echo  Check your internet connection and try again.
        exit /b 1
    )

    echo          [2/4] Installing core packages...
    call pip install -r backend\requirements.txt
    if errorlevel 1 (
        color 0C
        echo.
        echo  [ERROR] Failed to install Python dependencies.
        echo  Check your internet connection and try again.
        exit /b 1
    )

    echo          [3/4] Installing Kokoro TTS engine...
    call pip install "kokoro>=0.8" soundfile 2>nul
    if errorlevel 1 echo  [WARN] Kokoro install had issues - will still work with other engines.

    echo          [4/4] Installing Parler-TTS voice designer...
    call pip install parler-tts 2>nul
    if errorlevel 1 echo  [WARN] Parler-TTS install had issues - text-prompted voice creation will not work.

    echo done> "venv\.deps-v4"
    echo.
    echo  [OK] All Python dependencies installed
) else (
    echo  [OK] Python dependencies already installed
)

REM ========================================================
REM  Check / install espeak-ng (required by Kokoro)
REM ========================================================
echo  [DEBUG] Checking espeak-ng...
set "ESPEAK_FOUND=0"
where espeak-ng >nul 2>nul && set "ESPEAK_FOUND=1"
if exist "C:\Program Files\eSpeak NG\espeak-ng.exe" set "ESPEAK_FOUND=1"
if exist "C:\Program Files (x86)\eSpeak NG\espeak-ng.exe" set "ESPEAK_FOUND=1"
if "!ESPEAK_FOUND!"=="0" call :install_espeak
if "!ESPEAK_FOUND!"=="1" echo  [OK] espeak-ng found

REM ========================================================
REM  Build frontend (first run only)
REM ========================================================
echo  [DEBUG] Checking frontend build...
if not exist "frontend\dist\index.html" (
    echo.
    echo  [SETUP] Installing frontend dependencies...
    pushd frontend
    call !NPM_CMD! install
    if errorlevel 1 (
        color 0C
        echo  [ERROR] Failed to install frontend dependencies.
        popd
        exit /b 1
    )
    echo.
    echo  [SETUP] Building frontend - this may take a minute...
    call !NPM_CMD! run build
    if errorlevel 1 (
        color 0C
        echo  [ERROR] Frontend build failed.
        popd
        exit /b 1
    )
    popd
    echo  [OK] Frontend built successfully
) else (
    echo  [OK] Frontend already built
)

REM ========================================================
REM  Launch!
REM ========================================================
echo.
echo  ======================================================
echo    Starting AI Voice Studio...
echo    Your browser will open automatically.
echo    Press Ctrl+C to stop the server.
echo  ======================================================
echo.

echo  [DEBUG] Launching backend...
:server_loop
!PYTHON! backend\main.py
if !errorlevel! == 42 (
    echo.
    echo  [INFO] Server restarting...
    echo.
    goto :server_loop
)

echo.
echo  Server stopped.
exit /b 0

REM ============================================================
REM  SUBROUTINE: Install espeak-ng (flat, no nesting)
REM ============================================================
:install_espeak
echo.
echo  [SETUP] espeak-ng not found. Installing automatically...
echo          Downloading espeak-ng installer...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/espeak-ng/espeak-ng/releases/download/1.52.0/espeak-ng.msi' -OutFile '%TEMP%\espeak-ng.msi'"
if not exist "%TEMP%\espeak-ng.msi" goto :espeak_fail
echo          Running installer - you may see a UAC prompt...
start /wait "" msiexec /i "%TEMP%\espeak-ng.msi" /passive /norestart
del "%TEMP%\espeak-ng.msi" >nul 2>nul
if exist "C:\Program Files\eSpeak NG\espeak-ng.exe" goto :espeak_done
if exist "C:\Program Files (x86)\eSpeak NG\espeak-ng.exe" goto :espeak_done
:espeak_fail
echo  [WARN] espeak-ng auto-install failed.
echo         Kokoro voices may not work without it.
echo         Install manually from:
echo           https://github.com/espeak-ng/espeak-ng/releases
echo.
echo  Press any key to continue anyway...
pause >nul
exit /b 0
:espeak_done
echo  [OK] espeak-ng installed successfully
exit /b 0
