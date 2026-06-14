import os
import sys
import time
import signal
from datetime import datetime, timedelta
from flask import Flask, jsonify
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from scheduler import scheduled_job  # Import the job directly
from apscheduler.triggers.interval import IntervalTrigger

app = Flask(__name__)

# Allow frontend origins from env
_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
_frontend = os.getenv("FRONTEND_URL")
if _frontend:
    _origins.append(_frontend)

# Configure CORS with proper settings
CORS(app, resources={
    r"/api/*": {
        "origins": _origins,
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
NEXT_RELOAD_FILE = os.path.join(BASE_DIR, 'next_reload.txt')

def write_next_reload_time(next_time: datetime):
    """Write the next reload time to the file"""
    try:
        with open(NEXT_RELOAD_FILE, 'w') as f:
            f.write(next_time.isoformat())
        print(f"[Scheduler] ✅ Successfully wrote next reload time")
    except Exception as e:
        print(f"[Scheduler] ❌ Error writing reload time: {e}")

def run_scheduler_job():
    """Run the scheduler job"""
    try:
        # Run the job directly
        scheduled_job()
        print("[Scheduler] ✅ Job completed successfully")
        
        # Calculate and store next reload time
        next_time = datetime.now() + timedelta(minutes=5)
        write_next_reload_time(next_time)
        
        return True
    except Exception as e:
        print(f"[Scheduler] ❌ Error running job: {e}")
        return False

@app.route('/api/scheduler/next-reload', methods=['GET'])
def get_next_reload():
    """Get the next scheduled reload time"""
    try:
        if not os.path.exists(NEXT_RELOAD_FILE):
            next_time = datetime.now() + timedelta(minutes=5)
            write_next_reload_time(next_time)
            return next_time.isoformat()
            
        with open(NEXT_RELOAD_FILE, 'r') as f:
            return f.read().strip()
    except Exception as e:
        print(f"[Scheduler] ❌ Error reading next reload time: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/scheduler/trigger', methods=['POST'])
def trigger_scheduler():
    """Trigger the scheduler manually"""
    try:
        if run_scheduler_job():
            return jsonify({'message': 'Scheduler triggered successfully'}), 200
        return jsonify({'error': 'Failed to trigger scheduler'}), 500
    except Exception as e:
        print(f"[Scheduler] ❌ Error triggering scheduler: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Enhanced Test Case Generator Scheduler...")
    
    # Initialize scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(run_scheduler_job, 'interval', minutes=5)
    scheduler.start()
    
    print("✅ Scheduler started and running every 5 minutes")
    print(f"📁 Reload time file: {NEXT_RELOAD_FILE}")
    
    # Run Flask app
    app.run(port=5001) 