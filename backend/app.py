"""
==============================================================================
FLASK APPLICATION FOR PYTHON EXECUTOR DASHBOARD
==============================================================================

This file creates the web server and REST API endpoints for the dashboard.

FLASK BASICS:
- Flask is a lightweight Python web framework for building web applications
- @app.route("/endpoint", methods=["GET"]) decorator defines URL endpoints
- Routes are functions that handle requests and return responses
- jsonify() converts Python dicts to JSON responses automatically

REST API ARCHITECTURE:
This app exposes a REST (Representational State Transfer) API with endpoints
that the frontend can call to:
- Execute scripts (POST /api/execute)
- Check task status (GET /api/tasks/<task_id>)
- Retrieve logs (GET /api/tasks/<task_id>/logs)
- Get all tasks (GET /api/tasks)

COMMUNICATION FLOW:
User -> Browser -> JavaScript -> HTTP Request -> Flask App -> Python Executor
        |                                                      |
        <--- JSON Response <--- jsonify() <--- executor <---

ERROR HANDLING:
- 200: Success
- 201: Created (resource successfully created)
- 400: Bad Request (client sent invalid data)
- 404: Not Found (resource doesn't exist)
- 500: Server Error (something went wrong)

CORS (Cross-Origin Resource Sharing):
CORS allows the frontend and backend to communicate even though they might
be on different domains/ports. Without it, browsers would block requests.
==============================================================================
"""

# IMPORTS: These bring in necessary functionality
from flask import Flask, render_template, request, jsonify  # Web framework
from flask_cors import CORS  # Enables cross-origin requests
import os  # File operations
import json  # JSON handling
from pathlib import Path  # Modern file path handling
from executor import executor  # Our task execution engine

# ===========================================================================
# INITIALIZATION
# ===========================================================================

# Create Flask application instance
# __name__ tells Flask where to find templates/static files relative to this file
# template_folder: Where HTML templates are located
# static_folder: Where CSS/JS/images are located
app = Flask(
    __name__,
    template_folder="../frontend/templates",
    static_folder="../frontend/static"
)

# Enable CORS (Cross-Origin Resource Sharing)
# This allows frontend (http://localhost:3000) to make requests to backend
# (http://localhost:5000) without browser blocking them as "unsafe"
CORS(app)

# ===========================================================================
# CONFIGURATION
# ===========================================================================

# Get the directory where this Python file is located
# Used to build paths to scripts
BACKEND_DIR = Path(__file__).parent

# Path to the sample script that users can execute
# This is the demo script showing what scripts can do
SAMPLE_SCRIPT = BACKEND_DIR / "sample_script.py"

# ===========================================================================
# ROUTES - Main UI
# ===========================================================================

@app.route("/")
def index():
    """
    Serve the main dashboard HTML page.
    
    FLASK FLOW:
    1. Browser requests http://localhost:5000/
    2. Flask calls this function
    3. render_template("index.html") loads the HTML file
    4. HTML is sent back to browser
    5. Browser renders the page and loads JavaScript
    6. JavaScript uses fetch() to call our API endpoints
    
    RETURNS:
        HTML content of the dashboard page
    
    EXAMPLE REQUEST:
        GET http://localhost:5000/
        
    EXAMPLE RESPONSE:
        <html>
            <head>...</head>
            <body>...</body>
        </html>
    """
    return render_template("index.html")

