# RetailIQ — Retail Intelligence Dashboard

An AI-powered anomaly detection and **Cost of Inaction** dashboard for retail operations.

## Architecture

```
datathon2026/
├── scripts/
│   ├── generate_data.py   # Synthetic CSV generator (200 products, 1000 customers, 8000 txns)
│   ├── ingest.py          # CSV → SQLite ingestion with unified schema
│   └── run_ml.py          # Isolation Forest ML engine (5 anomaly detectors)
├── api.py                 # FastAPI backend + REST endpoints
├── data/
│   ├── raw/               # CSV files (generated or your own)
│   └── retail.db          # Unified SQLite database
├── dashboard/             # React + Vite frontend
│   └── src/
│       ├── components/    # AlertFeed, SidePanel, ChartsPage, ...
│       ├── hooks.js        # Data fetching hooks + mock fallbacks
│       ├── api.js          # API client
│       └── utils.js        # Formatters, toast, action hooks
└── start.bat              # One-click startup (Windows)
```

## Quick Start

### Option 1: One-Click (Windows)
```
double-click start.bat
```

### Option 2: Manual

**Backend (Terminal 1):** The first run creates the demo dataset only when no database exists. Later starts preserve the active dataset.
```powershell
uv run python main.py
```

**Frontend (Terminal 2):**
```powershell
cd dashboard
npm run dev
```

Then open **http://localhost:5173**

## Using Your Own Data

Use the **Dataset & Model** page in the dashboard to upload your CSV files. Uploading replaces the active dataset, ingests it, and runs the anomaly model immediately. You can also place the files in `data/raw/` and run the pipeline manually.

The upload requires `transactions.csv`, `products.csv`, and `customers.csv`. `campaigns.csv` and `inventory.csv` are optional. Column names are case-insensitive; missing non-ID columns are loaded as empty values.
Expected schemas:

| File | Required Columns |
|------|-----------------|
| `transactions.csv` | transaction_id, customer_id, product_id, net_revenue, status |
| `customers.csv` | customer_id, segment |
| `campaigns.csv` | campaign_id, impressions, clicks, conversions, spend |
| `inventory.csv` | inventory_id, product_id, qty_on_hand |
| `products.csv` | product_id, name, category, unit_cost, list_price |

## ML Detectors

| Detector | Method | Action |
|----------|--------|--------|
| Campaign CTR Collapse | Isolation Forest on CTR/CVR/ROAS | Pause Campaign |
| Overstock / Dead Inventory | Isolation Forest on stock × days-of-supply | Discount Inventory |
| Return Rate Spike | Isolation Forest on return rate | Investigate Quality |
| Revenue Drop | Rolling average window comparison | Investigate Cause |
| Discount Abuse | Isolation Forest on avg discount | Review Policy |

## API Endpoints

- `GET /api/anomalies` — Sorted alert feed
- `GET /api/anomalies/{id}` — Detail + evidence
- `POST /api/anomalies/{id}/action` — 1-click resolution
- `GET /api/stats` — Dashboard KPIs
- `POST /api/pipeline/run` — Re-run ML scan
- `GET /api/dataset` — Active dataset row counts
- `POST /api/dataset/upload` — Replace dataset, ingest CSVs, and run ML
- `GET /api/charts/*` — Chart data endpoints
- `GET /docs` — Interactive Swagger UI
