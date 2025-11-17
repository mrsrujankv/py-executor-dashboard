/**
 * ==============================================================================
 * PYTHON EXECUTOR DASHBOARD - JAVASCRIPT
 * ==============================================================================
 * 
 * This file handles all client-side functionality:
 * - UI interactions (form submission, button clicks)
 * - API communication (fetch requests to Flask backend)
 * - Real-time updates (polling for task progress and logs)
 * - Dynamic content rendering (tables, progress bars, etc.)
 * 
 * ARCHITECTURE:
 * User -> HTML Form -> JavaScript fetch() -> Flask API -> Python Executor
 *    |                                                          |
 *    <--------- JSON Response <- jsonify() <- Python ----------
 *
 * KEY PATTERNS:
 * 1. Form Submission: User fills form -> JavaScript captures data -> sends to API
 * 2. Polling: JavaScript calls API every 1 second to get latest status
 * 3. DOM Updates: Received data updates HTML elements dynamically
 * 4. Event Listeners: User actions trigger JavaScript functions
 * 
 * NO PAGE REFRESH: The entire page is dynamic. No form submission reloads.
 * ==============================================================================
 */

// ==============================================================================
// SECTION 1: CONSTANTS AND GLOBAL VARIABLES
// ==============================================================================
/**
 * API_BASE_URL: Base path for all API calls
 * All API endpoints are relative to this URL
 * Example: /api/tasks becomes http://localhost:5000/api/tasks
 */
const API_BASE_URL = '/api';

/**
 * REFRESH_INTERVAL: How often to poll the API for updates (in milliseconds)
 * 1000ms = 1 second
 * Lower values = more responsive but more server load
 * Higher values = less responsive but less server load
 */
const REFRESH_INTERVAL = 1000; // 1 second

/**
 * currentTaskId: The task ID of the task currently being viewed
 * When user selects a task from history, this is set to that task's ID
 * Used to know which logs and status to display
 */
let currentTaskId = null;

/**
 * autoRefreshInterval: Reference to the setInterval() timer for auto-refresh
 * Stored so we can cancel it with clearInterval() when task completes
 * Prevents wasting resources polling completed tasks
 */
let autoRefreshInterval = null;

// ==============================================================================
// SECTION 2: DOM ELEMENT REFERENCES
// ==============================================================================
/**
 * Cache references to HTML elements for performance.
 * Instead of document.getElementById() every time, we get them once at startup.
 * This is faster since we're not searching the DOM tree repeatedly.
 */

// Form and inputs
const executionForm = document.getElementById('executionForm');  // The form element
const userNameInput = document.getElementById('userName');      // User name input field
const scriptTypeSelect = document.getElementById('scriptType');  // Script dropdown
const executeBtn = document.getElementById('executeBtn');        // Execute button

// Status display elements
const executionStatus = document.getElementById('executionStatus');    // Status container
const statusBadge = document.getElementById('statusBadge');           // Status badge (RUNNING, etc.)
const progressFill = document.getElementById('progressFill');         // Progress bar fill
const progressText = document.getElementById('progressText');         // Progress percentage text

// Task details elements
const taskIdSpan = document.getElementById('taskId');           // Task ID display
const currentStatusSpan = document.getElementById('currentStatus'); // Current status text
const createdAtSpan = document.getElementById('createdAt');     // Creation time
const completedAtSpan = document.getElementById('completedAt'); // Completion time

// Logs display
const logsContent = document.getElementById('logsContent');     // <pre> element for logs

// Task history table
const tasksTableBody = document.getElementById('tasksTableBody'); // Table body for tasks

// Log action buttons
const refreshLogsBtn = document.getElementById('refreshLogsBtn');     // Refresh button
const copyLogsBtn = document.getElementById('copyLogsBtn');           // Copy button
const downloadLogsBtn = document.getElementById('downloadLogsBtn');   // Download button

// Footer update time
const lastUpdateSpan = document.getElementById('lastUpdate');    // Last update timestamp