# ===========================================================================
# ROUTES - Task Management API
# ===========================================================================

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    """
    API endpoint to retrieve all tasks.
    
    This endpoint is called by the frontend to populate the task history table.
    It returns a list of all tasks that have been created.
    
    HTTP METHOD: GET (retrieve data, no side effects)
    
    RETURNS:
        JSON response with structure:
        {
            "success": true,
            "tasks": [
                {task1_dict},
                {task2_dict},
                ...
            ]
        }
    
    EXAMPLE REQUEST:
        GET /api/tasks
    
    EXAMPLE RESPONSE:
        {
            "success": true,
            "tasks": [
                {
                    "id": "abc123...",
                    "user_name": "John",
                    "status": "success",
                    "progress": 100,
                    ...
                }
            ]
        }
    
    ERROR HANDLING:
        - Returns 500 status code if something goes wrong
        - Always returns JSON with "success" field for client to check
    """
    try:
        # Call the executor to get all tasks from memory
        tasks = executor.get_all_tasks()
        
        # Return success response with all tasks
        # 200 is HTTP status code for OK
        return jsonify({"success": True, "tasks": tasks}), 200
    
    except Exception as e:
        # If something goes wrong, return error response
        # 500 is HTTP status code for Internal Server Error
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/tasks/<task_id>", methods=["GET"])
def get_task(task_id):
    """
    API endpoint to get details of a specific task.
    
    HTTP METHOD: GET (retrieve specific task)
    URL PARAMETER: <task_id> (the task ID to retrieve)
    
    PARAMETERS:
        task_id (str): Unique task identifier from URL
    
    RETURNS:
        JSON response with single task object
        {
            "success": true,
            "task": {task_details}
        }
    
    EXAMPLE REQUEST:
        GET /api/tasks/550e8400-e29b-41d4-a716-446655440000
    
    EXAMPLE RESPONSE:
        {
            "success": true,
            "task": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "user_name": "Alice",
                "status": "running",
                "progress": 45,
                "output": "...",
                ...
            }
        }
    
    ERROR RESPONSES:
        - 404 if task not found
        - 500 if server error
    """
    try:
        # Retrieve the task from executor
        task = executor.get_task(task_id)
        
        # Check if task exists
        if not task:
            # Return 404 Not Found if task doesn't exist
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Return the task with 200 OK status
        return jsonify({"success": True, "task": task}), 200
    
    except Exception as e:
        # Handle unexpected errors
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/tasks/<task_id>/logs", methods=["GET"])
def get_task_logs(task_id):
    """
    API endpoint to retrieve the execution logs for a task.
    
    The frontend calls this repeatedly while a script is running to get
    the latest output. Logs are streamed in real-time to the user.
    
    HTTP METHOD: GET
    URL PARAMETER: <task_id> (the task ID)
    
    PARAMETERS:
        task_id (str): Unique task identifier
    
    RETURNS:
        JSON response with logs:
        {
            "success": true,
            "logs": "Full log output as string..."
        }
    
    EXAMPLE REQUEST:
        GET /api/tasks/550e8400-e29b-41d4-a716-446655440000/logs
    
    EXAMPLE RESPONSE:
        {
            "success": true,
            "logs": "[2024-11-16 10:30:01] Starting...\n[2024-11-16 10:30:02] Step 1\n..."
        }
    
    POLLING PATTERN:
        Frontend calls this every 1 second via polling:
        setInterval(() => {
            fetch('/api/tasks/abc123/logs')
            .then(response => response.json())
            .then(data => displayLogs(data.logs))
        }, 1000)
    
    ERROR RESPONSES:
        - 404 if task not found
        - 500 if server error
    """
    try:
        # First check if task exists
        task = executor.get_task(task_id)
        if not task:
            return jsonify({"success": False, "error": "Task not found"}), 404
        
        # Get the log content from the executor
        logs = executor.get_task_logs(task_id)
        
        # Return logs with success status
        return jsonify({"success": True, "logs": logs}), 200
    
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ===========================================================================
# ROUTES - Script Execution
# ===========================================================================

