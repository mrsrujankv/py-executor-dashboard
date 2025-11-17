"""
==============================================================================
SAMPLE PYTHON SCRIPT - Task Execution Demo
==============================================================================

PURPOSE:
This is a demonstration script that can be executed by the Flask dashboard.
It shows how output appears in the dashboard logs with timestamps and progress.

FEATURES:
- Prints timestamped messages for each step
- Simulates work with 10-step process
- Shows progress (Step 1/10, 2/10, etc.)
- Includes success message at the end
- Uses sleep() to simulate real work taking time

HOW IT WORKS:
1. Flask app receives HTTP request to execute this script
2. Backend executor spawns this script as subprocess using subprocess.Popen()
3. Every line printed goes to stdout (captured by dashboard)
4. Dashboard reads logs and displays them in the UI
5. Progress percentage calculated from step number

WHY TIMESTAMPS?
Each line shows exact time it was printed, helping users see:
- When the script started
- How long each step took
- Overall execution duration

TESTING THIS SCRIPT:
Run directly from command line:
    python backend/sample_script.py

Expected output:
    [2024-01-15 10:30:45] Starting sample script execution...
    [2024-01-15 10:30:45] [1/10] Initializing application
    [2024-01-15 10:30:46] [2/10] Loading configuration
    ... (continues through all steps)
    [2024-01-15 10:30:55] [10/10] Task completed successfully!

CUSTOMIZING:
To create your own script:
1. Copy this file: cp backend/sample_script.py backend/my_script.py
2. Modify the steps list with your own tasks
3. Add your business logic in the loop
4. Register in app.py execute_script() function
5. Add new option to HTML form's scriptType dropdown
6. Script will be available in dashboard!

IMPORTANT NOTES:
- Use print() for output (goes to dashboard logs)
- Use time.sleep() to simulate work
- Include timestamps with datetime.now()
- Return 0 for success, non-zero for failure
- Avoid interactive input (input() won't work)
- stderr is also captured (use sys.stderr.write() for errors)

==============================================================================
"""

import time
import sys
from datetime import datetime

def main():
    """
    Main function: Simulates a multi-step task execution
    
    WORKFLOW:
    1. Prints start message with timestamp
    2. Iterates through 10 work steps
    3. For each step: prints progress and sleeps 1 second
    4. Prints completion message
    5. Returns exit code 0 (success)
    
    PROGRESS TRACKING:
    The dashboard calculates progress as:
        progress = (current_step / total_steps) * 100
    
    Example: After step 5, progress = (5 / 10) * 100 = 50%
    
    RETURNS:
        int: Exit code (0 = success, non-zero = failure)
    """
    
    # Print header with execution start time
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting sample script execution...")
    
    # Define the work steps - customize this for your own tasks
    steps = [
        "Initializing application",      # Step 1: Setup
        "Loading configuration",          # Step 2: Configuration
        "Connecting to resources",        # Step 3: Connections
        "Processing data - Step 1",       # Step 4: Processing
        "Processing data - Step 2",       # Step 5: Processing
        "Processing data - Step 3",       # Step 6: Processing
        "Validating results",             # Step 7: Validation
        "Generating report",              # Step 8: Report
        "Cleanup and finalization",       # Step 9: Cleanup
        "Task completed successfully!"    # Step 10: Complete
    ]
    
    # Loop through each step
    # enumerate() provides index (0-based) and step description
    # The 'start=1' parameter makes it 1-based (1-10 instead of 0-9)
    for i, step in enumerate(steps, 1):
        # Print progress line with:
        # - Current timestamp
        # - Current step number and total (e.g., "[3/10]")
        # - Step description
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [{i}/{len(steps)}] {step}")
        
        # Simulate work taking 1 second per step
        # This makes the script take ~10 seconds total (good for testing)
        # In real applications, this would be replaced with actual work
        time.sleep(1)
    
    # Print completion summary
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ✓ All steps completed successfully!")
    
    # Return 0 to indicate successful execution
    # Non-zero values indicate errors (e.g., return 1 for failure)
    return 0

# Standard Python idiom: Only run main() if this file is executed directly
# This allows importing this script without automatically running main()
if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
