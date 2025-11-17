"""
==============================================================================
PYTHON SCRIPT EXECUTOR MODULE
==============================================================================
This module handles the execution of Python scripts with real-time progress
tracking, comprehensive logging, and task management.

KEY CONCEPTS:
- TaskExecutor: Main class that manages script execution
- Threading: Runs scripts in background threads to keep API responsive
- Task State: Tracks status (pending, running, success, failed) of each task
- Logging: Saves execution output to files for later retrieval

WORKFLOW:
1. User submits execution request via API
2. Flask app calls create_task() to create a new task with unique ID
3. Flask app calls execute_task() which starts a background thread
4. Thread runs subprocess.Popen() to execute the Python script
5. Output is streamed line-by-line and saved to log file
6. Progress is updated as lines are received
7. Frontend polls the API to get status and logs in real-time
8. Task is marked complete when process finishes

THREAD SAFETY:
- self.lock (threading.Lock) protects access to self.tasks dictionary
- Prevents race conditions when multiple requests access task data simultaneously
==============================================================================
"""

import subprocess  # For running external Python scripts
import threading   # For running tasks in background threads
import json        # For JSON serialization (optional)
import uuid        # For generating unique task IDs
import os          # For file operations
from datetime import datetime  # For timestamps
from pathlib import Path       # For file path operations
from typing import Dict, Optional, Callable  # For type hints


