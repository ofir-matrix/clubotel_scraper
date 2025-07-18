from fastapi import FastAPI, Response
from fastapi.responses import StreamingResponse, JSONResponse
import os
import subprocess
import pandas as pd
import shutil

app = FastAPI()

CSV_PATH = os.path.join(os.path.dirname(__file__), 'lowest_two_prices_per_file.csv')
CSV_OLD_PATH = os.path.join(os.path.dirname(__file__), 'lowest_two_prices_per_file_old.csv')
SCRIPT_PATH = os.path.join(os.path.dirname(__file__), 'scrape_clubotel.py')

@app.get("/lowest_two_prices")
def get_lowest_two_prices():
    subprocess.run(["python", SCRIPT_PATH], check=True)
    def file_iterator():
        with open(CSV_PATH, "rb") as f:
            yield from f
        # After sending, rename the file
        if os.path.exists(CSV_PATH):
            shutil.move(CSV_PATH, CSV_OLD_PATH)
    return StreamingResponse(file_iterator(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=lowest_two_prices_per_file.csv"})

@app.get("/lowest_two_prices_json")
def get_lowest_two_prices_json():
    subprocess.run(["python", SCRIPT_PATH], check=True)
    df = pd.read_csv(CSV_PATH)
    response = JSONResponse(content=df.to_dict(orient="records"))
    # Rename after sending (may happen before client is done, but is usually fine)
    if os.path.exists(CSV_PATH):
        shutil.move(CSV_PATH, CSV_OLD_PATH)
    return response 