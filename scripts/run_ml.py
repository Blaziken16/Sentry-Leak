"""
ML Engine: Anomaly Detection + Cost-of-Inaction Calculator
Pure numpy/pandas implementation (no scikit-learn/scipy required).
Uses Z-score + IQR-based statistical outlier detection.
Writes detected anomalies to the anomalies table.
"""
import os
import json
import sqlite3
import numpy as np
import pandas as pd
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "retail.db")

# Z-score threshold: values beyond this are flagged as anomalies
Z_THRESHOLD = 2.0


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def zscore(series: pd.Series) -> pd.Series:
    """Compute Z-score; returns 0 where std == 0."""
    std = series.std()
    if std == 0:
        return pd.Series(np.zeros(len(series)), index=series.index)
    return (series - series.mean()) / std


def is_outlier_low(series: pd.Series, threshold: float = Z_THRESHOLD) -> pd.Series:
    """True where value is anomalously LOW (below mean by threshold σ)."""
    return zscore(series) < -threshold


def is_outlier_high(series: pd.Series, threshold: float = Z_THRESHOLD) -> pd.Series:
    """True where value is anomalously HIGH (above mean by threshold σ)."""
    return zscore(series) > threshold


def is_outlier_iqr(series: pd.Series, k: float = 1.5) -> pd.Series:
    """IQR-based outlier detection (catches skewed distributions better)."""
    q1, q3 = series.quantile(0.25), series.quantile(0.75)
    iqr = q3 - q1
    return (series < q1 - k * iqr) | (series > q3 + k * iqr)


