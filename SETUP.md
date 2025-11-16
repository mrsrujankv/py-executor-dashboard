# Installation & Setup Guide

## Quick Start

### 1. Prerequisites
- Python 3.8 or higher
- pip (Python package manager)
- Git
- Modern web browser (Chrome, Firefox, Safari, Edge)

### 2. Clone Repository
```bash
git clone https://github.com/mrsrujankv/py-executor-dashboard.git
cd py-executor-dashboard
```

### 3. Create Virtual Environment

**macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows (PowerShell):**
```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
python -m venv venv
venv\Scripts\activate.bat
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Create Logs Directory
```bash
mkdir -p backend/logs
```

### 6. Run the Application
```bash
cd backend
python app.py
```

Expected output:
```
 * Running on http://0.0.0.0:5000
 * Debug mode: on
 * WARNING: This is a development server. Do not use it in production.
```

### 7. Access Dashboard
Open your browser and navigate to: **http://localhost:5000**

## Detailed Installation Steps

### Step-by-Step for macOS

```bash
# 1. Clone the repository
git clone https://github.com/mrsrujankv/py-executor-dashboard.git
cd py-executor-dashboard

# 2. Create virtual environment
python3 -m venv venv

# 3. Activate virtual environment
source venv/bin/activate

# 4. Upgrade pip
pip install --upgrade pip

# 5. Install requirements
pip install -r requirements.txt

# 6. Create logs directory
mkdir -p backend/logs

# 7. Run the app
cd backend
python app.py
```

### Step-by-Step for Linux (Ubuntu/Debian)

```bash
# 1. Install Python and pip
sudo apt-get update
sudo apt-get install python3 python3-pip python3-venv

# 2. Clone the repository
git clone https://github.com/mrsrujankv/py-executor-dashboard.git
cd py-executor-dashboard

# 3. Create virtual environment
python3 -m venv venv

# 4. Activate virtual environment
source venv/bin/activate

# 5. Upgrade pip
pip install --upgrade pip

# 6. Install requirements
pip install -r requirements.txt

# 7. Create logs directory
mkdir -p backend/logs

# 8. Run the app
cd backend
python app.py
```

### Step-by-Step for Windows

```cmd
REM 1. Clone the repository
git clone https://github.com/mrsrujankv/py-executor-dashboard.git
cd py-executor-dashboard

REM 2. Create virtual environment
python -m venv venv

REM 3. Activate virtual environment
venv\Scripts\activate.bat

REM 4. Upgrade pip
python -m pip install --upgrade pip

REM 5. Install requirements
pip install -r requirements.txt

REM 6. Create logs directory
mkdir backend\logs

REM 7. Run the app
cd backend
python app.py
```

## Troubleshooting Installation

### Issue: Python command not found
**Solution:** 
- Ensure Python is installed: `python --version`
- Try `python3` instead of `python`
- Add Python to PATH (Windows)

### Issue: pip command not found
**Solution:**
```bash
# Upgrade pip
python -m pip install --upgrade pip

# Or try
python3 -m pip install --upgrade pip
```

### Issue: Virtual environment activation fails
**Solution:**
- Use the correct activation script for your OS
- Try with full path: `source /path/to/venv/bin/activate`
- Check file permissions: `ls -la venv/bin/activate`

### Issue: Permission denied when running app.py
**Solution:**
```bash
chmod +x backend/app.py
python backend/app.py
```

### Issue: Port 5000 already in use
**Solution 1:** Kill the process using port 5000
```bash
# macOS/Linux
lsof -i :5000
kill -9 <PID>

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**Solution 2:** Use a different port
Edit `backend/app.py`:
```python
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)  # Change 5000 to 5001
```

## Verifying Installation

### 1. Check Python Version
```bash
python --version
# Should show Python 3.8 or higher
```

### 2. Check Virtual Environment
```bash
which python  # macOS/Linux
where python  # Windows
# Should show path inside venv directory
```

### 3. Check Installed Packages
```bash
pip list
# Should show flask, flask-cors, python-dotenv
```

### 4. Check API Health
Open in browser or terminal:
```bash
curl http://localhost:5000/api/health
# Should return: {"status":"healthy"}
```

## Running the Application

### Development Mode (Default)
```bash
cd backend
python app.py
```
Features:
- Auto-reload on code changes
- Debug error pages
- Verbose logging
- ⚠️ Not secure for production

### Production Mode
Edit `backend/app.py`:
```python
if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
```

Then run with WSGI server:
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## Next Steps

1. **Read the main README.md** for detailed documentation
2. **Try the sample script** execution
3. **Create custom scripts** in the `backend/` directory
4. **Configure settings** in `backend/config.py`

## Getting Help

### Check Logs
```bash
# View application logs
tail -f backend/logs/*.log

# Check browser console (Press F12)
# Look for network errors or JavaScript issues
```

### Common Issues & Solutions

**Dashboard doesn't load:**
- Check browser console (F12) for errors
- Verify Flask is running: `curl http://localhost:5000`
- Check firewall settings

**Scripts don't execute:**
- Ensure script file exists
- Check file permissions: `chmod +x backend/sample_script.py`
- Check logs directory exists: `mkdir -p backend/logs`

**No logs appearing:**
- Check logs directory permissions: `chmod 755 backend/logs`
- Verify write permissions

**API errors:**
- Check API endpoint URLs are correct
- Verify CORS is enabled
- Check Flask error logs in terminal

## Uninstalling

To remove the application:
```bash
# Deactivate virtual environment
deactivate

# Remove the directory
cd ..
rm -rf py-executor-dashboard

# Or on Windows
rmdir /s /q py-executor-dashboard
```

## Next: Running Your First Task

1. Open http://localhost:5000
2. Enter your name
3. Select "Sample Script"
4. Click "Execute Script"
5. Watch the progress bar and logs update in real-time!

For more information, see the main [README.md](README.md)