class TaskExecutor:
    """
    Main class that manages the execution and monitoring of Python scripts.
    
    ATTRIBUTES:
        logs_dir (str): Directory where execution logs are stored
        tasks (Dict[str, dict]): In-memory storage of all tasks
        lock (threading.Lock): Ensures thread-safe access to tasks dictionary
    
    EXAMPLE USAGE:
        executor = TaskExecutor(logs_dir="logs")
        task_id = executor.create_task("John", "script.py", [])
        executor.execute_task(task_id)
        task_status = executor.get_task(task_id)
    """
    
    def __init__(self, logs_dir: str = "logs"):
        """
        Initialize the TaskExecutor.
        
        PARAMETERS:
            logs_dir (str): Path to directory for storing log files.
                           Directory is created if it doesn't exist.
        
        EXAMPLE:
            executor = TaskExecutor(logs_dir="./execution_logs")
        """
        self.logs_dir = logs_dir
        
        # Create logs directory if it doesn't exist
        # exist_ok=True prevents error if directory already exists
        Path(logs_dir).mkdir(exist_ok=True)
        
        # Dictionary to store all task states in memory
        # Key: unique task ID (UUID string)
        # Value: dictionary containing task details (status, progress, logs, etc.)
        self.tasks: Dict[str, dict] = {}
        
        # Threading lock to prevent race conditions
        # When multiple threads access self.tasks, this lock ensures only one
        # thread can modify it at a time, preventing data corruption
        self.lock = threading.Lock()
    
    
    def create_task(self, user_name: str, script_path: str, args: list = None) -> str:
        """
        Create a new task record in the executor.
        
        This method creates a unique task with all necessary metadata but does NOT
        execute the script. Use execute_task() after this to actually run it.
        
        PARAMETERS:
            user_name (str): Name of the user running this task (for reference/logs)
            script_path (str): Full path to the Python script file to execute
            args (list): Command-line arguments to pass to the script
        
        RETURNS:
            str: Unique task ID (UUID) to reference this task later
        
        TASK STRUCTURE (what gets stored):
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",  # Unique identifier
                "user_name": "John Doe",                        # User reference
                "script_path": "/path/to/script.py",           # Script location
                "args": ["arg1", "arg2"],                      # Script arguments
                "status": "pending",                           # Current status
                "progress": 0,                                 # Percentage complete
                "created_at": "2024-11-16T10:30:00",          # When created
                "started_at": None,                            # When execution started
                "completed_at": None,                          # When finished
                "output": "",                                  # Script output so far
                "error": "",                                   # Error message if failed
                "return_code": None,                           # Exit code (0=success)
                "log_file": "logs/550e8400-....log"           # Path to log file
            }
        
        EXAMPLE:
            task_id = executor.create_task(
                user_name="Alice",
                script_path="/app/backend/data_processor.py",
                args=["--input", "data.csv"]
            )
            print(f"Created task: {task_id}")
            # Output: Created task: 550e8400-e29b-41d4-a716-446655440000
        
        THREAD SAFETY:
            Uses self.lock to ensure task dictionary isn't modified by other
            threads while we're adding the new task
        """
        # Generate a unique identifier for this task (UUID4 is random and unique)
        task_id = str(uuid.uuid4())
        
        # Lock the tasks dictionary to prevent other threads from modifying it
        # while we're creating our new task
        with self.lock:
            # Create the task dictionary with all initial values
            self.tasks[task_id] = {
                "id": task_id,
                "user_name": user_name,
                "script_path": script_path,
                "args": args or [],  # Use empty list if None provided
                "status": "pending",  # Initial status before execution starts
                "progress": 0,  # 0% complete initially
                "created_at": datetime.now().isoformat(),  # Record creation time
                "started_at": None,  # Will be set when execute_task() runs it
                "completed_at": None,  # Will be set when script finishes
                "output": "",  # Will accumulate script output during execution
                "error": "",  # Will store error message if execution fails
                "return_code": None,  # Will store Python exit code (0 = success)
                "log_file": os.path.join(self.logs_dir, f"{task_id}.log")
            }
        
        # Return the task ID so caller can reference this task later
        return task_id
    
    
    def execute_task(self, task_id: str, callback: Optional[Callable] = None) -> None:
        """
        Execute a task in a separate background thread.
        
        This method does NOT wait for the script to finish. Instead, it starts
        the script in a background thread and immediately returns. This keeps
        the API responsive while the script runs.
        
        WHY THREADING?
        If we ran scripts directly without threads, the API would block and
        become unresponsive while waiting for the script to complete. By using
        threads, multiple scripts can run simultaneously and users can monitor
        them in real-time via the API.
        
        PARAMETERS:
            task_id (str): The ID of the task to execute (from create_task())
            callback (Callable, optional): Function to call when task state updates
                                          Signature: callback(task_id, task_dict)
        
        EXAMPLE:
            def on_progress(task_id, task_state):
                print(f"Task {task_id}: {task_state['progress']}% complete")
            
            executor.execute_task(task_id, callback=on_progress)
            print("Script started in background!")  # Returns immediately
        
        INTERNALS:
            - Creates a new Thread object
            - Sets target to _execute_task_internal() method
            - Sets daemon=True so thread doesn't prevent app shutdown
            - Starts the thread
        """
        # Create a new thread that will run the script
        # daemon=True means this thread won't prevent the application from exiting
        thread = threading.Thread(
            target=self._execute_task_internal,  # The method to run in thread
            args=(task_id, callback),             # Arguments to pass to method
            daemon=True                           # Background thread (not blocking)
        )
        
        # Start the thread immediately
        # From this point, the method returns and script runs in background
        thread.start()
    
    
    def _execute_task_internal(self, task_id: str, callback: Optional[Callable]) -> None:
        """
        INTERNAL method that actually executes the Python script.
        
        This runs inside the background thread created by execute_task().
        It handles the entire execution pipeline:
        1. Update task status to "running"
        2. Start the subprocess
        3. Stream output line-by-line
        4. Save output to log file
        5. Update progress
        6. Handle completion/errors
        
        The underscore prefix (_) indicates this is an internal method not meant
        to be called directly. Use execute_task() instead.
        
        HOW SUBPROCESS WORKS:
        subprocess.Popen() starts a new Python process to run the script.
        We use pipes (stdout=PIPE, stderr=PIPE) to capture the output so we
        can read it line-by-line and display it in real-time.
        
        PARAMETERS:
            task_id (str): ID of task to execute
            callback (Callable): Function to notify on progress updates
        
        ERROR HANDLING:
            - Catches exceptions and marks task as "failed"
            - Stores error message in task['error']
            - Still completes the task (doesn't leave it hanging)
        """
        try:
            # Update task status to "running" with thread safety
            with self.lock:
                task = self.tasks[task_id]
                task["status"] = "running"
                task["started_at"] = datetime.now().isoformat()
            
            # Get the script path and arguments from the task
            script_path = self.tasks[task_id]["script_path"]
            args = self.tasks[task_id]["args"]
            
            # Build the command to execute
            # Example: ["python", "/path/to/script.py", "arg1", "arg2"]
            cmd = ["python", script_path] + args
            
            # Open the log file where we'll write all output
            with open(self.tasks[task_id]["log_file"], "w") as log_file:
                # Start the Python subprocess
                # Popen() creates a new process but doesn't wait for it to finish
                # stdout=PIPE: Capture output so we can read it
                # stderr=PIPE: Capture errors separately
                # text=True: Return output as strings (not bytes)
                # bufsize=1: Line buffered (each line is a unit)
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,  # Capture standard output
                    stderr=subprocess.PIPE,  # Capture error output
                    text=True,               # Return strings, not bytes
                    bufsize=1                # Line-buffered mode
                )
                
                # Read output line by line as script executes
                # This creates a real-time streaming effect
                output_lines = []
                for line in process.stdout:
                    # Add line to list for accumulation
                    output_lines.append(line)
                    
                    # Write line to log file immediately
                    log_file.write(line)
                    log_file.flush()  # Force write to disk immediately
                    
                    # Update task progress with thread safety
                    with self.lock:
                        # Accumulate all output
                        self.tasks[task_id]["output"] = "".join(output_lines)
                        
                        # Calculate progress (max 95% until process finishes)
                        # This is because we can't know exact % without end markers
                        self.tasks[task_id]["progress"] = min(95, len(output_lines) * 5)
                    
                    # Call the callback to notify about progress
                    if callback:
                        callback(task_id, self.tasks[task_id])
                
                # Wait for process to complete and get exit code
                # 0 = success, non-zero = error
                return_code = process.wait()
                
                # Read any remaining error output
                stderr = process.stderr.read() if process.stderr else ""
                
                # Update task with final status
                with self.lock:
                    task = self.tasks[task_id]
                    task["return_code"] = return_code
                    task["progress"] = 100  # 100% complete
                    
                    # Determine if execution was successful
                    if return_code == 0:
                        task["status"] = "success"
                    else:
                        task["status"] = "failed"
                        task["error"] = stderr
                        # Also write error to log file
                        log_file.write(f"\nERROR:\n{stderr}")
                    
                    # Record completion time
                    task["completed_at"] = datetime.now().isoformat()
                
                # Notify about final status
                if callback:
                    callback(task_id, self.tasks[task_id])
        
        except Exception as e:
            # If anything goes wrong, mark task as failed with error message
            with self.lock:
                self.tasks[task_id]["status"] = "failed"
                self.tasks[task_id]["error"] = str(e)
                self.tasks[task_id]["progress"] = 100
                self.tasks[task_id]["completed_at"] = datetime.now().isoformat()
            
            if callback:
                callback(task_id, self.tasks[task_id])
    
    
    def get_task(self, task_id: str) -> Optional[dict]:
        """
        Retrieve the current state of a task.
        
        PARAMETERS:
            task_id (str): ID of task to retrieve
        
        RETURNS:
            dict: Task object with all current values, or None if task doesn't exist
        
        EXAMPLE:
            task = executor.get_task("550e8400-e29b-41d4-a716-446655440000")
            if task:
                print(f"Status: {task['status']}, Progress: {task['progress']}%")
            else:
                print("Task not found")
        
        THREAD SAFETY:
            Uses self.lock to ensure we get a consistent snapshot of task state
        """
        with self.lock:
            # Return the task if it exists, otherwise return None
            return self.tasks.get(task_id)
    
    def get_all_tasks(self) -> list:
        """
        Retrieve all tasks currently in the system.
        
        RETURNS:
            list: List of all task dictionaries
        
        USE CASE:
            Called by the API to populate the task history table in the dashboard
        
        EXAMPLE:
            all_tasks = executor.get_all_tasks()
            for task in all_tasks:
                print(f"{task['user_name']}: {task['status']}")
        
        THREAD SAFETY:
            Uses self.lock to ensure we get all tasks without race conditions
        """
        with self.lock:
            # Convert dictionary values to list and return
            # This creates a snapshot of all tasks at this moment
            return list(self.tasks.values())
    
    def get_task_logs(self, task_id: str) -> str:
        """
        Retrieve the complete log output for a task.
        
        Reads the log file that was created during task execution.
        
        PARAMETERS:
            task_id (str): ID of task whose logs to retrieve
        
        RETURNS:
            str: Complete log content as a string, empty string if no logs yet
        
        EXAMPLE:
            logs = executor.get_task_logs(task_id)
            print(logs)
            # Output:
            # [2024-11-16 10:30:01] Starting sample script execution...
            # [2024-11-16 10:30:02] Initializing application
            # ...
        
        NOTE:
            Logs are written to files in the logs_dir directory.
            Each task has its own log file: logs/{task_id}.log
        
        THREAD SAFETY:
            File reads are thread-safe in Python; multiple threads can read
            the same file simultaneously.
        """
        # Get the log file path from the task
        log_file = self.tasks[task_id]["log_file"]
        
        # Check if log file exists
        if os.path.exists(log_file):
            # Open and read the entire file
            with open(log_file, "r") as f:
                return f.read()
        
        # Return empty string if file doesn't exist yet
        return ""


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================
# Create a global TaskExecutor instance used by the Flask app
# This ensures all tasks from all requests use the same executor
executor = TaskExecutor()
