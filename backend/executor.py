"""
Python Script Executor Module
Handles execution of Python scripts with progress tracking and logging
"""

import subprocess
import threading
import json
import uuid
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Callable

class TaskExecutor:
    """Manages task execution with progress tracking and logging"""
    
    def __init__(self, logs_dir: str = "logs"):
        self.logs_dir = logs_dir
        Path(logs_dir).mkdir(exist_ok=True)
        self.tasks: Dict[str, dict] = {}
        self.lock = threading.Lock()
    
    def create_task(self, user_name: str, script_path: str, args: list = None) -> str:
        """Create a new task and return task_id"""
        task_id = str(uuid.uuid4())
        
        with self.lock:
            self.tasks[task_id] = {
                "id": task_id,
                "user_name": user_name,
                "script_path": script_path,
                "args": args or [],
                "status": "pending",
                "progress": 0,
                "created_at": datetime.now().isoformat(),
                "started_at": None,
                "completed_at": None,
                "output": "",
                "error": "",
                "return_code": None,
                "log_file": os.path.join(self.logs_dir, f"{task_id}.log")
            }
        
        return task_id
    
    def execute_task(self, task_id: str, callback: Optional[Callable] = None) -> None:
        """Execute task in a separate thread"""
        thread = threading.Thread(
            target=self._execute_task_internal,
            args=(task_id, callback),
            daemon=True
        )
        thread.start()
    
    def _execute_task_internal(self, task_id: str, callback: Optional[Callable]) -> None:
        """Internal task execution logic"""
        try:
            with self.lock:
                task = self.tasks[task_id]
                task["status"] = "running"
                task["started_at"] = datetime.now().isoformat()
            
            script_path = self.tasks[task_id]["script_path"]
            args = self.tasks[task_id]["args"]
            
            # Build command
            cmd = ["python", script_path] + args
            
            # Execute with streaming output
            with open(self.tasks[task_id]["log_file"], "w") as log_file:
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1
                )
                
                # Capture output
                output_lines = []
                for line in process.stdout:
                    output_lines.append(line)
                    log_file.write(line)
                    log_file.flush()
                    
                    with self.lock:
                        self.tasks[task_id]["output"] = "".join(output_lines)
                        self.tasks[task_id]["progress"] = min(95, len(output_lines) * 5)
                    
                    if callback:
                        callback(task_id, self.tasks[task_id])
                
                # Wait for completion
                return_code = process.wait()
                stderr = process.stderr.read() if process.stderr else ""
                
                with self.lock:
                    task = self.tasks[task_id]
                    task["return_code"] = return_code
                    task["progress"] = 100
                    
                    if return_code == 0:
                        task["status"] = "success"
                    else:
                        task["status"] = "failed"
                        task["error"] = stderr
                        log_file.write(f"\nERROR:\n{stderr}")
                    
                    task["completed_at"] = datetime.now().isoformat()
                
                if callback:
                    callback(task_id, self.tasks[task_id])
        
        except Exception as e:
            with self.lock:
                self.tasks[task_id]["status"] = "failed"
                self.tasks[task_id]["error"] = str(e)
                self.tasks[task_id]["progress"] = 100
                self.tasks[task_id]["completed_at"] = datetime.now().isoformat()
            
            if callback:
                callback(task_id, self.tasks[task_id])
    
    def get_task(self, task_id: str) -> Optional[dict]:
        """Get task details"""
        with self.lock:
            return self.tasks.get(task_id)
    
    def get_all_tasks(self) -> list:
        """Get all tasks"""
        with self.lock:
            return list(self.tasks.values())
    
    def get_task_logs(self, task_id: str) -> str:
        """Get task logs"""
        log_file = self.tasks[task_id]["log_file"]
        if os.path.exists(log_file):
            with open(log_file, "r") as f:
                return f.read()
        return ""


# Sample executor instance
executor = TaskExecutor()
