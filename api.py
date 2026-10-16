"""
FastAPI Backend: Retail Intelligence Dashboard API
Serves anomalies, stats, and action endpoints.
"""
import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "retail.db")

app = FastAPI(
    title="Retail Intelligence API",
    description="Cost-of-Inaction Engine + Anomaly Detection Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Database ──────────────────────────────────────────────────────────────────

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def db_exists():
    return os.path.exists(DB_PATH)


# ── Models ────────────────────────────────────────────────────────────────────

class ActionRequest(BaseModel):
    action: str
    notes: Optional[str] = None


class RunPipelineResponse(BaseModel):
    message: str
    anomalies_detected: int
    timestamp: str


class DatasetResponse(BaseModel):
    message: str
    files: dict[str, int]
    anomalies_detected: int
    timestamp: str


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "db_ready": db_exists(), "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/dataset")
def dataset_status():
    """Return row counts for the currently loaded dataset."""
    if not db_exists():
        return {"ready": False, "files": {}}
    tables = ["products", "customers", "campaigns", "inventory", "transactions"]
    with get_db() as conn:
        counts = {
            table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in tables
        }
    return {"ready": any(counts.values()), "files": counts}


@app.post("/api/dataset/upload", response_model=DatasetResponse)
async def upload_dataset(files: list[UploadFile] = File(...)):
    """Replace the active dataset with uploaded CSV files and run the ML scan."""
    import shutil
    import subprocess
    import sys
    from scripts.ingest import DATA_DIR

    allowed = {"products.csv", "customers.csv", "campaigns.csv", "inventory.csv", "transactions.csv"}
    uploads = {}
    for upload in files:
        filename = os.path.basename(upload.filename or "").lower()
        if filename not in allowed:
            raise HTTPException(
                400,
                f"Unsupported file '{upload.filename}'. Upload only: {', '.join(sorted(allowed))}.",
            )
        if filename in uploads:
            raise HTTPException(400, f"Duplicate upload: {filename}")
        uploads[filename] = upload

    if not uploads:
        raise HTTPException(400, "Upload at least one CSV file.")
    required = {"transactions.csv", "products.csv", "customers.csv"}
    missing = sorted(required - uploads.keys())
    if missing:
        raise HTTPException(
            400,
            f"Upload the core files too: {', '.join(missing)}. "
            "campaigns.csv and inventory.csv are optional.",
        )

    os.makedirs(DATA_DIR, exist_ok=True)
    for filename in allowed:
        path = os.path.join(DATA_DIR, filename)
        if filename in uploads:
            try:
                contents = await uploads[filename].read()
                if not contents.strip():
                    raise ValueError("file is empty")
                with open(path, "wb") as destination:
                    destination.write(contents)
            except Exception as exc:
                raise HTTPException(400, f"Could not save {filename}: {exc}") from exc
        elif os.path.exists(path):
            os.remove(path)

    ingest_script = os.path.join(BASE_DIR, "scripts", "ingest.py")
    ml_script = os.path.join(BASE_DIR, "scripts", "run_ml.py")
    try:
        ingest_result = subprocess.run(
            [sys.executable, ingest_script],
            capture_output=True, text=True, timeout=120,
            encoding="utf-8", errors="replace",
            env={**os.environ, "PYTHONUTF8": "1"},
        )
        if ingest_result.returncode != 0:
            raise HTTPException(400, f"Dataset validation failed: {ingest_result.stderr[-2000:]}")
        ml_result = subprocess.run(
            [sys.executable, ml_script],
            capture_output=True, text=True, timeout=120,
            encoding="utf-8", errors="replace",
            env={**os.environ, "PYTHONUTF8": "1"},
        )
        if ml_result.returncode != 0:
            raise HTTPException(500, f"ML pipeline failed: {ml_result.stderr[-2000:]}")
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(504, "Dataset processing timed out.") from exc

    with get_db() as conn:
        counts = {
            name[:-4]: conn.execute(f"SELECT COUNT(*) FROM {name[:-4]}").fetchone()[0]
            for name in allowed
        }
        anomaly_count = conn.execute(
            "SELECT COUNT(*) FROM anomalies WHERE status='open'"
        ).fetchone()[0]

    return DatasetResponse(
        message="Dataset uploaded and model trained successfully",
        files=counts,
        anomalies_detected=anomaly_count,
        timestamp=datetime.utcnow().isoformat(),
    )


