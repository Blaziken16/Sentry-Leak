#!/bin/bash
# Quick start script for the full project
echo "📦 Installing Python dependencies..."
cd /d %~dp0
uv sync

echo "🎲 Generating synthetic data..."
uv run python scripts/generate_data.py

echo "🗄️  Ingesting into database..."
uv run python scripts/ingest.py

echo "🧠 Running ML anomaly detection..."
uv run python scripts/run_ml.py

echo "✅ Backend ready. Starting API on http://localhost:8000"
uv run uvicorn api:app --host 0.0.0.0 --port 8000 --reload
