import sys
import os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

from app import create_app

app = create_app()

if __name__ == '__main__':
    print("Starting Flask application...")
    # use_reloader honors FLASK_USE_RELOADER (default on in dev): the dev server
    # then auto-restarts on any .py change, so backend edits take effect without
    # a manual stop/start. Disable it only where a watchdog/supervisor already
    # handles restarts (set FLASK_USE_RELOADER=0).
    use_reloader = os.getenv("FLASK_USE_RELOADER", "1") == "1"
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=use_reloader)