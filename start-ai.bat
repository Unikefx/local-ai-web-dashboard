@echo off
title Local Ollama Web AI Launcher
cd /d "%~dp0"

echo ==========================================
echo       LOCAL OLLAMA WEB AI LAUNCHER
echo ==========================================
echo.
echo Starting Local AI application...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\start-ai.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Script failed or was stopped.
    pause
)