// ==============================================================================
// SECTION 3: UTILITY FUNCTIONS
// ==============================================================================
/**
 * Utility functions are reusable helper functions used throughout the app.
 * They perform common tasks like formatting dates, showing notifications, etc.
 */

/**
 * Format ISO date string to human-readable format.
 * 
 * JavaScript dates are complex. Users don't understand ISO format like
 * "2024-11-16T10:30:00.123456". This converts to "11/16/2024, 10:30:00 AM"
 * 
 * PARAMETERS:
 *   dateString (string): ISO format date from API (or null/undefined)
 * 
 * RETURNS:
 *   string: Formatted date like "11/16/2024, 10:30:00 AM" or "-" if null
 * 
 * EXAMPLE:
 *   formatDate("2024-11-16T10:30:00") 
 *   // Returns: "11/16/2024, 10:30:00 AM"
 * 
 * WHY toLocaleString()?
 *   Automatically formats date based on user's locale/timezone
 *   US users see "11/16/2024"
 *   European users see "16/11/2024"
 */
function formatDate(dateString) {
    if (!dateString) return '-';  // Return dash if no date provided
    const date = new Date(dateString);  // Parse string into Date object
    return date.toLocaleString();  // Format based on user's locale
}

/**
 * Calculate duration between two timestamps in human-readable format.
 * 
 * Converts seconds into "5m 23s" format so users can easily see how long
 * the task took to complete.
 * 
 * PARAMETERS:
 *   startDate (string): ISO format start time
 *   endDate (string): ISO format end time
 * 
 * RETURNS:
 *   string: Duration like "5m 23s" or "-" if dates not available
 * 
 * EXAMPLE:
 *   formatDuration("2024-11-16T10:30:00", "2024-11-16T10:35:23")
 *   // Returns: "5m 23s"
 * 
 * MATH EXPLANATION:
 *   1. Subtract start date from end date to get milliseconds
 *   2. Divide by 1000 to convert to seconds
 *   3. Extract minutes (divide by 60) and seconds (modulo 60)
 */
function formatDuration(startDate, endDate) {
    if (!startDate || !endDate) return '-';
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = Math.floor((end - start) / 1000);  // Get total seconds
    const minutes = Math.floor(duration / 60);  // Extract minutes
    const seconds = duration % 60;  // Remaining seconds
    return `${minutes}m ${seconds}s`;
}

/**
 * Display a notification toast message to the user.
 * 
 * Shows a popup message in the top-right corner that automatically disappears.
 * Used for success/error messages like "Task started!" or "Error occurred!"
 * 
 * PARAMETERS:
 *   message (string): Text to display in the notification
 *   type (string): Type of notification ('info', 'success', 'error', 'warning')
 *                  Changes the color of the notification
 * 
 * HOW IT WORKS:
 *   1. Creates a new div element dynamically
 *   2. Sets className based on type (determines color)
 *   3. Adds CSS styles if not already added
 *   4. Appends to page body so it appears
 *   5. Waits 4 seconds then removes element
 * 
 * EXAMPLE:
 *   showNotification("Script executed successfully!", "success");
 *   // Shows green notification in corner for 4 seconds
 */