def main():
    print("🧠 Running ML Anomaly Engine (numpy/pandas)...")
    if not os.path.exists(DB_PATH):
        print("❌ Database not found. Run `ingest` first.")
        return

    conn = get_conn()
    all_anomalies = []

    all_anomalies += detect_campaign_ctr_anomalies(conn)
    all_anomalies += detect_overstock_anomalies(conn)
    all_anomalies += detect_return_spike_anomalies(conn)
    all_anomalies += detect_revenue_drop_anomalies(conn)
    all_anomalies += detect_discount_abuse_anomalies(conn)

    # Clear old anomalies and write fresh
    conn.execute("DELETE FROM anomalies")
    for a in all_anomalies:
        conn.execute("""
            INSERT INTO anomalies
              (detected_at, anomaly_type, severity, title, description,
               cost_of_inaction, related_id, related_table, evidence, status)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (
            datetime.utcnow().isoformat(),
            a["anomaly_type"], a["severity"], a["title"], a["description"],
            a["cost_of_inaction"], a["related_id"], a["related_table"],
            json.dumps(a["evidence"]), "open"
        ))
    conn.commit()
    conn.close()

    print(f"\n✅ {len(all_anomalies)} anomalies written to database:")
    by_sev: dict[str, int] = {}
    for a in all_anomalies:
        by_sev[a["severity"]] = by_sev.get(a["severity"], 0) + 1
    for sev in ["critical", "high", "medium", "low"]:
        if sev in by_sev:
            print(f"   {sev.upper():8s} → {by_sev[sev]}")


# ── DETECTOR 1: Campaign CTR / ROAS Collapse ──────────────────────────────────
def detect_campaign_ctr_anomalies(conn) -> list:
    df = pd.read_sql_query("""
        SELECT campaign_id, name, channel, budget, spend, impressions,
               clicks, conversions, revenue_generated, status
        FROM campaigns WHERE impressions > 100
    """, conn)
    if df.empty:
        return []

    df["ctr"]  = df["clicks"]       / df["impressions"].replace(0, np.nan)
    df["cvr"]  = df["conversions"]  / df["clicks"].replace(0, np.nan)
    df["roas"] = df["revenue_generated"] / df["spend"].replace(0, np.nan)
    df = df.fillna(0)

    # Flag campaigns that are BOTH low-CTR AND low-ROAS
    low_ctr  = is_outlier_low(df["ctr"],  threshold=1.5)
    low_roas = is_outlier_low(df["roas"], threshold=1.5)
    flagged = df[low_ctr & low_roas & (df["ctr"] < df["ctr"].median())]

    anomalies = []
    for _, row in flagged.iterrows():
        daily_waste = row["spend"] / max(1, 30)
        days_remaining = 14
        cost = round(daily_waste * days_remaining, 2)
        severity = "critical" if cost > 5000 else "high" if cost > 2000 else "medium"

        anomalies.append({
            "anomaly_type": "campaign_ctr_collapse",
            "severity": severity,
            "title": f"CTR Collapse: {row['name']}",
            "description": (
                f"Campaign '{row['name']}' ({row['channel']}) has a CTR of "
                f"{row['ctr']:.2%} — far below normal. "
                f"Current ROAS: {row['roas']:.2f}x. "
                f"Continuing to run wastes budget with zero return."
            ),
            "cost_of_inaction": cost,
            "related_id": row["campaign_id"],
            "related_table": "campaigns",
            "evidence": {
                "ctr": round(float(row["ctr"]), 4),
                "cvr": round(float(row["cvr"]), 4),
                "roas": round(float(row["roas"]), 4),
                "spend": float(row["spend"]),
                "budget": float(row["budget"]),
                "impressions": int(row["impressions"]),
                "clicks": int(row["clicks"]),
                "conversions": int(row["conversions"]),
                "channel": row["channel"],
                "suggested_action": "Pause Campaign",
            },
        })
    return anomalies


# ── DETECTOR 2: Overstock / Dead Inventory ────────────────────────────────────
def detect_overstock_anomalies(conn) -> list:
    df = pd.read_sql_query("""
        SELECT i.product_id, p.name, p.category, p.unit_cost, p.list_price,
               MAX(i.qty_on_hand) as max_stock,
               i.holding_cost_per_unit_daily,
               p.reorder_point
        FROM inventory i
        JOIN products p ON p.product_id = i.product_id
        GROUP BY i.product_id
    """, conn)
    if df.empty:
        return []

    sales_df = pd.read_sql_query("""
        SELECT product_id, SUM(quantity) as total_sold
        FROM transactions WHERE status = 'completed'
        GROUP BY product_id
    """, conn)
    df = df.merge(sales_df, on="product_id", how="left").fillna({"total_sold": 0})

    # Days of supply = stock / daily sales rate
    df["daily_sales"] = df["total_sold"] / 270.0  # ~9 months of data
    df["days_of_stock"] = df.apply(
        lambda r: r["max_stock"] / max(0.01, r["daily_sales"]) if r["daily_sales"] > 0 else 999,
        axis=1
    )

    # High days_of_stock AND high absolute stock
    high_dos   = is_outlier_high(df["days_of_stock"], threshold=1.5)
    high_stock = is_outlier_high(df["max_stock"],     threshold=1.5)
    or_huge_dos = df["days_of_stock"] > 90  # always flag >90 days regardless

    flagged = df[(high_dos | high_stock) & or_huge_dos]

    anomalies = []
    for _, row in flagged.iterrows():
        excess = max(0, row["max_stock"] - row["reorder_point"] * 3)
        daily_holding = float(row["holding_cost_per_unit_daily"]) * excess
        cost = round(daily_holding * 30, 2)
        severity = "critical" if cost > 3000 else "high" if cost > 1000 else "medium"

        anomalies.append({
            "anomaly_type": "overstock_dead_inventory",
            "severity": severity,
            "title": f"Overstock Alert: {row['name']}",
            "description": (
                f"'{row['name']}' ({row['category']}) has {int(row['max_stock'])} units "
                f"with ~{int(row['days_of_stock'])} days of stock remaining. "
                f"Holding costs are accumulating daily."
            ),
            "cost_of_inaction": cost,
            "related_id": row["product_id"],
            "related_table": "products",
            "evidence": {
                "qty_on_hand": int(row["max_stock"]),
                "days_of_stock": round(float(row["days_of_stock"]), 1),
                "daily_holding_cost": round(float(daily_holding), 2),
                "total_sold_ytd": int(row["total_sold"]),
                "unit_cost": float(row["unit_cost"]),
                "list_price": float(row["list_price"]),
                "category": row["category"],
                "suggested_action": "Discount Inventory",
            },
        })
    return anomalies


# ── DETECTOR 3: Return Rate Spike ─────────────────────────────────────────────
def detect_return_spike_anomalies(conn) -> list:
    df = pd.read_sql_query("""
        SELECT product_id,
               COUNT(*) as total_txns,
               SUM(CASE WHEN status='returned' THEN 1 ELSE 0 END) as returns,
               SUM(CASE WHEN status='returned' THEN net_revenue ELSE 0 END) as returned_revenue,
               GROUP_CONCAT(DISTINCT return_reason) as reasons
        FROM transactions
        GROUP BY product_id
        HAVING total_txns >= 5
    """, conn)
    if df.empty:
        return []

    prod_df = pd.read_sql_query(
        "SELECT product_id, name, category, unit_cost FROM products", conn
    )
    df = df.merge(prod_df, on="product_id", how="left")
    df["return_rate"] = df["returns"] / df["total_txns"]

    # Products with return_rate that is IQR-outlier AND above 20%
    flagged = df[is_outlier_iqr(df["return_rate"]) & (df["return_rate"] > 0.20)]

    anomalies = []
    for _, row in flagged.iterrows():
        cost = round(float(row["returned_revenue"]) * 0.15, 2)
        severity = "critical" if row["return_rate"] > 0.4 else "high" if row["return_rate"] > 0.3 else "medium"

        anomalies.append({
            "anomaly_type": "return_rate_spike",
            "severity": severity,
            "title": f"Return Spike: {row['name']}",
            "description": (
                f"'{row['name']}' has a {row['return_rate']:.0%} return rate "
                f"({int(row['returns'])} of {int(row['total_txns'])} orders). "
                f"Top reasons: {row['reasons'] or 'unknown'}."
            ),
            "cost_of_inaction": cost,
            "related_id": row["product_id"],
            "related_table": "products",
            "evidence": {
                "return_rate": round(float(row["return_rate"]), 3),
                "returns": int(row["returns"]),
                "total_transactions": int(row["total_txns"]),
                "returned_revenue": round(float(row["returned_revenue"]), 2),
                "return_reasons": row["reasons"],
                "category": row["category"],
                "suggested_action": "Investigate Quality",
            },
        })
    return anomalies


# ── DETECTOR 4: Revenue Drop (rolling-window time series) ─────────────────────
def detect_revenue_drop_anomalies(conn) -> list:
    df = pd.read_sql_query("""
        SELECT strftime('%Y-%W', transaction_date) as week,
               SUM(net_revenue) as weekly_revenue,
               COUNT(*) as txn_count
        FROM transactions
        WHERE status = 'completed'
        GROUP BY week
        ORDER BY week
    """, conn)
    if len(df) < 4:
        return []

    df["rolling_avg"] = df["weekly_revenue"].rolling(4, min_periods=2).mean().shift(1)
    df["pct_change"]  = (df["weekly_revenue"] - df["rolling_avg"]) / df["rolling_avg"].replace(0, np.nan)
    df = df.dropna(subset=["rolling_avg", "pct_change"])

    # Flag weeks with >25% drop AND the drop is a Z-score outlier
    drops = df[
        (df["pct_change"] < -0.25) &
        (zscore(df["pct_change"]) < -1.5)
    ]

    anomalies = []
    for _, row in drops.iterrows():
        drop_amt = round(float(row["rolling_avg"] - row["weekly_revenue"]), 2)
        cost = round(drop_amt * 4, 2)
        severity = "critical" if abs(row["pct_change"]) > 0.4 else "high"

        anomalies.append({
            "anomaly_type": "revenue_drop",
            "severity": severity,
            "title": f"Revenue Drop: Week {row['week']}",
            "description": (
                f"Week {row['week']} revenue dropped {abs(row['pct_change']):.0%} "
                f"below the 4-week rolling average. "
                f"Expected ${row['rolling_avg']:,.0f}, got ${row['weekly_revenue']:,.0f}."
            ),
            "cost_of_inaction": cost,
            "related_id": row["week"],
            "related_table": "transactions",
            "evidence": {
                "week": row["week"],
                "actual_revenue": round(float(row["weekly_revenue"]), 2),
                "expected_revenue": round(float(row["rolling_avg"]), 2),
                "pct_drop": round(float(row["pct_change"]), 3),
                "transaction_count": int(row["txn_count"]),
                "suggested_action": "Investigate Cause",
            },
        })
    return anomalies


# ── DETECTOR 5: Discount Abuse ────────────────────────────────────────────────
def detect_discount_abuse_anomalies(conn) -> list:
    df = pd.read_sql_query("""
        SELECT customer_id,
               COUNT(*) as txn_count,
               AVG(discount_pct) as avg_discount,
               SUM(gross_revenue - net_revenue) as total_discount_taken,
               SUM(net_revenue) as total_spent
        FROM transactions
        WHERE discount_pct > 0
        GROUP BY customer_id
        HAVING txn_count >= 3
    """, conn)
    if df.empty:
        return []

    cust_df = pd.read_sql_query(
        "SELECT customer_id, name, segment FROM customers", conn
    )
    df = df.merge(cust_df, on="customer_id", how="left")
    df["discount_ratio"] = df["total_discount_taken"] / (
        df["total_spent"] + df["total_discount_taken"]
    ).replace(0, np.nan)
    df = df.fillna(0)

    # Flag IQR outliers in avg_discount who are above the median discount
    high_disc = is_outlier_iqr(df["avg_discount"]) & (df["avg_discount"] > df["avg_discount"].median())
    flagged = df[high_disc & (df["avg_discount"] > 0.20)]

    anomalies = []
    for _, row in flagged.iterrows():
        cost = round(float(row["total_discount_taken"]), 2)
        severity = "high" if cost > 500 else "medium"

        anomalies.append({
            "anomaly_type": "discount_abuse",
            "severity": severity,
            "title": f"Discount Abuse: {row['name']}",
            "description": (
                f"Customer {row['name']} ({row['segment']}) averages "
                f"{row['avg_discount']:.0%} discount across {int(row['txn_count'])} orders, "
                f"costing ${row['total_discount_taken']:,.2f} in foregone revenue."
            ),
            "cost_of_inaction": cost,
            "related_id": row["customer_id"],
            "related_table": "customers",
            "evidence": {
                "avg_discount": round(float(row["avg_discount"]), 3),
                "total_discount_taken": round(float(row["total_discount_taken"]), 2),
                "total_spent": round(float(row["total_spent"]), 2),
                "transaction_count": int(row["txn_count"]),
                "segment": row["segment"],
                "suggested_action": "Review Discount Policy",
            },
        })
    return anomalies


if __name__ == "__main__":
    main()
