# 🛍️ Sentry-Leak

### Turn retail data into action, before small problems become expensive ones. 🚦

<p align="center">
	<img src="https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white" alt="Python 3.11 or newer">
	<img src="https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=20232A" alt="React frontend">
	<img src="https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI backend">
	<img src="https://img.shields.io/badge/Storage-SQLite-003B57?logo=sqlite&logoColor=white" alt="SQLite storage">
</p>

RetailIQ is a retail operations dashboard that scans transactions, campaigns, and inventory for unusual patterns. It turns those patterns into an evidence-backed alert queue, pairs each alert with a suggested next step, and estimates the **cost of inaction** so teams can prioritize what to investigate.

Instead of making operators hunt through spreadsheets, RetailIQ brings operational signals into one place: campaign performance, excess inventory, product returns, revenue movement, and customer discount patterns.

<div align="center">

📥 **Retail data** &nbsp; → &nbsp; 🔎 **Anomaly scan** &nbsp; → &nbsp; 🚨 **Prioritized alerts** &nbsp; → &nbsp; ✅ **Action and resolution**

</div>

## ✨ What It Does

- 🔎 **Detects five types of operational anomalies** using statistical thresholds and rolling comparisons.
- 🧾 **Explains each alert** with the affected record, supporting evidence, severity, and a suggested action.
- 💸 **Estimates potential inaction cost** to help teams compare and prioritize open alerts. These are heuristic estimates, not guaranteed savings or financial forecasts.
- ✅ **Tracks resolution** with actions and notes, keeping open and resolved work visible.
- 📤 **Supports CSV uploads** so a team can scan its own dataset from the dashboard.
- 📊 **Provides analytics and API access** for exploring the current dataset and results.

## 🔄 How It Works

```text
📄 Retail CSVs → ⚙️ Ingestion + SQLite → 🧠 Statistical scan → ⚡ FastAPI → 🖥️ React dashboard
```

The pipeline normalizes the uploaded CSV data into a local SQLite database. A scan evaluates the five detector types below, writes the results and evidence to the database, and serves them to the dashboard through the FastAPI backend.

| Detector | What it looks for | Suggested response |
|---|---|---|
| 📣 Campaign performance | Campaigns with unusually low click-through rate and return on ad spend | Pause campaign |
| 📦 Overstock | High stock levels with more than 90 days of supply | Discount inventory |
| ↩️ Return rate | Products with unusually high return rates | Investigate quality |
| 📉 Revenue drop | Weekly revenue falling more than 25% below its recent rolling average | Investigate cause |
| 🏷️ Discount patterns | Customers with unusually high average discounts | Review discount policy |

The detection engine uses Z-scores, interquartile range (IQR) outlier checks, and rolling averages, implemented with pandas and NumPy. It does **not** use Isolation Forest or train a predictive model. The inaction-cost figures are estimates derived from the relevant operational metrics and detector-specific assumptions.

## 🖥️ Dashboard

The React dashboard organizes the workflow into:

- 🚨 **Alert Feed:** Review and prioritize active findings.
- 📊 **Analytics:** Explore operational metrics and chart views.
- ✅ **Resolved:** Revisit alerts that have been actioned.
- 🗂️ **Dataset & Model:** Inspect loaded row counts, upload CSVs, and rerun the scan.
- <img width="948" height="500" alt="Screenshot 2026-10-16 162154" src="https://github.com/user-attachments/assets/90c5215a-ed14-4044-949c-25c17f210f0c" />
- <img width="940" height="503" alt="Screenshot 2026-10-16 162216" src="https://github.com/user-attachments/assets/09151862-696f-4f91-9232-d0e69fe9957c" />


## 🚀 Quick Start

### 🧰 Requirements

- Python 3.11 or newer
- [uv](https://docs.astral.sh/uv/) for Python dependency management
- Node.js and npm for the dashboard

### 🪟 Windows one-click start

Run `start.bat` from the project directory. It starts the backend and dashboard in separate windows.

### 💻 Manual start

In the project root, start the backend:

```powershell
uv run python main.py
```

In a second terminal, start the dashboard:

```powershell
cd dashboard
npm install
npm run dev
```

Open **http://localhost:5173**. The API runs at **http://localhost:8000**; its interactive documentation is at **http://localhost:8000/docs**.

On first startup, if `data/retail.db` does not exist, RetailIQ generates synthetic demo data, ingests it, and runs a scan. Later startups reuse the existing database. To rebuild from generated demo data, remove `data/retail.db` before starting again.

## 📂 Use Your Own Data

From **Dataset & Model** in the dashboard, upload the required CSVs. Uploading replaces the active dataset, ingests the files, and immediately runs a new scan. Alternatively, put CSVs in `data/raw/` and run the scripts manually:

```powershell
uv run python scripts/ingest.py
uv run python scripts/run_ml.py
```

Upload `transactions.csv`, `products.csv`, and `customers.csv`. `campaigns.csv` and `inventory.csv` are optional. Column names are case-insensitive; non-ID columns that are absent are loaded as empty values.

| File | Required columns |
|---|---|
| `transactions.csv` | `transaction_id`, `customer_id`, `product_id`, `net_revenue`, `status` |
| `products.csv` | `product_id`, `name`, `category`, `unit_cost`, `list_price` |
| `customers.csv` | `customer_id`, `segment` |
| `campaigns.csv` (optional) | `campaign_id`, `impressions`, `clicks`, `conversions`, `spend` |
| `inventory.csv` (optional) | `inventory_id`, `product_id`, `qty_on_hand` |

## 🔌 API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/anomalies` | Retrieve the alert feed |
| `GET` | `/api/anomalies/{id}` | Retrieve alert details and evidence |
| `POST` | `/api/anomalies/{id}/action` | Record an action on an alert |
| `GET` | `/api/stats` | Retrieve dashboard KPIs |
| `POST` | `/api/pipeline/run` | Run the anomaly scan again |
| `GET` | `/api/dataset` | Get active dataset row counts |
| `POST` | `/api/dataset/upload` | Replace the dataset, ingest files, and scan |
| `GET` | `/api/charts/*` | Retrieve chart data |
| `GET` | `/health` | Check API and database readiness |
| `GET` | `/docs` | Open interactive API documentation |

## 🧱 Tech Stack

- **Frontend:** React, Vite, Recharts, Framer Motion
- **Backend:** Python, FastAPI, Uvicorn
- **Data and detection:** pandas, NumPy, SQLite

## 🗺️ Repository Structure

```text
Sentry-Leak/
├── api.py                 # FastAPI routes and database access
├── main.py                # First-run setup and API startup
├── scripts/
│   ├── generate_data.py   # Reproducible synthetic retail data
│   ├── ingest.py          # CSV-to-SQLite ingestion
│   └── run_ml.py          # Five statistical anomaly detectors
├── dashboard/             # React + Vite application
└── start.bat              # Windows startup helper
```