function showNotification(message, type = 'info') {
    // Create the notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add CSS styles once (check if already added)
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;              /* Stay in viewport */
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;                /* Stay on top */
            animation: slideIn 0.3s ease;  /* Animated entrance */
        }
        @keyframes slideIn {
            from {
                transform: translateX(400px);  /* Start off-screen right */
                opacity: 0;                     /* Start invisible */
            }
            to {
                transform: translateX(0);      /* Slide to final position */
                opacity: 1;                     /* Fade in */
            }
        }
        .notification-info {
            background: #3b82f6;    /* Blue */
        }
        .notification-success {
            background: #10b981;    /* Green */
        }
        .notification-error {
            background: #ef4444;    /* Red */
        }
        .notification-warning {
            background: #f59e0b;    /* Orange */
        }
    `;
    
    // Add styles to page once
    document.head.appendChild(style);
    
    // Add notification to page body (appears in top-right)
    document.body.appendChild(notification);
    
    // Remove notification after 4 seconds
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

/**
 * Abbreviate a UUID to show first 8 characters.
 * 
 * UUIDs are long (36 characters). In UI tables, showing full UUIDs wastes space.
 * This shows just the first 8 characters which are usually enough to identify.
 * 
 * EXAMPLE:
 *   abbreviateId("550e8400-e29b-41d4-a716-446655440000")
 *   // Returns: "550e8400..."
 */
function abbreviateId(id) {
    return id ? id.substring(0, 8) + '...' : '-';
}

/**
 * Copy text to clipboard using modern Clipboard API.
 * 
 * When user clicks "Copy Logs" button, this copies the log text to clipboard
 * so they can paste it elsewhere.
 * 
 * PARAMETERS:
 *   text (string): Text to copy to clipboard
 * 
 * ASYNC PATTERN:
 *   Uses async/await pattern. clipboard.writeText() is asynchronous because
 *   it might take a moment. We wait for it with 'await'.
 * 
 * ERROR HANDLING:
 *   If browser doesn't support clipboard API or user denies permission,
 *   we catch the error and show an error notification.
 * 
 * EXAMPLE:
 *   copyToClipboard("Some logs text...");
 *   // Shows "Copied to clipboard!" notification
 */
async function copyToClipboard(text) {
    try {
        // Use Clipboard API to copy text
        await navigator.clipboard.writeText(text);
        showNotification('Copied to clipboard!', 'success');
    } catch (err) {
        showNotification('Failed to copy to clipboard', 'error');
    }
}

/**
 * Trigger browser download of a file.
 * 
 * When user clicks "Download Logs", this creates a virtual file in memory
 * and triggers the browser's download dialog.
 * 
 * PARAMETERS:
 *   content (string): File content as string
 *   filename (string): Name for downloaded file
 * 
 * HOW IT WORKS:
 *   1. Create Blob (binary large object) from content
 *   2. Create URL pointing to blob
 *   3. Create fake <a> link
 *   4. Set href to blob URL and download filename
 *   5. Click the link (triggers download)
 *   6. Clean up: remove link and release blob URL
 * 
 * EXAMPLE:
 *   downloadFile("Log content here...", "task-logs.txt");
 *   // Browser downloads file named "task-logs.txt"
 */
function downloadFile(content, filename) {
    // Create a Blob (binary data) from the content
    const blob = new Blob([content], { type: 'text/plain' });
    
    // Create a temporary URL pointing to the blob
    const url = window.URL.createObjectURL(blob);
    
    // Create a temporary link element
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;  // This triggers download with this filename
    
    // Add link to page (needed for some browsers)
    document.body.appendChild(a);
    
    // Simulate click to trigger download
    a.click();
    
    // Clean up: remove link and release blob URL
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

/**
 * Escape HTML special characters to prevent XSS attacks.
 * 
 * If user name is something like "<script>alert('hack')</script>",
 * we don't want to insert that directly into HTML. This escapes it.
 * 
 * PARAMETERS:
 *   text (string): User-supplied text that might contain < > & " '
 * 
 * RETURNS:
 *   string: Safely escaped HTML
 * 
 * EXAMPLE:
 *   escapeHtml("<b>bold</b>")
 *   // Returns: "&lt;b&gt;bold&lt;/b&gt;"
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;  // textContent automatically escapes
    return div.innerHTML;
}

// ==============================================================================
// SECTION 4: API COMMUNICATION FUNCTIONS
// ==============================================================================
/**
 * These functions handle communication with the Flask backend.
 * Each function makes an HTTP request and returns the JSON response.
 * They all use the modern fetch() API (Promise-based, async/await friendly).
 * 
 * FETCH PATTERN:
 *   fetch(url, options)
 *   .then(response => response.json())  // Parse response
 *   .then(data => { use data })         // Use the data
 *   .catch(error => { handle error })   // Handle errors
 * 
 * ASYNC/AWAIT PATTERN (used in our app):
 *   const response = await fetch(url, options);
 *   const data = await response.json();
 *   return data;
 */

/**
 * Execute a Python script via the API.
 * 
 * This is the main entry point. When user clicks "Execute Script",
 * this function sends the request to the backend.
 * 
 * PARAMETERS:
 *   userName (string): Name of user running the script
 *   scriptType (string): Type of script ("sample", "custom", etc.)
 *   args (array): Command-line arguments for the script
 * 
 * RETURNS:
 *   object: Task object with ID and initial status, or null if error
 * 
 * REQUEST BODY (sent to backend):
 *   {
 *     "user_name": "John",
 *     "script_type": "sample",
 *     "args": []
 *   }
 * 
 * RESPONSE (from backend):
 *   {
 *     "success": true,
 *     "task": { ... task object ... }
 *   }
 * 
 * EXAMPLE:
 *   const task = await executeScript("Alice", "sample", []);
 *   if (task) {
 *     console.log("Task created:", task.id);
 *   }
 */
async function executeScript(userName, scriptType, args) {
    try {
        // Make POST request to /api/execute endpoint
        const response = await fetch(`${API_BASE_URL}/execute`, {
            method: 'POST',  // POST because we're creating a new resource
            headers: {
                'Content-Type': 'application/json'  // Tell server data is JSON
            },
            body: JSON.stringify({
                user_name: userName,
                script_type: scriptType,
                args: args
            })
        });

        // Parse JSON response
        const data = await response.json();

        // Check if backend returned success
        if (!data.success) {
            // Backend returned error message
            showNotification(`Error: ${data.error}`, 'error');
            return null;
        }

        // Return the created task
        return data.task;
    } catch (error) {
        // Network error or JSON parsing error
        showNotification(`Error executing script: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Get details of a specific task by ID.
 * 
 * Used when selecting a task from history or polling for updates.
 * Returns current status, progress, and other task info.
 * 
 * PARAMETERS:
 *   taskId (string): Task ID to retrieve
 * 
 * RETURNS:
 *   object: Task object or null if not found/error
 * 
 * EXAMPLE:
 *   const task = await getTask("550e8400-e29b-...");
 *   console.log(task.status);  // "running", "success", or "failed"
 */
