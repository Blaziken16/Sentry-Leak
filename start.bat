@echo off
echo ==========================================
echo   RetailIQ - Retail Intelligence Engine
echo ==========================================
echo.
echo [1/2] Starting FastAPI backend on :8000...
start "RetailIQ Backend" uv run python main.py
echo.
echo [2/2] Starting React frontend on :5173...
cd dashboard
start "RetailIQ Frontend" npm run dev
echo.
echo ==========================================
echo  Open: http://localhost:5173
echo  API:  http://localhost:8000/docs
echo ==========================================
pause
