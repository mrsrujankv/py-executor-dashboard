# Quick Start Reference

## 🚀 Five Minute Setup

```bash
# 1. Clone & navigate
git clone https://github.com/mrsrujankv/py-executor-dashboard.git
cd py-executor-dashboard

# 2. Setup virtual env
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create logs directory
mkdir -p backend/logs

# 5. Run application
cd backend
python app.py
```

Open browser: **http://localhost:5000**

## 📋 Directory Structure

```
backend/
├── app.py              ← Flask application (START HERE)
├── executor.py         ← Task execution engine
├── config.py           ← Configuration settings
├── sample_script.py    ← Example script to run
├── __init__.py
└── logs/               ← Execution logs storage

frontend/
├── templates/
│   └── index.html      ← Dashboard UI
└── static/
    ├── style.css       ← Styles
    └── script.js       ← Client-side logic
```

## 🎯 Common Tasks

### Add a New Script
1. Create file: `backend/my_script.py`
2. Add to `app.py`:
```python
elif script_type == "my_script":
    script_path = str(BACKEND_DIR / "my_script.py")
```
3. Add option in `frontend/templates/index.html`

### Change Port
Edit `backend/app.py`:
```python
app.run(debug=True, host="0.0.0.0", port=8080)
```

### Enable Production Mode
```python
app.run(debug=False)
```

## 🔌 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/execute` | Start script execution |
| GET | `/api/tasks` | Get all tasks |
| GET | `/api/tasks/<id>` | Get task details |
| GET | `/api/tasks/<id>/logs` | Get task logs |
| GET | `/api/health` | Health check |

## 📊 Task Statuses

- **pending**: Waiting to start
- **running**: Currently executing
- **success**: Completed successfully
- **failed**: Execution failed

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 5000 in use | Change port or kill process: `lsof -i :5000` |
| Script not found | Check path in `app.py` |
| No logs | Create `backend/logs/` directory |
| Dashboard blank | Check browser console (F12) |
| Import errors | Run `pip install -r requirements.txt` |

## 📚 File Purposes

| File | Purpose |
|------|---------|
| `app.py` | Flask REST API server |
| `executor.py` | Script execution & task management |
| `sample_script.py` | Example script demonstrating output |
| `config.py` | Configuration settings |
| `index.html` | Main dashboard interface |
| `style.css` | Dashboard styling |
| `script.js` | Dashboard interactivity |

## 🌐 Accessing Dashboard

- **Local**: http://localhost:5000
- **Network**: http://<your-ip>:5000
- **From another machine**: Replace localhost with your IP

## 📝 Example Custom Script

```python
# backend/data_processor.py
import sys
import time

def main():
    print("Starting data processing...")
    for i in range(1, 6):
        print(f"Processing batch {i}/5...")
        time.sleep(1)
    print("✓ Done!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

## ⚙️ Configuration

Edit `backend/config.py`:
- `FLASK_DEBUG`: Debug mode on/off
- `API_HOST`: Server address
- `API_PORT`: Server port
- `LOGS_DIR`: Where to store logs
- `MAX_TASKS_IN_MEMORY`: Task history size

## 🔒 Production Checklist

- [ ] Set `FLASK_DEBUG = False`
- [ ] Change `SECRET_KEY`
- [ ] Use HTTPS
- [ ] Add authentication
- [ ] Validate user inputs
- [ ] Use production WSGI server (gunicorn)
- [ ] Set up proper logging
- [ ] Implement rate limiting
- [ ] Use environment variables for secrets

## 📞 Quick Links

- **Documentation**: [README.md](README.md)
- **Setup Guide**: [SETUP.md](SETUP.md)
- **API Reference**: See README.md API Reference section
- **Sample Script**: [backend/sample_script.py](backend/sample_script.py)

## 🎨 Customization Tips

**Change dashboard colors**: Edit `frontend/static/style.css` CSS variables:
```css
:root {
    --primary-color: #3b82f6;
    --secondary-color: #8b5cf6;
    /* ... more colors */
}
```

**Change refresh interval**: Edit `frontend/static/script.js`:
```javascript
const REFRESH_INTERVAL = 1000; // milliseconds
```

**Modify form fields**: Edit `frontend/templates/index.html` form section

## 🚀 Next Steps

1. ✅ Setup completed
2. Execute sample script to verify
3. Create your own scripts in `backend/`
4. Customize UI in `frontend/static/`
5. Deploy to production with gunicorn/Docker

Happy coding! 🎉