async function getTask(taskId) {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
        const data = await response.json();

        if (!data.success) {
            return null;
        }

        return data.task;
    } catch (error) {
        console.error('Error fetching task:', error);
        return null;
    }
}

/**
 * Get all tasks from the server.
 * 
 * Used to populate the task history table.
 * Returns list of all tasks ever created.
 * 
 * RETURNS:
 *   array: Array of task objects (empty array if error)
 * 
 * EXAMPLE:
 *   const tasks = await getAllTasks();
 *   tasks.forEach(task => {
 *     console.log(task.user_name, task.status);
 *   });
 */
async function getAllTasks() {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks`);
        const data = await response.json();

        if (!data.success) {
            return [];
        }

        return data.tasks;
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return [];
    }
}

/**
 * Get execution logs for a task.
 * 
 * Returns the complete output of the script as a string.
 * Called repeatedly during execution to get streaming logs.
 * 
 * PARAMETERS:
 *   taskId (string): Task ID whose logs to retrieve
 * 
 * RETURNS:
 *   string: Complete log content (empty string if error)
 * 
 * EXAMPLE:
 *   const logs = await getTaskLogs(task.id);
 *   console.log(logs);
 *   // [2024-11-16 10:30:01] Starting...
 *   // [2024-11-16 10:30:02] Step 1...
 */
async function getTaskLogs(taskId) {
    try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/logs`);
        const data = await response.json();

        if (!data.success) {
            return '';
        }

        return data.logs;
    } catch (error) {
        console.error('Error fetching logs:', error);
        return '';
    }
}