@app.route("/api/execute", methods=["POST"])
def execute_script():
    """
    API endpoint to execute a Python script.
    
    This is the main endpoint that starts script execution. It:
    1. Validates input data
    2. Creates a task in the executor
    3. Starts the script in a background thread
    4. Returns the task ID to the client
    
    HTTP METHOD: POST (create/execute something)
    CONTENT-TYPE: application/json
    
    REQUEST BODY:
        {
            "user_name": "John Doe",    # Required: name for reference
            "script_type": "sample",    # Required: which script to run
            "args": ["arg1", "arg2"]    # Optional: command-line arguments
        }
    
    RETURNS:
        Success (201 Created):
        {
            "success": true,
            "task": {task_dict}  # New task with ID
        }
        
        Error (400/500):
        {
            "success": false,
            "error": "Error message..."
        }
    
    EXAMPLE REQUEST:
        POST /api/execute
        Content-Type: application/json
        
        {
            "user_name": "Alice",
            "script_type": "sample",
            "args": []
        }
    
    EXAMPLE RESPONSE:
        {
            "success": true,
            "task": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "user_name": "Alice",
                "status": "pending",
                "progress": 0,
                ...
            }
        }
    
    EXECUTION PIPELINE:
        1. Parse JSON from request body
        2. Validate required fields (user_name)
        3. Map script_type to script path
        4. Create task with unique ID
        5. Execute task in background thread
        6. Return task to client immediately
        7. Client polls /api/tasks/<id> for progress
    
    ERROR CASES:
        - 400: Missing required fields or invalid input
        - 400: Script type unknown or file not found
        - 500: Unexpected server error
    """
    try:
        # Get JSON data from request body
        # This comes from the frontend's fetch() call
        data = request.get_json()
        
        # Validate that data exists and has required fields
        if not data or "user_name" not in data:
            # 400 Bad Request: client didn't send required data
            return jsonify({"success": False, "error": "user_name is required"}), 400
        
        # Get and validate user name
        user_name = data.get("user_name", "").strip()
        if not user_name:
            # User name is empty after stripping whitespace
            return jsonify({"success": False, "error": "user_name cannot be empty"}), 400
        
        # Get the type of script to run (default to "sample")
        script_type = data.get("script_type", "sample")
        
        # Get command-line arguments (default to empty list)
        args = data.get("args", [])
        
        # ==================================================================
        # Map script type to actual script file path
        # ==================================================================
        # This is where you add new scripts for users to execute
        if script_type == "sample":
            # Use the sample script
            script_path = str(SAMPLE_SCRIPT)
        else:
            # Unknown script type
            return jsonify({"success": False, "error": "Unknown script type"}), 400
        
        # ==================================================================
        # Validate script file exists
        # ==================================================================
        if not os.path.exists(script_path):
            return jsonify({
                "success": False,
                "error": f"Script not found: {script_path}"
            }), 400
        
        # ==================================================================
        # Create and execute task
        # ==================================================================
        
        # Create task in executor (generates unique ID)
        task_id = executor.create_task(user_name, script_path, args)
        
        # Start execution in background thread
        # This returns immediately; script runs in background
        executor.execute_task(task_id)
        
        # Get the newly created task to return to client
        task = executor.get_task(task_id)
        
        # Return success with created task
        # 201 Created: standard HTTP status for resource creation
        return jsonify({"success": True, "task": task}), 201
    
    except Exception as e:
        # Catch any unexpected errors
        return jsonify({"success": False, "error": str(e)}), 500

# ===========================================================================
# ROUTES - Health Check
# ===========================================================================

@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Simple health check endpoint.
    
    Used to verify the API is running and responding.
    Useful for:
    - Docker health checks
    - Load balancers
    - Monitoring systems
    
    RETURNS:
        {"status": "healthy"}
    
    EXAMPLE REQUEST:
        GET /api/health
    
    EXAMPLE RESPONSE:
        {
            "status": "healthy"
        }
    
    HTTP STATUS:
        200 OK (always)
    """
    return jsonify({"status": "healthy"}), 200

# ===========================================================================
# ERROR HANDLERS - Handle HTTP Errors Gracefully
# ===========================================================================

@app.errorhandler(404)
def not_found(error):
    """
    Handle 404 Not Found errors.
    
    Called when user requests a URL that doesn't exist.
    
    RETURNS:
        JSON error response instead of HTML error page
    """
    return jsonify({"success": False, "error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(error):
    """
    Handle 500 Internal Server Error.
    
    Called when something unexpected happens on the server.
    
    RETURNS:
        JSON error response with generic error message
    """
    return jsonify({"success": False, "error": "Internal server error"}), 500

# ===========================================================================
# MAIN ENTRY POINT
# ===========================================================================

if __name__ == "__main__":
    """
    Run the Flask development server.
    
    This only runs if the script is executed directly (not imported).
    
    PARAMETERS:
        debug=True: Enable auto-reload and detailed error pages (development only)
        host="0.0.0.0": Listen on all network interfaces
        port=5000: Listen on port 5000
    
    NOTE:
        For production, use a proper WSGI server like Gunicorn:
        $ gunicorn -w 4 -b 0.0.0.0:5000 app:app
    
    STARTUP MESSAGE:
        * Running on http://0.0.0.0:5000
        * Debug mode: on
        
    To stop the server:
        - Press Ctrl+C in the terminal
        - Takes a moment to shut down gracefully
    """
    app.run(debug=True, host="0.0.0.0", port=5000)