# ── Dashboard Stats ───────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats():
    if not db_exists():
        raise HTTPException(503, "Database not ready. Run the pipeline first.")
    with get_db() as conn:
        anomalies = conn.execute("""
            SELECT severity, COUNT(*) as count, SUM(cost_of_inaction) as total_cost
            FROM anomalies WHERE status='open'
            GROUP BY severity
        """).fetchall()

        totals = conn.execute("""
            SELECT COUNT(*) as open_count,
                   SUM(cost_of_inaction) as total_money_at_risk
            FROM anomalies WHERE status='open'
        """).fetchone()

        txn_stats = conn.execute("""
            SELECT COUNT(*) as total_txns,
                   SUM(net_revenue) as total_revenue,
                   AVG(net_revenue) as avg_order_value,
                   SUM(CASE WHEN status='returned' THEN 1 ELSE 0 END) as returns
            FROM transactions
        """).fetchone()

        campaign_stats = conn.execute("""
            SELECT COUNT(*) as total_campaigns,
                   SUM(spend) as total_spend,
                   SUM(conversions) as total_conversions,
                   ROUND(SUM(revenue_generated) / NULLIF(SUM(spend), 0), 2) as avg_roas
            FROM campaigns
        """).fetchone()

        severity_breakdown = {r["severity"]: {"count": r["count"], "total_cost": round(r["total_cost"] or 0, 2)} for r in anomalies}

        return {
            "anomalies": {
                "open_count": totals["open_count"],
                "total_money_at_risk": round(totals["total_money_at_risk"] or 0, 2),
                "by_severity": severity_breakdown,
            },
            "transactions": {
                "total": txn_stats["total_txns"],
                "total_revenue": round(txn_stats["total_revenue"] or 0, 2),
                "avg_order_value": round(txn_stats["avg_order_value"] or 0, 2),
                "return_count": txn_stats["returns"],
            },
            "campaigns": {
                "total": campaign_stats["total_campaigns"],
                "total_spend": round(campaign_stats["total_spend"] or 0, 2),
                "total_conversions": campaign_stats["total_conversions"],
                "avg_roas": campaign_stats["avg_roas"],
            },
        }


# ── Anomalies Feed ────────────────────────────────────────────────────────────

@app.get("/api/anomalies")
def list_anomalies(
    status: Optional[str] = Query(None, description="open|investigating|resolved"),
    severity: Optional[str] = Query(None, description="critical|high|medium|low"),
    anomaly_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    if not db_exists():
        raise HTTPException(503, "Database not ready.")
    
    where_clauses = []
    params = []

    if status:
        where_clauses.append("status = ?")
        params.append(status)
    else:
        where_clauses.append("status != 'resolved'")

    if severity:
        where_clauses.append("severity = ?")
        params.append(severity)

    if anomaly_type:
        where_clauses.append("anomaly_type = ?")
        params.append(anomaly_type)

    where = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""

    with get_db() as conn:
        rows = conn.execute(f"""
            SELECT * FROM anomalies
            {where}
            ORDER BY
                CASE severity
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    ELSE 4
                END,
                cost_of_inaction DESC
            LIMIT ? OFFSET ?
        """, params + [limit, offset]).fetchall()

        total = conn.execute(f"""
            SELECT COUNT(*) FROM anomalies {where}
        """, params).fetchone()[0]

    result = []
    for r in rows:
        item = dict(r)
        if item.get("evidence"):
            try:
                item["evidence"] = json.loads(item["evidence"])
            except Exception:
                pass
        result.append(item)

    return {"total": total, "items": result}


@app.get("/api/anomalies/{anomaly_id}")
def get_anomaly(anomaly_id: int):
    if not db_exists():
        raise HTTPException(503, "Database not ready.")
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM anomalies WHERE anomaly_id = ?", (anomaly_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Anomaly not found")

        item = dict(row)
        if item.get("evidence"):
            try:
                item["evidence"] = json.loads(item["evidence"])
            except Exception:
                pass

        # Enrich with related entity details
        if item["related_table"] == "campaigns":
            rel = conn.execute(
                "SELECT * FROM campaigns WHERE campaign_id=?", (item["related_id"],)
            ).fetchone()
            if rel:
                item["related_entity"] = dict(rel)
        elif item["related_table"] == "products":
            rel = conn.execute(
                "SELECT * FROM products WHERE product_id=?", (item["related_id"],)
            ).fetchone()
            if rel:
                item["related_entity"] = dict(rel)
            # Include recent transactions for this product
            txns = conn.execute("""
                SELECT transaction_id, transaction_date, quantity, net_revenue, status, return_reason
                FROM transactions
                WHERE product_id=?
                ORDER BY transaction_date DESC LIMIT 20
            """, (item["related_id"],)).fetchall()
            item["recent_transactions"] = [dict(t) for t in txns]
        elif item["related_table"] == "customers":
            rel = conn.execute(
                "SELECT * FROM customers WHERE customer_id=?", (item["related_id"],)
            ).fetchone()
            if rel:
                item["related_entity"] = dict(rel)

        return item


# ── Actions ───────────────────────────────────────────────────────────────────

