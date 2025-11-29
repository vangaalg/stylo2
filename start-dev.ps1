# PowerShell script to start both Vite and API server
Write-Host "=== Starting Development Servers ===" -ForegroundColor Cyan
Write-Host ""

# Start API server in background
Write-Host "Starting API server (port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev:api" -WindowStyle Normal

# Wait a moment for API server to start
Start-Sleep -Seconds 2

# Start Vite server in current terminal
Write-Host "Starting Vite dev server (port 5173)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "API routes available at http://localhost:3001/api/*" -ForegroundColor Green
Write-Host "Frontend will be at http://localhost:5173" -ForegroundColor Green
Write-Host "Face swap will work (no CORS issues)" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop Vite. Close the API server window separately." -ForegroundColor Gray
Write-Host ""

npm run dev