// ==============================================================================
// SECTION 5: UI UPDATE FUNCTIONS
// ==============================================================================
/**
 * These functions update the HTML page with data from the API.
 * They take data and render it into the DOM.
 */

/**
 * Update the execution status panel with task information.
 * 
 * When task state changes (status, progress, etc.), call this to update
 * the UI to reflect the current state.
 * 
 * UPDATES:
 *   - Status badge color and text
 *   - Progress bar percentage
 *   - Task ID, status, timestamps
 *   - Execute button state (enabled/disabled)
 * 
 * PARAMETERS:
 *   task (object): Task object from API
 * 
 * EXAMPLE:
 *   const task = await getTask(taskId);
 *   updateExecutionStatus(task);  // UI updates to show "running" status
 */
function updateExecutionStatus(task) {
    if (!task) return;

    // Show the status container (was hidden before task started)
    executionStatus.style.display = 'block';
    
    // Update status badge
    statusBadge.textContent = task.status.toUpperCase();  // "RUNNING", "SUCCESS", etc.
    statusBadge.className = `status-badge ${task.status}`;  // CSS class for color

    // Update progress bar
    progressFill.style.width = `${task.progress}%`;  // Width based on percentage
    progressText.textContent = `${task.progress}%`;  // Show percentage text

    // Update task information
    taskIdSpan.textContent = abbreviateId(task.id);
    currentStatusSpan.textContent = task.status.charAt(0).toUpperCase() + task.status.slice(1);
    createdAtSpan.textContent = formatDate(task.created_at);
    completedAtSpan.textContent = formatDate(task.completed_at);

    // Update execute button state
    if (task.status === 'running') {
        // Disable button while running
        executeBtn.disabled = true;
        executeBtn.innerHTML = '<span class="spinner"></span> Executing...';
    } else {
        // Enable button when done
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<span class="btn-icon">▶</span> Execute Script';
    }
}

/**
 * Update the logs display with current task logs.
 * 
 * Fetches latest logs from API and displays them in the logs container.
 * Automatically scrolls to bottom so user sees latest output.
 * 
 * PARAMETERS:
 *   taskId (string): Task ID whose logs to display
 * 
 * EXAMPLE:
 *   await updateLogs(currentTaskId);  // Shows latest logs
 */
async function updateLogs(taskId) {
    // Fetch latest logs from API
    const logs = await getTaskLogs(taskId);
    
    // Update the logs content
    logsContent.textContent = logs || 'No logs available yet...';
    
    // Scroll to bottom so user sees latest output
    logsContent.scrollTop = logsContent.scrollHeight;
}

/**
 * Update the task history table with list of all tasks.
 * 
 * Renders the task table showing all tasks with their status, progress, etc.
 * Clicking a task row selects it for viewing details.
 * 
 * PARAMETERS:
 *   tasks (array): Array of task objects from API
 * 
 * HTML GENERATION:
 *   Uses template literals to generate HTML dynamically
 *   Each task becomes a <tr> row in the table
 * 
 * EVENT HANDLERS:
 *   onclick="selectTask('...')" attached to each row
 *   onclick="event.stopPropagation()" on buttons to prevent row click
 * 
 * EXAMPLE:
 *   const tasks = await getAllTasks();
 *   updateTaskHistory(tasks);  // Table updates with all tasks
 */
