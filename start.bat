@echo off
echo ==========================================
echo   RetailIQ - Retail Intelligence Engine
echo ==========================================
echo.
echo [1/4] Generating synthetic data...
uv run python scripts\generate_data.py
echo.
echo [2/4] Ingesting into database...
uv run python scripts\ingest.py
echo.
echo [3/4] Running ML anomaly detection...
uv run python scripts\run_ml.py
echo.
echo [4/4] Starting FastAPI backend on :8000...
start "RetailIQ Backend" uv run uvicorn api:app --host 0.0.0.0 --port 8000 --reload
echo.
echo [5/5] Starting React frontend on :5173...
cd dashboard
start "RetailIQ Frontend" npm run dev
echo.
echo ==========================================
echo  Open: http://localhost:5173
echo  API:  http://localhost:8000/docs
echo ==========================================
pause
