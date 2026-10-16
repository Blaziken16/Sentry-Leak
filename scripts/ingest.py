"""
Data Ingestion: Load CSVs → SQLite database (unified schema)
Handles your own CSV files or the generated synthetic ones.
"""
import os
import sqlite3
import pandas as pd
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data", "raw")
DB_PATH = os.path.join(BASE_DIR, "data", "retail.db")


def get_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def main():
    print("🔄 Starting data ingestion...")
    conn = get_connection()
    _create_schema(conn)

    files = {
        "products": _load_products,
        "customers": _load_customers,
        "campaigns": _load_campaigns,
        "inventory": _load_inventory,
        "transactions": _load_transactions,
    }

    for name, loader in files.items():
        path = os.path.join(DATA_DIR, f"{name}.csv")
        if not os.path.exists(path):
            print(f"  ⚠️  {name}.csv not found — skipping")
            continue
        try:
            df = pd.read_csv(path)
            rows = loader(df, conn)
            print(f"  ✅ {name}.csv → {rows} rows ingested")
        except Exception as e:
            print(f"  ❌ {name}.csv failed: {e}")

    conn.commit()
    conn.close()
    print(f"\n✅ Database ready: {DB_PATH}")


def _create_schema(conn: sqlite3.Connection):
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS products (
        product_id   TEXT PRIMARY KEY,
        name         TEXT,
        category     TEXT,
        unit_cost    REAL,
        list_price   REAL,
        stock_qty    INTEGER,
        reorder_point INTEGER,
        supplier_id  TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
        customer_id    TEXT PRIMARY KEY,
        name           TEXT,
        email          TEXT,
        segment        TEXT,
        region         TEXT,
        signup_date    TEXT,
        lifetime_value REAL
    );

    CREATE TABLE IF NOT EXISTS campaigns (
        campaign_id      TEXT PRIMARY KEY,
        name             TEXT,
        channel          TEXT,
        start_date       TEXT,
        end_date         TEXT,
        budget           REAL,
        spend            REAL,
        impressions      INTEGER,
        clicks           INTEGER,
        conversions      INTEGER,
        revenue_generated REAL,
        status           TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory (
        inventory_id              TEXT PRIMARY KEY,
        product_id                TEXT REFERENCES products(product_id),
        snapshot_date             TEXT,
        qty_on_hand               INTEGER,
        qty_reserved              INTEGER,
        holding_cost_per_unit_daily REAL,
        warehouse                 TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
        transaction_id  TEXT PRIMARY KEY,
        customer_id     TEXT REFERENCES customers(customer_id),
        product_id      TEXT REFERENCES products(product_id),
        campaign_id     TEXT,
        transaction_date TEXT,
        quantity        INTEGER,
        unit_price      REAL,
        discount_pct    REAL,
        gross_revenue   REAL,
        net_revenue     REAL,
        profit          REAL,
        status          TEXT,
        return_reason   TEXT,
        payment_method  TEXT
    );

    CREATE TABLE IF NOT EXISTS anomalies (
        anomaly_id      INTEGER PRIMARY KEY AUTOINCREMENT,
        detected_at     TEXT DEFAULT (datetime('now')),
        anomaly_type    TEXT NOT NULL,
        severity        TEXT NOT NULL,  -- critical / high / medium / low
        title           TEXT NOT NULL,
        description     TEXT,
        cost_of_inaction REAL,
        related_id      TEXT,           -- campaign_id / product_id etc
        related_table   TEXT,
        evidence        TEXT,           -- JSON blob
        status          TEXT DEFAULT 'open',  -- open / investigating / resolved
        resolved_at     TEXT,
        action_taken    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_txn_product ON transactions(product_id);
    CREATE INDEX IF NOT EXISTS idx_txn_campaign ON transactions(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_inv_product ON inventory(product_id);
    CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
    """)
    conn.commit()


def _load_products(df: pd.DataFrame, conn: sqlite3.Connection) -> int:
    cols = ["product_id", "name", "category", "unit_cost", "list_price",
            "stock_qty", "reorder_point", "supplier_id"]
    df = _normalize_cols(df, cols)
    conn.execute("DELETE FROM products")
    df.to_sql("products", conn, if_exists="append", index=False)
    return len(df)


def _load_customers(df: pd.DataFrame, conn: sqlite3.Connection) -> int:
    cols = ["customer_id", "name", "email", "segment", "region",
            "signup_date", "lifetime_value"]
    df = _normalize_cols(df, cols)
    conn.execute("DELETE FROM customers")
    df.to_sql("customers", conn, if_exists="append", index=False)
    return len(df)


def _load_campaigns(df: pd.DataFrame, conn: sqlite3.Connection) -> int:
    cols = ["campaign_id", "name", "channel", "start_date", "end_date",
            "budget", "spend", "impressions", "clicks", "conversions",
            "revenue_generated", "status"]
    df = _normalize_cols(df, cols)
    conn.execute("DELETE FROM campaigns")
    df.to_sql("campaigns", conn, if_exists="append", index=False)
    return len(df)


def _load_inventory(df: pd.DataFrame, conn: sqlite3.Connection) -> int:
    cols = ["inventory_id", "product_id", "snapshot_date", "qty_on_hand",
            "qty_reserved", "holding_cost_per_unit_daily", "warehouse"]
    df = _normalize_cols(df, cols)
    conn.execute("DELETE FROM inventory")
    df.to_sql("inventory", conn, if_exists="append", index=False)
    return len(df)


def _load_transactions(df: pd.DataFrame, conn: sqlite3.Connection) -> int:
    cols = ["transaction_id", "customer_id", "product_id", "campaign_id",
            "transaction_date", "quantity", "unit_price", "discount_pct",
            "gross_revenue", "net_revenue", "profit", "status",
            "return_reason", "payment_method"]
    df = _normalize_cols(df, cols)
    conn.execute("DELETE FROM transactions")
    df.to_sql("transactions", conn, if_exists="append", index=False)
    return len(df)


def _normalize_cols(df: pd.DataFrame, expected: list) -> pd.DataFrame:
    """Add missing columns with None, select only expected."""
    for col in expected:
        if col not in df.columns:
            df[col] = None
    return df[expected]


if __name__ == "__main__":
    main()