function updateTaskHistory(tasks) {
    if (!tasks || tasks.length === 0) {
        // No tasks yet
        tasksTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No tasks yet. Execute a script to get started!</td>
            </tr>
        `;
        return;
    }

    // Sort tasks by created date (newest first)
    const sortedTasks = tasks.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );

    // Generate HTML for each task
    tasksTableBody.innerHTML = sortedTasks.map(task => `
        <tr onclick="selectTask('${task.id}')">
            <td><span class="task-id-short">${abbreviateId(task.id)}</span></td>
            <td>${escapeHtml(task.user_name)}</td>
            <td><span class="status-cell ${task.status}">${task.status}</span></td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                        <div style="height: 100%; width: ${task.progress}%; background: linear-gradient(90deg, #3b82f6, #8b5cf6);"></div>
                    </div>
                    <span style="min-width: 30px; text-align: right; font-size: 0.85rem;">${task.progress}%</span>
                </div>
            </td>
            <td>${formatDate(task.created_at)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" onclick="selectTask('${task.id}'); event.stopPropagation();" title="View Details">👁️</button>
                    <button class="action-btn" onclick="copyToClipboard('${escapeHtml(task.id)}'); event.stopPropagation();" title="Copy ID">📋</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ==============================================================================
// SECTION 6: TASK MANAGEMENT FUNCTIONS
// ==============================================================================
/**
 * Select a task from history and display its details.
 * 
 * When user clicks a task row, this function:
 * 1. Sets currentTaskId so we know which task is selected
 * 2. Stops previous auto-refresh timer
 * 3. Fetches and displays task status
 * 4. Fetches and displays logs
 * 5. Starts auto-refresh if task is still running
 * 
 * PARAMETERS:
 *   taskId (string): Task ID to select and view
 * 
 * AUTO-REFRESH:
 *   While task is running, this calls getTask() and updateLogs() every
 *   REFRESH_INTERVAL (1 second). When task completes, it stops the timer.
 * 
 * EXAMPLE:
 *   User clicks a task row
 *   -> selectTask('abc123...') called
 *   -> Task details appear
 *   -> If still running, refreshes every second
 */
async function selectTask(taskId) {
    currentTaskId = taskId;
    
    // Stop previous auto-refresh to avoid multiple timers
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    // Fetch and display task details
    const task = await getTask(taskId);
    if (task) {
        updateExecutionStatus(task);  // Update status panel
        await updateLogs(taskId);      // Display logs

        // Start auto-refresh if task is running
        if (task.status === 'running') {
            // Set timer to refresh every REFRESH_INTERVAL ms
            autoRefreshInterval = setInterval(async () => {
                const updatedTask = await getTask(taskId);
                if (updatedTask) {
                    updateExecutionStatus(updatedTask);  // Update status
                    await updateLogs(taskId);             // Update logs

                    // Stop refreshing if task completed
                    if (updatedTask.status !== 'running') {
                        clearInterval(autoRefreshInterval);
                    }
                }
            }, REFRESH_INTERVAL);
        }
    }
}

/**
 * Refresh the task history table.
 * 
 * Fetches all tasks from API and updates the table.
 * Also updates the "last update" timestamp in footer.
 * 
 * Called:
 * - On page load to show existing tasks
 * - Every 5 seconds to update the table
 * - After executing a new script
 * 
 * EXAMPLE:
 *   await refreshTaskHistory();  // Table updates with latest tasks
 */
async function refreshTaskHistory() {
    const tasks = await getAllTasks();
    updateTaskHistory(tasks);
    lastUpdateSpan.textContent = new Date().toLocaleTimeString();
}

// ==============================================================================
// SECTION 7: EVENT LISTENERS
// ==============================================================================
/**
 * Event listeners attach JavaScript functions to HTML element events.
 * When user interacts with the page, these listeners trigger actions.
 */

/**
 * Form submission handler (Execute button click).
 * 
 * FLOW:
 * 1. User fills in name
 * 2. User clicks "Execute Script" button
 * 3. Form submit event fires
 * 4. This listener is called
 * 5. Get form values
 * 6. Validate input
 * 7. Call executeScript() API
 * 8. Start monitoring task
 */
executionForm.addEventListener('submit', async (e) => {
    // Prevent form's default behavior (page reload)
    e.preventDefault();

    // Get form values
    const userName = userNameInput.value.trim();  // Remove whitespace
    const scriptType = scriptTypeSelect.value;
    const argsText = document.getElementById('scriptArgs').value.trim();
    const args = argsText ? argsText.split(/\s+/) : [];  // Split by whitespace

    // Validate inputs
    if (!userName) {
        showNotification('Please enter your name', 'warning');
        return;
    }

    if (!scriptType) {
        showNotification('Please select a script type', 'warning');
        return;
    }

    // Disable button and show loading state
    executeBtn.disabled = true;
    executeBtn.innerHTML = '<span class="spinner"></span> Executing...';
    showNotification('Executing script...', 'info');

    // Call API to execute script
    const task = await executeScript(userName, scriptType, args);

    if (task) {
        // Success! Set current task and update UI
        currentTaskId = task.id;
        updateExecutionStatus(task);
        showNotification('Script execution started!', 'success');

        // Start monitoring the task
        autoRefreshInterval = setInterval(async () => {
            const updatedTask = await getTask(task.id);
            if (updatedTask) {
                updateExecutionStatus(updatedTask);
                await updateLogs(task.id);

                // Refresh history table
                await refreshTaskHistory();

                // Stop monitoring if task completed
                if (updatedTask.status !== 'running') {
                    clearInterval(autoRefreshInterval);
                    showNotification(`Task ${updatedTask.status}!`, 
                        updatedTask.status === 'success' ? 'success' : 'error');
                }
            }
        }, REFRESH_INTERVAL);
    } else {
        // Error occurred, re-enable button
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<span class="btn-icon">▶</span> Execute Script';
    }
});

/**
 * Refresh logs button click handler.
 * 
 * Manually fetch latest logs without waiting for auto-refresh.
 */
refreshLogsBtn.addEventListener('click', async () => {
    if (currentTaskId) {
        await updateLogs(currentTaskId);
        showNotification('Logs refreshed', 'info');
    }
});

/**
 * Copy logs button click handler.
 * 
 * Copy full log content to clipboard.
 */
copyLogsBtn.addEventListener('click', async () => {
    if (currentTaskId) {
        const logs = await getTaskLogs(currentTaskId);
        if (logs) {
            await copyToClipboard(logs);
        }
    }
});

/**
 * Download logs button click handler.
 * 
 * Trigger browser download of logs as text file.
 */
downloadLogsBtn.addEventListener('click', async () => {
    if (currentTaskId) {
        const logs = await getTaskLogs(currentTaskId);
        if (logs) {
            downloadFile(logs, `logs-${currentTaskId.substring(0, 8)}.txt`);
            showNotification('Logs downloaded', 'success');
        }
    }
});

// ==============================================================================
// SECTION 8: PAGE INITIALIZATION
// ==============================================================================
/**
 * initializeDashboard() runs when the page first loads.
 * 
 * SETUP TASKS:
 * 1. Load existing tasks to populate history table
 * 2. Set up periodic refresh (every 5 seconds)
 * 3. Load saved user name from browser storage
 * 4. Save user name when they leave the input field
 * 5. Initialize the footer timestamp
 * 
 * WHY localStorage?
 *   Persists user's name across page reloads/sessions
 *   Better UX - they don't have to re-enter it every time
 */
async function initializeDashboard() {
    // Load initial tasks for the history table
    await refreshTaskHistory();

    // Set up periodic refresh of task history
    // Every 5 seconds, update the task table
    setInterval(refreshTaskHistory, 5000);

    // Load saved user name from browser's localStorage
    const savedUserName = localStorage.getItem('userName');
    if (savedUserName) {
        userNameInput.value = savedUserName;
    }

    // Save user name to localStorage whenever they leave the field
    userNameInput.addEventListener('blur', () => {
        localStorage.setItem('userName', userNameInput.value);
    });

    // Set initial last update time
    lastUpdateSpan.textContent = new Date().toLocaleTimeString();
}

/**
 * DOM loaded event listener.
 * 
 * Don't run JavaScript until the HTML page is fully loaded.
 * This ensures all DOM elements exist before we try to access them.
 * 
 * Without this, document.getElementById() might return null if the
 * element hasn't been parsed yet, causing errors.
 */
document.addEventListener('DOMContentLoaded', initializeDashboard);
