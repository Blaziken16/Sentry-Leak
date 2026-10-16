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

**Backend (Terminal 1):**
```powershell
uv run python scripts/generate_data.py  # generate CSVs
uv run python scripts/ingest.py          # load into DB
uv run python scripts/run_ml.py          # detect anomalies
uv run uvicorn api:app --reload          # start API
```

**Frontend (Terminal 2):**
```powershell
cd dashboard
npm run dev
```

Then open **http://localhost:5173**

## Using Your Own Data

Drop your CSV files into `data/raw/`. The ingestion script auto-maps columns.
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
- `GET /api/charts/*` — Chart data endpoints
- `GET /docs` — Interactive Swagger UI
