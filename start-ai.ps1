# Local Ollama Web AI Launcher
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "       LOCAL OLLAMA WEB AI LAUNCHER       " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Ollama CLI is installed
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    Write-Host "[x] Error: 'ollama' command was not found in PATH." -ForegroundColor Red
    Write-Host "Please install Ollama from https://ollama.com and restart." -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit
}

# Check if Ollama service is running
Write-Host "[*] Checking local Ollama service (127.0.0.1:11434)..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 3
    Write-Host "[OK] Ollama service is active and responding." -ForegroundColor Green
} catch {
    Write-Host "[!] Ollama is not running. Starting 'ollama serve'..." -ForegroundColor Yellow
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# Check Node.js dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "[*] First run detected. Installing Node dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "[+] Launching Local AI Server at http://localhost:3000..." -ForegroundColor Green
Write-Host "[i] Press Ctrl+C in this window to stop the server." -ForegroundColor Gray
Write-Host ""

# Automatically open default browser after a brief pause
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:3000"
} | Out-Null

npm start