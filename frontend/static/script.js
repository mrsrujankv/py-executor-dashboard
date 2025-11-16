/**
 * Python Executor Dashboard - JavaScript
 * Handles UI interactions, API calls, and real-time updates
 */

// ========================================
// Constants
// ========================================
const API_BASE_URL = '/api';
const REFRESH_INTERVAL = 1000; // 1 second
let currentTaskId = null;
let autoRefreshInterval = null;

// ========================================
// DOM Elements
// ========================================
const executionForm = document.getElementById('executionForm');
const userNameInput = document.getElementById('userName');
const scriptTypeSelect = document.getElementById('scriptType');
const executeBtn = document.getElementById('executeBtn');
const executionStatus = document.getElementById('executionStatus');
const statusBadge = document.getElementById('statusBadge');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const taskIdSpan = document.getElementById('taskId');
const currentStatusSpan = document.getElementById('currentStatus');
const createdAtSpan = document.getElementById('createdAt');
const completedAtSpan = document.getElementById('completedAt');
const logsContent = document.getElementById('logsContent');
const tasksTableBody = document.getElementById('tasksTableBody');
const refreshLogsBtn = document.getElementById('refreshLogsBtn');
const copyLogsBtn = document.getElementById('copyLogsBtn');
const downloadLogsBtn = document.getElementById('downloadLogsBtn');
const lastUpdateSpan = document.getElementById('lastUpdate');

// ========================================
// Utilities
// ========================================

/**
 * Format date to readable string
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString();
}

/**
 * Format ISO duration
 */
function formatDuration(startDate, endDate) {
    if (!startDate || !endDate) return '-';
    const start = new Date(startDate);
    const end = new Date(endDate);
    const duration = Math.floor((end - start) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}m ${seconds}s`;
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        .notification-info {
            background: #3b82f6;
        }
        .notification-success {
            background: #10b981;
        }
        .notification-error {
            background: #ef4444;
        }
        .notification-warning {
            background: #f59e0b;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

/**
 * Abbreviate UUID
 */
function abbreviateId(id) {
    return id ? id.substring(0, 8) + '...' : '-';
}

/**
 * Copy to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Copied to clipboard!', 'success');
    } catch (err) {
        showNotification('Failed to copy to clipboard', 'error');
    }
}

/**
 * Download file
 */
function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// ========================================
// API Functions
// ========================================

/**
 * Execute script via API
 */
async function executeScript(userName, scriptType, args) {
    try {
        const response = await fetch(`${API_BASE_URL}/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_name: userName,
                script_type: scriptType,
                args: args
            })
        });

        const data = await response.json();

        if (!data.success) {
            showNotification(`Error: ${data.error}`, 'error');
            return null;
        }

        return data.task;
    } catch (error) {
        showNotification(`Error executing script: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Get task details
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
 * Get all tasks
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
 * Get task logs
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

// ========================================
// UI Update Functions
// ========================================

/**
 * Update execution status display
 */
function updateExecutionStatus(task) {
    if (!task) return;

    executionStatus.style.display = 'block';
    
    // Update badge
    statusBadge.textContent = task.status.toUpperCase();
    statusBadge.className = `status-badge ${task.status}`;

    // Update progress
    progressFill.style.width = `${task.progress}%`;
    progressText.textContent = `${task.progress}%`;

    // Update info
    taskIdSpan.textContent = abbreviateId(task.id);
    currentStatusSpan.textContent = task.status.charAt(0).toUpperCase() + task.status.slice(1);
    createdAtSpan.textContent = formatDate(task.created_at);
    completedAtSpan.textContent = formatDate(task.completed_at);

    // Enable/disable execute button based on status
    if (task.status === 'running') {
        executeBtn.disabled = true;
        executeBtn.innerHTML = '<span class="spinner"></span> Executing...';
    } else {
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<span class="btn-icon">▶</span> Execute Script';
    }
}

/**
 * Update logs display
 */
async function updateLogs(taskId) {
    const logs = await getTaskLogs(taskId);
    logsContent.textContent = logs || 'No logs available yet...';
    logsContent.scrollTop = logsContent.scrollHeight;
}

/**
 * Update task history table
 */
function updateTaskHistory(tasks) {
    if (!tasks || tasks.length === 0) {
        tasksTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No tasks yet. Execute a script to get started!</td>
            </tr>
        `;
        return;
    }

    // Sort tasks by created_at descending
    const sortedTasks = tasks.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );

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

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// Task Management
// ========================================

