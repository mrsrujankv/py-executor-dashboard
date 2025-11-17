# DEVELOPER GUIDE - Complete Architecture & Code Explanation

## Table of Contents
1. [System Overview](#system-overview)
2. [File-by-File Explanation](#file-by-file-explanation)
3. [Data Flow](#data-flow)
4. [Key Concepts](#key-concepts)
5. [How to Extend](#how-to-extend)
6. [Debugging Guide](#debugging-guide)

---

## System Overview

This Python Executor Dashboard is a full-stack web application that allows users to execute Python scripts and monitor their progress in real-time.

### Technology Stack
- **Backend**: Python 3.8+ with Flask framework
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Communication**: HTTP REST API with JSON
- **Architecture**: Single-threaded server with multi-threaded task execution

### Key Features
- ✅ Real-time script execution monitoring
- ✅ Live progress tracking and log streaming
- ✅ User context tracking
- ✅ Complete execution history
- ✅ Responsive modern UI

---

## File-by-File Explanation

### 1. `backend/app.py` - Flask REST API Server

**Purpose**: Creates the web server and defines all API endpoints

**Key Concepts**:
- **Flask Framework**: Lightweight Python web framework
- **@app.route()**: Decorators that map URLs to Python functions
- **jsonify()**: Converts Python dicts to JSON responses
- **REST API**: Stateless API endpoints (GET, POST)

**Main Functions**:

#### `index()` - Route: GET /
```python
@app.route("/")
def index():
    return render_template("index.html")
```
- Serves the main HTML dashboard page
- Called when user visits http://localhost:5000

#### `execute_script()` - Route: POST /api/execute
```python
@app.route("/api/execute", methods=["POST"])
def execute_script():
```
**What it does**:
1. Receives JSON data from frontend with user name and script type
2. Validates the input
3. Maps script type to actual file path
4. Creates a new task via executor.create_task()
5. Starts execution in background via executor.execute_task()
6. Returns the task object with unique ID

**Example Flow**:
```
Frontend sends:
POST /api/execute
{"user_name": "Alice", "script_type": "sample", "args": []}

Backend processes:
1. Validates user_name is not empty
2. Finds sample script path
3. Creates task with UUID: "abc123..."
4. Starts execution thread
5. Returns: {"success": true, "task": {...}}

Frontend receives task ID and starts polling for updates
```

#### `get_tasks()` - Route: GET /api/tasks
- Returns all tasks ever created
- Used to populate the task history table

#### `get_task()` - Route: GET /api/tasks/<task_id>
- Returns a specific task's current status
- Frontend polls this every 1 second to get progress updates

#### `get_task_logs()` - Route: GET /api/tasks/<task_id>/logs
- Returns the complete log output for a task
- Frontend polls this to display real-time logs

---

### 2. `backend/executor.py` - Task Execution Engine

**Purpose**: Manages script execution with threading, progress tracking, and logging

**Core Class**: `TaskExecutor`

**Key Concepts**:
- **Threading**: Runs scripts in background threads so API doesn't block
- **subprocess.Popen()**: Starts new Python processes
- **Threading Lock**: Prevents race conditions when accessing shared task dictionary
- **Line Buffering**: Reads output line-by-line for real-time streaming

**Main Methods**:

#### `__init__()` - Constructor
```python
def __init__(self, logs_dir: str = "logs"):
    self.tasks = {}  # In-memory storage
    self.lock = threading.Lock()  # Prevent race conditions
```
**What it does**:
- Creates logs directory if it doesn't exist
- Initializes empty task dictionary
- Creates a lock for thread-safe access

#### `create_task()` - Create a new task
```python
def create_task(self, user_name, script_path, args):
    task_id = str(uuid.uuid4())  # Generate unique ID
    # Store task with initial values
    with self.lock:
        self.tasks[task_id] = {
            "id": task_id,
            "user_name": user_name,
            "status": "pending",
            "progress": 0,
            ...
        }
    return task_id
```

**What it does**:
1. Generates unique UUID for this task
2. Creates task dictionary with initial values
3. Stores in self.tasks (in-memory)
4. Returns task ID so caller can reference it

**Why UUID?**
- Guaranteed unique across millions of tasks
- No conflicts even in distributed systems
- Example: "550e8400-e29b-41d4-a716-446655440000"

#### `execute_task()` - Start execution
```python
def execute_task(self, task_id, callback=None):
    thread = threading.Thread(
        target=self._execute_task_internal,
        args=(task_id, callback),
        daemon=True
    )
    thread.start()
```

**What it does**:
1. Creates a new thread
2. Sets target to internal execution method
3. Starts the thread (returns immediately)
4. Script now runs in background

**Why Threading?**
- Without threading: Flask API would block for 10-20 seconds per script
- With threading: API responds immediately, script runs in background
- Frontend can poll API to monitor progress

#### `_execute_task_internal()` - Actually run the script
```python
def _execute_task_internal(self, task_id, callback=None):
    # Update status to "running"
    with self.lock:
        task["status"] = "running"
    
    # Start subprocess
    process = subprocess.Popen(
        ["python", script_path, arg1, arg2, ...],
        stdout=PIPE,  # Capture output
        stderr=PIPE,  # Capture errors
        text=True,
        bufsize=1  # Line buffered
    )
    
    # Read output line by line
    for line in process.stdout:
        output_lines.append(line)
        log_file.write(line)  # Save to disk
        
        # Update progress
        with self.lock:
            task["output"] += line
            task["progress"] = min(95, len(output_lines) * 5)
    
    # Wait for completion
    return_code = process.wait()
    
    # Mark as success or failed
    with self.lock:
        if return_code == 0:
            task["status"] = "success"
        else:
            task["status"] = "failed"
        task["progress"] = 100
```

**What it does**:
1. Updates status to "running"
2. Starts Python subprocess
3. Reads output line-by-line
4. Saves each line to log file
5. Updates task progress in-memory
6. Waits for process to finish
7. Marks as success/failed based on return code

**Thread Safety**:
- Uses `with self.lock:` to protect shared data
- Prevents corruption if multiple threads access simultaneously

**subprocess.Popen() Parameters**:
- `stdout=PIPE`: Capture output so we can read it
- `stderr=PIPE`: Capture errors separately
- `text=True`: Return strings instead of bytes
- `bufsize=1`: Line-buffered mode (each line is a unit)

---

### 3. `frontend/templates/index.html` - Dashboard UI

**Purpose**: The HTML page shown to users

**Key Elements**:
- Form for entering user name and selecting script
- Progress bar showing execution progress
- Logs display area (real-time logs)
- Task history table

**Form Structure**:
```html
<form id="executionForm">
    <input id="userName" placeholder="Enter your name" />
    <select id="scriptType">
        <option value="sample">Sample Script</option>
    </select>
    <button type="submit">Execute Script</button>
</form>
```

**Key Element IDs** (referenced by JavaScript):
- `#executionForm`: Main form
- `#userName`: User name input
- `#scriptType`: Script type dropdown
- `#executeBtn`: Execute button
- `#statusBadge`: Status display (PENDING, RUNNING, SUCCESS, FAILED)
- `#progressFill`: Progress bar fill percentage
- `#logsContent`: Text area for logs
- `#tasksTableBody`: Table body for history

---

### 4. `frontend/static/style.css` - Dashboard Styling

**Purpose**: Visual styling using modern CSS

**Key Sections**:

#### CSS Variables (Color Scheme)
```css
:root {
    --primary-color: #3b82f6;      /* Blue */
    --secondary-color: #8b5cf6;    /* Purple */
    --success-color: #10b981;      /* Green */
    --danger-color: #ef4444;       /* Red */
    --bg-primary: #0f172a;         /* Dark background */
}
```
To change colors, modify these variables.

#### Responsive Design
```css
@media (max-width: 1024px) {
    .main-content {
        grid-template-columns: 1fr;  /* Stack on mobile */
    }
}
```

#### Progress Bar Animation
```css
.progress-fill {
    background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
    transition: width 0.3s ease;  /* Smooth animation */
}
```

#### Status Badge Colors
```css
.status-badge.pending { background: var(--warning-color); }
.status-badge.running { background: var(--primary-color); }
.status-badge.success { background: var(--success-color); }
.status-badge.failed { background: var(--danger-color); }
```

---

### 5. `frontend/static/script.js` - Dashboard Logic

**Purpose**: All client-side JavaScript logic

**Architecture**:
```
User Action → Event Listener → API Call → Update UI
```

**Key Functions**:

#### API Functions
```javascript
async function executeScript(userName, scriptType, args)
// POST /api/execute - Start script execution

async function getTask(taskId)
// GET /api/tasks/{taskId} - Get task status

async function getAllTasks()
// GET /api/tasks - Get all tasks

async function getTaskLogs(taskId)
// GET /api/tasks/{taskId}/logs - Get logs
```

#### UI Update Functions
```javascript
function updateExecutionStatus(task)
// Update status badge, progress bar, and timestamps

function updateLogs(taskId)
// Fetch and display logs

function updateTaskHistory(tasks)
// Render task history table
```

#### Polling Pattern
```javascript
// Frontend calls this every 1 second while task is running
autoRefreshInterval = setInterval(async () => {
    const task = await getTask(currentTaskId);
    updateExecutionStatus(task);
    await updateLogs(currentTaskId);
    
    // Stop polling when task completes
    if (task.status !== 'running') {
        clearInterval(autoRefreshInterval);
    }
}, 1000);
```

---

## Data Flow

### Complete Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INTERACTION                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. FORM SUBMISSION (JavaScript)                                 │
│    - User enters name: "Alice"                                  │
│    - Selects script: "sample"                                   │
│    - Clicks "Execute Script" button                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. FETCH REQUEST (JavaScript)                                   │
│    POST /api/execute                                            │
│    {                                                             │
│      "user_name": "Alice",                                      │
│      "script_type": "sample",                                   │
│      "args": []                                                 │
│    }                                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. FLASK ROUTE (Python)                                         │
│    @app.route("/api/execute", methods=["POST"])                │
│    def execute_script():                                        │
│      - Validate user_name not empty                            │
│      - Check script_path exists                                 │
│      - Call executor.create_task()                             │
│      - Call executor.execute_task()                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. TASK CREATION (TaskExecutor)                                 │
│    executor.create_task("Alice", "/path/to/sample_script.py")   │
│    - Generate UUID: "550e8400-e29b-41d4-a716-446655440000"      │
│    - Create task dict with:                                      │
│      * status: "pending"                                        │
│      * progress: 0                                              │
│      * created_at: "2024-11-16T10:30:00"                        │
│      * log_file: "logs/550e8400-....log"                        │
│    - Store in self.tasks[task_id]                               │
│    - Return task_id                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. THREAD START (TaskExecutor)                                  │
│    executor.execute_task(task_id)                               │
│    - Create new Thread with daemon=True                         │
│    - Start thread (returns immediately)                         │
│    - Thread calls _execute_task_internal()                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                   ┌──────────┴──────────┐
                   │                     │
                   ▼ (Main Thread)       ▼ (Background Thread)
        ┌──────────────────┐    ┌─────────────────────────────┐
        │ 6. API RESPONSE  │    │ 7. SCRIPT EXECUTION        │
        │ Return to user:  │    │    subprocess.Popen()       │
        │ {                │    │    Read output line-by-line │
        │   "success": true│    │    Update progress          │
        │   "task": {...}  │    │    Save to log file         │
        │ }                │    │    Wait for completion      │
        └──────────────────┘    │    Mark success/failed      │
                   │            └─────────────────────────────┘
                   │                     │
                   ▼                     ▼
        ┌──────────────────┐    ┌──────────────────┐
        │ 8. JAVASCRIPT    │    │ Task completes   │
        │ POLLING          │    │ with status      │
        │ Every 1 second:  │    │ "success"        │
        │ GET /api/        │    │ progress: 100    │
        │   tasks/<id>     │    │                  │
        │ GET /api/        │    │ (Status stored   │
        │   tasks/<id>/logs│    │  in memory)      │
        └──────────────────┘    └──────────────────┘
                   │
                   ▼
        ┌──────────────────┐
        │ 9. UI UPDATE     │
        │ - Update status  │
        │ - Update progress│
        │ - Display logs   │
        └──────────────────┘
                   │
                   ▼
        ┌──────────────────┐
        │ 10. USER SEES    │
        │ Execution complete
        │ 100% progress    │
        │ All logs shown   │
        └──────────────────┘
```

---

## Key Concepts

### 1. Threading & Concurrency

**Problem**: Without threading, the API would block
```
User 1 executes script (blocks for 10 seconds)
User 2 tries to check task status
User 2 has to wait 10 seconds for User 1's script to finish
BAD USER EXPERIENCE ❌
```

**Solution**: Threading allows concurrent execution
```
User 1 starts script (executes in background thread)
API returns immediately to User 1
User 2 can check status immediately
Both users happy ✅
```

**How it works**:
```python
# Flask main thread (API)
thread = threading.Thread(target=_execute_task_internal, daemon=True)
thread.start()  # Returns immediately
# Flask can now handle other requests

# Background thread (script execution)
_execute_task_internal()  # Runs in parallel
# Doesn't block Flask
```

### 2. REST API & HTTP Methods

**GET** - Retrieve data (safe, idempotent)
```
GET /api/tasks
GET /api/tasks/abc123
GET /api/tasks/abc123/logs
```
- No side effects
- Can call multiple times safely

**POST** - Create/perform action (not idempotent)
```
POST /api/execute
Body: {"user_name": "Alice", "script_type": "sample"}
```
- Creates new resource
- Returns 201 Created

### 3. JSON Communication

Frontend sends JSON:
```json
{
  "user_name": "Alice",
  "script_type": "sample",
  "args": []
}
```

Backend receives and parses:
```python
data = request.get_json()
user_name = data.get("user_name")
```

Backend returns JSON:
```python
return jsonify({
    "success": true,
    "task": {...}
}), 201
```

Frontend receives and parses:
```javascript
const data = await response.json();
if (data.success) {
    console.log("Task created:", data.task.id);
}
```

### 4. Async/Await Pattern

Modern asynchronous programming:
```javascript
// Old way (callback hell)
fetch('/api/tasks').then(r => r.json()).then(d => {
    // nested callbacks...
});

// New way (cleaner)
async function showTasks() {
    const response = await fetch('/api/tasks');
    const data = await response.json();
    console.log(data.tasks);
}
```

**Key points**:
- `async`: Function can use `await`
- `await`: Pause until Promise resolves
- No blocking: Other code still runs

### 5. Polling for Real-Time Updates

Frontend repeatedly asks "What's the status now?"

```javascript
// Poll every 1 second
const interval = setInterval(async () => {
    const task = await getTask(taskId);
    updateUI(task);
    
    // Stop polling when done
    if (task.status !== 'running') {
        clearInterval(interval);
    }
}, 1000);
```

**Advantages**:
- Simple to implement
- Works in all browsers
- No special server config needed

**Disadvantages**:
- Higher latency (up to 1 second delay)
- More API calls
- Solution: WebSockets (future enhancement)

---

## How to Extend

### Add a New Script

1. **Create the script file**:
```python
# backend/data_analyzer.py
def main():
    print("Analyzing data...")
    # Your code here
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

2. **Register in Flask**:
```python
# In backend/app.py, in execute_script() function
elif script_type == "analyzer":
    script_path = str(BACKEND_DIR / "data_analyzer.py")
```

3. **Add to frontend**:
```html
<!-- In frontend/templates/index.html -->
<select id="scriptType">
    <option value="sample">Sample Script</option>
    <option value="analyzer">Data Analyzer</option>  <!-- Add this -->
</select>
```

### Add Authentication

```python
from flask import session
from functools import wraps

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route("/api/execute", methods=["POST"])
@login_required
def execute_script():
    # User is authenticated
    pass
```

### Add Database Persistence

```python
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy(app)

class Task(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    user_name = db.Column(db.String(255))
    status = db.Column(db.String(50))
    # ... other fields

# Save task
task_record = Task(id=task_id, user_name=user_name, status="pending")
db.session.add(task_record)
db.session.commit()
```

### Add WebSocket for Real-Time Updates

```python
from flask_socketio import SocketIO, emit

socketio = SocketIO(app)

@socketio.on('connect')
def handle_connect():
    emit('response', {'data': 'Connected'})

# When task updates
socketio.emit('task_update', {
    'task_id': task_id,
    'status': 'running',
    'progress': 45
})
```

---

## Debugging Guide

### Issue: "ModuleNotFoundError: No module named 'flask'"

**Solution**: Install dependencies
```bash
pip install -r requirements.txt
```

### Issue: Port 5000 already in use

**Solution 1**: Kill existing process
```bash
lsof -i :5000
kill -9 <PID>
```

**Solution 2**: Use different port
```python
# In backend/app.py
app.run(debug=True, port=5001)  # Change port
```

### Issue: No logs appearing

**Check 1**: Logs directory exists
```bash
mkdir -p backend/logs
chmod 755 backend/logs
```

**Check 2**: Script runs successfully
```bash
python backend/sample_script.py
```

**Check 3**: Check API response
```javascript
// In browser console
fetch('/api/tasks')
  .then(r => r.json())
  .then(d => console.log(d))
```

### Debug Print Statements

In Python:
```python
print(f"[DEBUG] Task ID: {task_id}")
print(f"[DEBUG] Status: {task['status']}")
```

In JavaScript:
```javascript
console.log("Task ID:", taskId);
console.log("Status:", task.status);
console.log("Full task:", task);  // Inspect full object
```

### Browser DevTools

Press F12 to open:
1. **Console**: See JavaScript errors
2. **Network**: See HTTP requests/responses
3. **Application**: See localStorage data

### Server Logs

In terminal running Flask:
```
 * Running on http://0.0.0.0:5000
 * Debug mode: on
 * WARNING: Do not use the development server in production
```

Any prints or errors appear here.

---

## Summary

This application demonstrates:
- ✅ Full-stack web development (frontend + backend)
- ✅ REST API design
- ✅ Threading and concurrency
- ✅ Real-time polling patterns
- ✅ Error handling and validation
- ✅ Modern JavaScript (async/await, fetch)
- ✅ HTML5 forms and validation
- ✅ CSS responsive design

Great starting point for learning full-stack development!
