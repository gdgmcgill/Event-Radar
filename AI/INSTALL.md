# Installation Guide

## Quick Setup (Windows)

### Option 1: Use the Setup Script (Recommended)

```bash
cd AI
setup.bat
```

### Option 2: Manual Installation

1. **Activate your virtual environment** (from the project root):
   ```bash
   # Windows PowerShell
   .\venv\Scripts\Activate.ps1
   
   # Windows CMD
   venv\Scripts\activate.bat
   ```

2. **Navigate to the AI directory**:
   ```bash
   cd AI
   ```

3. **Upgrade pip**:
   ```bash
   python -m pip install --upgrade pip
   ```

4. **Install PyTorch (CPU-only)**:
   ```bash
   python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
   ```

5. **Install other requirements**:
   ```bash
   python -m pip install -r requirements.txt
   ```

## Quick Setup (Linux/Mac)

### Option 1: Use the Setup Script

```bash
cd AI
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Installation

1. **Activate your virtual environment**:
   ```bash
   source ../venv/bin/activate
   ```

2. **Navigate to the AI directory**:
   ```bash
   cd AI
   ```

3. **Upgrade pip**:
   ```bash
   python -m pip install --upgrade pip
   ```

4. **Install PyTorch (CPU-only)**:
   ```bash
   python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
   ```

5. **Install other requirements**:
   ```bash
   python -m pip install -r requirements.txt
   ```

## Common Issues

### Issue: "Unable to create process"

**Solution**: Make sure you're using the correct pip command:
- ❌ Wrong: `pip install AI\requirements.txt`
- ✅ Correct: `pip install -r requirements.txt` (from AI directory)
- ✅ Also correct: `python -m pip install -r requirements.txt`

### Issue: PyTorch installation fails

**Solution**: Install PyTorch separately first:
```bash
python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
```

### Issue: Virtual environment not found

**Solution**: Create a virtual environment in the project root:
```bash
# From project root
python -m venv venv
```

### Issue: Permission errors (Linux/Mac)

**Solution**: Make sure you're using the virtual environment's pip, not system pip:
```bash
which pip  # Should point to venv/bin/pip
```

## Verify Installation

After installation, verify everything works:

```bash
cd AI
python -c "import torch; import fastapi; import sentence_transformers; print('All imports successful!')"
```

## Start the Service

Once installed, start the recommendation service:

```bash
cd AI
python run.py
```

The API will be available at `http://localhost:8000`


