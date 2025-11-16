"""
Sample Python script demonstrating task execution
This script can be called from the Flask app
"""

import time
import sys
from datetime import datetime

def main():
    """Sample task that performs some work"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting sample script execution...")
    
    # Simulate work with multiple steps
    steps = [
        "Initializing application",
        "Loading configuration",
        "Connecting to resources",
        "Processing data - Step 1",
        "Processing data - Step 2",
        "Processing data - Step 3",
        "Validating results",
        "Generating report",
        "Cleanup and finalization",
        "Task completed successfully!"
    ]
    
    for i, step in enumerate(steps, 1):
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [{i}/{len(steps)}] {step}")
        time.sleep(1)  # Simulate work
    
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ✓ All steps completed successfully!")
    return 0

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
