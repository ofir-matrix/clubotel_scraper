# Use official Python image
FROM python:3.11-slim

# Set work directory
WORKDIR /app

# Install system dependencies including Xvfb for headed browser
RUN apt-get update && \
    apt-get install -y wget gnupg xvfb && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN pip install playwright && playwright install --with-deps

# Copy the rest of the code
COPY scrape_clubotel.py ./
COPY serve_csv.py ./
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Set the entrypoint to run the FastAPI server with Xvfb for headed browser
ENTRYPOINT ["/start.sh"] 