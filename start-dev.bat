@echo off
echo Starting VANDA Backend Server...
echo.

REM Kill any existing processes on port 9000 and 5001
echo Checking for existing processes on ports 9000 and 5001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9000') do (
    echo Killing process %%a on port 9000...
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001') do (
    echo Killing process %%a on port 5001...
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo Starting server on port 5001...
npm run dev
