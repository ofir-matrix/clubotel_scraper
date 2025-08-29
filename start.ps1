# Clubotel Scraper Client - PowerShell Startup Script
Write-Host "Starting Clubotel Scraper Client..." -ForegroundColor Green
Write-Host ""

Write-Host "This will start a local web server on port 8080" -ForegroundColor Yellow
Write-Host ""

Write-Host "Requirements:" -ForegroundColor Cyan
Write-Host "- Node.js must be installed (version 18 or higher)" -ForegroundColor White
Write-Host "- Internet connection for initial setup" -ForegroundColor White
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    Write-Host "Please make sure Node.js is installed correctly" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting web server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Your browser will open automatically to http://localhost:8080" -ForegroundColor Green
Write-Host ""
Write-Host "To stop the server, press Ctrl+C in this window" -ForegroundColor Yellow
Write-Host ""

# Open browser
Start-Process "http://localhost:8080"

# Start the server
npm start

Write-Host ""
Write-Host "Server stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"
