from fastapi import FastAPI, Response
from fastapi.responses import FileResponse
import os
import subprocess

app = FastAPI()

CSV_PATH = os.path.join(os.path.dirname(__file__), 'lowest_two_prices_per_file.csv')
SCRIPT_PATH = os.path.join(os.path.dirname(__file__), 'scrape_clubotel.py')

@app.get("/lowest_two_prices")
def get_lowest_two_prices():
    # Run the scraper script before returning the CSV
    subprocess.run(["python", SCRIPT_PATH], check=True)
    return FileResponse(CSV_PATH, media_type='text/csv', filename='lowest_two_prices_per_file.csv') 