@app.post("/api/anomalies/{anomaly_id}/action")
def take_action(anomaly_id: int, body: ActionRequest):
    if not db_exists():
        raise HTTPException(503, "Database not ready.")
    with get_db() as conn:
        anomaly = conn.execute(
            "SELECT * FROM anomalies WHERE anomaly_id=?", (anomaly_id,)
        ).fetchone()
        if not anomaly:
            raise HTTPException(404, "Anomaly not found")

        conn.execute("""
            UPDATE anomalies
            SET status='resolved', resolved_at=?, action_taken=?
            WHERE anomaly_id=?
        """, (datetime.utcnow().isoformat(), body.action, anomaly_id))

        # Side-effect actions
        action_result = _execute_action(anomaly_id, dict(anomaly), body.action, conn)

    return {
        "success": True,
        "message": f"Action '{body.action}' applied to anomaly #{anomaly_id}",
        "action_result": action_result,
        "resolved_at": datetime.utcnow().isoformat(),
    }


def _execute_action(anomaly_id: int, anomaly: dict, action: str, conn) -> dict:
    """Apply business logic side-effects for each action type."""
    related_id = anomaly.get("related_id")
    related_table = anomaly.get("related_table")

    if action == "Pause Campaign" and related_table == "campaigns":
        conn.execute(
            "UPDATE campaigns SET status='paused' WHERE campaign_id=?",
            (related_id,)
        )
        return {"applied": "Campaign status set to paused", "campaign_id": related_id}

    elif action == "Discount Inventory" and related_table == "products":
        evidence = json.loads(anomaly.get("evidence") or "{}")
        orig_price = evidence.get("list_price", 0)
        new_price = round(orig_price * 0.75, 2)  # 25% markdown
        conn.execute(
            "UPDATE products SET list_price=? WHERE product_id=?",
            (new_price, related_id)
        )
        return {"applied": "Price reduced 25%", "new_price": new_price, "product_id": related_id}

    elif action == "Review Discount Policy" and related_table == "customers":
        return {"applied": "Customer flagged for manual review", "customer_id": related_id}

    elif action == "Investigate Quality":
        return {"applied": "Quality review ticket created", "product_id": related_id}

    return {"applied": action, "note": "Logged"}


# ── Pipeline Trigger ──────────────────────────────────────────────────────────

@app.post("/api/pipeline/run")
def run_pipeline():
    """Re-run ML anomaly detection in the background."""
    import subprocess, sys
    script = os.path.join(BASE_DIR, "scripts", "run_ml.py")
    try:
        result = subprocess.run(
            [sys.executable, script],
            capture_output=True,
            text=True,
            timeout=120,
            encoding="utf-8",
            errors="replace",
            env={**os.environ, "PYTHONUTF8": "1"},
        )
        if result.returncode != 0:
            raise HTTPException(500, f"ML pipeline failed: {result.stderr}")
        
        with get_db() as conn:
            count = conn.execute(
                "SELECT COUNT(*) FROM anomalies WHERE status='open'"
            ).fetchone()[0]

        return RunPipelineResponse(
            message="ML pipeline completed successfully",
            anomalies_detected=count,
            timestamp=datetime.utcnow().isoformat(),
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "ML pipeline timed out")


# ── Summary Charts Data ───────────────────────────────────────────────────────

@app.get("/api/charts/revenue-trend")
def revenue_trend():
    if not db_exists():
        raise HTTPException(503, "Database not ready.")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT strftime('%Y-%m', transaction_date) as month,
                   SUM(net_revenue) as revenue,
                   COUNT(*) as transactions,
                   SUM(CASE WHEN status='returned' THEN 1 ELSE 0 END) as returns
            FROM transactions
            GROUP BY month
            ORDER BY month
        """).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/charts/campaign-performance")
def campaign_performance():
    if not db_exists():
        raise HTTPException(503, "Database not ready.")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT campaign_id, name, channel, spend,
                   ROUND(revenue_generated / NULLIF(spend, 0), 2) as roas,
                   ROUND(CAST(clicks AS REAL) / NULLIF(impressions, 0), 4) as ctr,
                   conversions, status
            FROM campaigns
            ORDER BY roas DESC
        """).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/charts/return-reasons")
def return_reasons():
    if not db_exists():
        raise HTTPException(503, "Database not ready.")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT return_reason, COUNT(*) as count,
                   SUM(net_revenue) as revenue_lost
            FROM transactions
            WHERE status='returned' AND return_reason != ''
            GROUP BY return_reason
            ORDER BY count DESC
        """).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/charts/inventory-health")
def inventory_health():
    if not db_exists():
        raise HTTPException(503, "Database not ready.")
    with get_db() as conn:
        rows = conn.execute("""
            SELECT p.category,
                   COUNT(DISTINCT p.product_id) as products,
                   SUM(i.qty_on_hand) as total_stock,
                   SUM(i.qty_on_hand * p.unit_cost) as stock_value
            FROM products p
            LEFT JOIN (
                SELECT product_id, MAX(qty_on_hand) as qty_on_hand
                FROM inventory GROUP BY product_id
            ) i ON i.product_id = p.product_id
            GROUP BY p.category
        """).fetchall()
    return [dict(r) for r in rows]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
