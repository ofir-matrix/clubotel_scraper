# Use Ubuntu-based Python image for better Playwright compatibility
FROM python:3.11-slim-bullseye

# Set work directory
WORKDIR /app

# Install system dependencies including Xvfb and Node.js (via apt)
RUN apt-get update \
    && apt-get install -y \
        wget \
        gnupg \
        curl \
        ca-certificates \
        xvfb \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libxss1 \
        libxtst6 \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN pip install playwright \
    && playwright install --with-deps

# Install Node.js (LTS) via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && npm -v \
    && node -v \
    && rm -rf /var/lib/apt/lists/*

# Build frontend
COPY frontend ./frontend
RUN cd frontend \
    && npm ci || npm install \
    && npm run build

# Copy the rest of the code
COPY scrape_clubotel.py ./
COPY serve_csv.py ./
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Set the entrypoint to run the FastAPI server with Xvfb for headed browser
ENTRYPOINT ["/start.sh"] 