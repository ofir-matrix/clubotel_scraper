from fastapi import FastAPI, Response
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi import Query
import os
import subprocess
import pandas as pd
import shutil
import math

app = FastAPI()

BASE_DIR = os.path.dirname(__file__)
CSV_PATH = os.path.join(BASE_DIR, 'lowest_two_prices_per_file.csv')
CSV_OLD_PATH = os.path.join(BASE_DIR, 'lowest_two_prices_per_file_old.csv')
SCRIPT_PATH = os.path.join(BASE_DIR, 'scrape_clubotel.py')
FRONTEND_DIR = os.path.join(BASE_DIR, 'frontend', 'dist')
PROGRESS_FILE = os.path.join(BASE_DIR, 'progress.json')

if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, 'assets')), name="assets")

def json_safe(obj):
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [json_safe(v) for v in obj]
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    return obj

@app.get("/progress")
def get_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                import json
                return JSONResponse(json.load(f))
        except Exception:
            return JSONResponse({"status": "unknown"})
    return JSONResponse({"status": "idle"})

@app.get("/lowest_two_prices")
def get_lowest_two_prices(
    fast: bool = Query(default=True),
    start: str | None = Query(default=None, description="YYYY-MM-DD"),
    end: str | None = Query(default=None, description="YYYY-MM-DD"),
):
    env = os.environ.copy()
    env['PROGRESS_FILE'] = PROGRESS_FILE
    env['FAST_MODE'] = '1' if fast else '0'
    if start:
        env['START_DATE'] = start
    if end:
        env['END_DATE'] = end
    subprocess.run(["python", SCRIPT_PATH], check=True, env=env)
    def file_iterator():
        with open(CSV_PATH, "rb") as f:
            yield from f
        # After sending, rename the file
        if os.path.exists(CSV_PATH):
            shutil.move(CSV_PATH, CSV_OLD_PATH)
    return StreamingResponse(file_iterator(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=lowest_two_prices_per_file.csv"})

@app.get("/lowest_two_prices_json")
def get_lowest_two_prices_json(
    fast: bool = Query(default=True),
    start: str | None = Query(default=None, description="YYYY-MM-DD"),
    end: str | None = Query(default=None, description="YYYY-MM-DD"),
):
    env = os.environ.copy()
    env['PROGRESS_FILE'] = PROGRESS_FILE
    env['FAST_MODE'] = '1' if fast else '0'
    if start:
        env['START_DATE'] = start
    if end:
        env['END_DATE'] = end
    subprocess.run(["python", SCRIPT_PATH], check=True, env=env)
    df = pd.read_csv(CSV_PATH)
    records = df.to_dict(orient="records")
    records = json_safe(records)
    response = JSONResponse(content=records)
    # Rename after sending (may happen before client is done, but is usually fine)
    if os.path.exists(CSV_PATH):
        shutil.move(CSV_PATH, CSV_OLD_PATH)
    return response

@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    if os.path.isdir(FRONTEND_DIR):
        index_path = os.path.join(FRONTEND_DIR, 'index.html')
        if os.path.isfile(index_path):
            return FileResponse(index_path)
    return JSONResponse({"message": "Frontend not built yet."}, status_code=404) 