/**
 * Select a task and display details
 */
async function selectTask(taskId) {
    currentTaskId = taskId;
    
    // Stop previous auto-refresh
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }

    // Fetch and display task
    const task = await getTask(taskId);
    if (task) {
        updateExecutionStatus(task);
        await updateLogs(taskId);

        // Start auto-refresh if task is running
        if (task.status === 'running') {
            autoRefreshInterval = setInterval(async () => {
                const updatedTask = await getTask(taskId);
                if (updatedTask) {
                    updateExecutionStatus(updatedTask);
                    await updateLogs(taskId);

                    // Stop if task completed
                    if (updatedTask.status !== 'running') {
                        clearInterval(autoRefreshInterval);
                    }
                }
            }, REFRESH_INTERVAL);
        }
    }
}

/**
 * Refresh task history and update last update time
 */
async function refreshTaskHistory() {
    const tasks = await getAllTasks();
    updateTaskHistory(tasks);
    lastUpdateSpan.textContent = new Date().toLocaleTimeString();
}

// ========================================
// Event Listeners
// ========================================

/**
 * Handle form submission
 */
executionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userName = userNameInput.value.trim();
    const scriptType = scriptTypeSelect.value;
    const argsText = document.getElementById('scriptArgs').value.trim();
    const args = argsText ? argsText.split(/\s+/) : [];

    if (!userName) {
        showNotification('Please enter your name', 'warning');
        return;
    }

    if (!scriptType) {
        showNotification('Please select a script type', 'warning');
        return;
    }

    executeBtn.disabled = true;
    executeBtn.innerHTML = '<span class="spinner"></span> Executing...';
    showNotification('Executing script...', 'info');

    const task = await executeScript(userName, scriptType, args);

    if (task) {
        currentTaskId = task.id;
        updateExecutionStatus(task);
        showNotification('Script execution started!', 'success');

        // Start monitoring the task
        autoRefreshInterval = setInterval(async () => {
            const updatedTask = await getTask(task.id);
            if (updatedTask) {
                updateExecutionStatus(updatedTask);
                await updateLogs(task.id);

                // Refresh history
                await refreshTaskHistory();

                // Stop if task completed
                if (updatedTask.status !== 'running') {
                    clearInterval(autoRefreshInterval);
                    showNotification(`Task ${updatedTask.status}!`, 
                        updatedTask.status === 'success' ? 'success' : 'error');
                }
            }
        }, REFRESH_INTERVAL);
    } else {
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<span class="btn-icon">▶</span> Execute Script';
    }
});

/**
 * Refresh logs
 */
refreshLogsBtn.addEventListener('click', async () => {
    if (currentTaskId) {
        await updateLogs(currentTaskId);
        showNotification('Logs refreshed', 'info');
    }
});

/**
 * Copy logs
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
 * Download logs
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

// ========================================
// Initialization
// ========================================

/**
 * Initialize dashboard
 */
async function initializeDashboard() {
    // Load initial tasks
    await refreshTaskHistory();

    // Set up periodic refresh
    setInterval(refreshTaskHistory, 5000);

    // Load user name from localStorage if available
    const savedUserName = localStorage.getItem('userName');
    if (savedUserName) {
        userNameInput.value = savedUserName;
    }

    // Save user name to localStorage
    userNameInput.addEventListener('blur', () => {
        localStorage.setItem('userName', userNameInput.value);
    });

    // Set initial last update time
    lastUpdateSpan.textContent = new Date().toLocaleTimeString();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeDashboard);
