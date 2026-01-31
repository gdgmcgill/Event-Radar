@echo off
REM Setup script for Two-Tower Recommendation Service
REM This script installs dependencies in the parent venv

echo ========================================
echo Setting up Recommendation Service
echo ========================================
echo.

REM Check if venv exists in parent directory
if not exist "..\venv\Scripts\activate.bat" (
    echo ERROR: Virtual environment not found at ..\venv
    echo Please create a virtual environment first:
    echo   python -m venv ..\venv
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call ..\venv\Scripts\activate.bat

REM Upgrade pip
echo.
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install CPU-only PyTorch first (if needed)
echo.
echo Installing PyTorch (CPU-only)...
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu

REM Install requirements
echo.
echo Installing requirements...
python -m pip install -r requirements.txt

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo To start the service, run:
echo   cd AI
echo   python run.py
echo.
pause


