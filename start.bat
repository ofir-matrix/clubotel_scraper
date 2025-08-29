@echo off
echo Starting Clubotel Scraper Client...
echo.
echo This will start a local web server on port 8080
echo.
echo Requirements:
echo - Node.js must be installed (version 18 or higher)
echo - Internet connection for initial setup
echo.
echo Press any key to continue...
pause >nul

echo.
echo Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo.
    echo Error: Failed to install dependencies
    echo Please make sure Node.js is installed correctly
    echo.
    pause
    exit /b 1
)

echo.
echo Starting web server...
echo.
echo Your browser will open automatically to http://localhost:8080
echo.
echo To stop the server, press Ctrl+C in this window
echo.

start http://localhost:8080
call npm start

echo.
echo Server stopped.
pause
