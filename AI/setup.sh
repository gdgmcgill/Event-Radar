#!/bin/bash
# Setup script for Two-Tower Recommendation Service

echo "========================================"
echo "Setting up Recommendation Service"
echo "========================================"
echo ""

# Check if venv exists in parent directory
if [ ! -f "../venv/bin/activate" ]; then
    echo "ERROR: Virtual environment not found at ../venv"
    echo "Please create a virtual environment first:"
    echo "  python3 -m venv ../venv"
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
source ../venv/bin/activate

# Upgrade pip
echo ""
echo "Upgrading pip..."
python -m pip install --upgrade pip

# Install CPU-only PyTorch first (if needed)
echo ""
echo "Installing PyTorch (CPU-only)..."
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install requirements
echo ""
echo "Installing requirements..."
python -m pip install -r requirements.txt

echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo ""
echo "To start the service, run:"
echo "  cd AI"
echo "  python run.py"
echo ""

