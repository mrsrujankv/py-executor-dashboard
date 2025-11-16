"""
Flask Application for Python Executor Dashboard
REST API for task execution, progress tracking, and log management
"""

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import os
import json
from pathlib import Path
from executor import executor

# Initialize Flask app
app = Flask(__name__, template_folder="../frontend/templates", static_folder="../frontend/static")
CORS(app)

# Configuration
BACKEND_DIR = Path(__file__).parent
SAMPLE_SCRIPT = BACKEND_DIR / "sample_script.py"


@app.route("/")
def index():
    """Serve the main dashboard page"""
    return render_template("index.html")


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    """Get all tasks"""
    try:
        tasks = executor.get_all_tasks()
        return jsonify({"success": True, "tasks": tasks}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/tasks/<task_id>", methods=["GET"])
def get_task(task_id):
    """Get specific task details"""
    try:
        task = executor.get_task(task_id)
        if not task:
            return jsonify({"success": False, "error": "Task not found"}), 404
        return jsonify({"success": True, "task": task}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/tasks/<task_id>/logs", methods=["GET"])
def get_task_logs(task_id):
    """Get task execution logs"""
    try:
        task = executor.get_task(task_id)
        if not task:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        logs = executor.get_task_logs(task_id)
        return jsonify({"success": True, "logs": logs}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/execute", methods=["POST"])
def execute_script():
    """Execute a Python script with user context"""
    try:
        data = request.get_json()
        
        if not data or "user_name" not in data:
            return jsonify({"success": False, "error": "user_name is required"}), 400
        
        user_name = data.get("user_name", "").strip()
        if not user_name:
            return jsonify({"success": False, "error": "user_name cannot be empty"}), 400
        
        script_type = data.get("script_type", "sample")
        args = data.get("args", [])
        
        # Determine which script to run
        if script_type == "sample":
            script_path = str(SAMPLE_SCRIPT)
        else:
            return jsonify({"success": False, "error": "Unknown script type"}), 400
        
        if not os.path.exists(script_path):
            return jsonify({"success": False, "error": f"Script not found: {script_path}"}), 400
        
        # Create and execute task
        task_id = executor.create_task(user_name, script_path, args)
        executor.execute_task(task_id)
        
        task = executor.get_task(task_id)
        return jsonify({"success": True, "task": task}), 201
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy"}), 200


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({"success": False, "error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(error):
    """Handle 500 errors"""
    return jsonify({"success": False, "error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
