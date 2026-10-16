"""
Synthetic CSV Data Generator for Retail Intelligence Dashboard
Generates realistic retail data with embedded anomalies for ML detection.
"""
import random
import math
import csv
import os
from datetime import datetime, timedelta

SEED = 42
random.seed(SEED)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")


def ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def rand_date(start: datetime, end: datetime) -> datetime:
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def fmt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def main():
    ensure_dir()
    START = datetime(2024, 1, 1)
    END = datetime(2024, 10, 1)

    # ── 1. PRODUCTS ──────────────────────────────────────────────────────────
    categories = ["Electronics", "Apparel", "Home & Kitchen", "Beauty", "Sports", "Books"]
    products = []
    for i in range(1, 201):
        cat = random.choice(categories)
        base = random.uniform(10, 800)
        products.append({
            "product_id": f"P{i:04d}",
            "name": f"{cat} Item #{i}",
            "category": cat,
            "unit_cost": round(base * 0.55, 2),
            "list_price": round(base, 2),
            "stock_qty": random.randint(0, 500),
            "reorder_point": random.randint(20, 80),
            "supplier_id": f"SUP{random.randint(1, 20):03d}",
        })
    _write("products.csv", products)

    # ── 2. CUSTOMERS ─────────────────────────────────────────────────────────
    segments = ["VIP", "Regular", "At-Risk", "New"]
    customers = []
    for i in range(1, 1001):
        customers.append({
            "customer_id": f"C{i:05d}",
            "name": f"Customer {i}",
            "email": f"customer{i}@example.com",
            "segment": random.choices(segments, weights=[5, 60, 20, 15])[0],
            "region": random.choice(["North", "South", "East", "West", "Central"]),
            "signup_date": fmt(rand_date(datetime(2020, 1, 1), START)),
            "lifetime_value": round(random.uniform(50, 8000), 2),
        })
    _write("customers.csv", customers)

    # ── 3. CAMPAIGNS ─────────────────────────────────────────────────────────
    channels = ["Google Ads", "Meta Ads", "Email", "Influencer", "TV", "SEO"]
    campaigns = []
    for i in range(1, 51):
        start_c = rand_date(START, END - timedelta(days=30))
        end_c = start_c + timedelta(days=random.randint(7, 60))
        budget = round(random.uniform(2000, 50000), 2)
        spend = round(budget * random.uniform(0.5, 1.0), 2)
        impressions = random.randint(5000, 500000)
        clicks = int(impressions * random.uniform(0.01, 0.08))
        conversions = int(clicks * random.uniform(0.02, 0.15))
        # ANOMALY: 3 campaigns have sudden CTR collapse (inject anomaly)
        if i in [7, 23, 41]:
            clicks = int(impressions * 0.002)   # CTR tank
            conversions = int(clicks * 0.01)
        revenue_generated = round(conversions * random.uniform(30, 300), 2)
        campaigns.append({
            "campaign_id": f"CAM{i:04d}",
            "name": f"{random.choice(channels)} Campaign #{i}",
            "channel": random.choice(channels),
            "start_date": fmt(start_c),
            "end_date": fmt(end_c),
            "budget": budget,
            "spend": spend,
            "impressions": impressions,
            "clicks": clicks,
            "conversions": conversions,
            "revenue_generated": revenue_generated,
            "status": random.choice(["active", "active", "active", "paused", "completed"]),
        })
    _write("campaigns.csv", campaigns)

    # ── 4. INVENTORY ─────────────────────────────────────────────────────────
    inventory_rows = []
    for p in products:
        n_snapshots = random.randint(3, 8)
        stock = p["stock_qty"]
        for j in range(n_snapshots):
            snap_date = rand_date(START, END)
            # ANOMALY: random overstock items
            if random.random() < 0.05:
                stock = random.randint(400, 999)
            holding_cost_per_unit = round(p["unit_cost"] * 0.02, 4)
            inventory_rows.append({
                "inventory_id": f"INV{p['product_id'][1:]}{j:02d}",
                "product_id": p["product_id"],
                "snapshot_date": fmt(snap_date),
                "qty_on_hand": stock,
                "qty_reserved": random.randint(0, max(1, stock // 4)),
                "holding_cost_per_unit_daily": holding_cost_per_unit,
                "warehouse": random.choice(["WH-A", "WH-B", "WH-C"]),
            })
            stock = max(0, stock - random.randint(0, 40))
    _write("inventory.csv", inventory_rows)

    # ── 5. TRANSACTIONS ──────────────────────────────────────────────────────
    all_cust = [c["customer_id"] for c in customers]
    all_prod = [(p["product_id"], p["list_price"], p["unit_cost"]) for p in products]
    all_camp = [c["campaign_id"] for c in campaigns]
    transactions = []
    for i in range(1, 8001):
        pid, price, cost = random.choice(all_prod)
        qty = random.randint(1, 5)
        discount = round(random.choice([0, 0, 0, 0.05, 0.1, 0.15, 0.2]), 2)
        # ANOMALY: high-return cluster in Aug (transaction spike + high returns)
        txn_date = rand_date(START, END)
        if i > 7500:  # inject late-period anomaly cluster
            txn_date = rand_date(datetime(2024, 8, 1), datetime(2024, 9, 1))
            discount = 0.3
        gross = round(price * qty, 2)
        net = round(gross * (1 - discount), 2)
        profit = round((price - cost) * qty * (1 - discount), 2)
        status = random.choices(
            ["completed", "completed", "completed", "returned", "cancelled"],
            weights=[70, 0, 0, 20, 10]
        )[0]
        transactions.append({
            "transaction_id": f"T{i:07d}",
            "customer_id": random.choice(all_cust),
            "product_id": pid,
            "campaign_id": random.choice(all_camp) if random.random() < 0.4 else "",
            "transaction_date": fmt(txn_date),
            "quantity": qty,
            "unit_price": price,
            "discount_pct": discount,
            "gross_revenue": gross,
            "net_revenue": net,
            "profit": profit,
            "status": status,
            "return_reason": _return_reason(status),
            "payment_method": random.choice(["Credit Card", "Debit Card", "UPI", "NetBanking", "Wallet"]),
        })
    _write("transactions.csv", transactions)

    print(f"✅ Data written to: {os.path.abspath(DATA_DIR)}")
    print(f"   products.csv     → {len(products)} rows")
    print(f"   customers.csv    → {len(customers)} rows")
    print(f"   campaigns.csv    → {len(campaigns)} rows")
    print(f"   inventory.csv    → {len(inventory_rows)} rows")
    print(f"   transactions.csv → {len(transactions)} rows")


def _return_reason(status: str) -> str:
    if status != "returned":
        return ""
    reasons = [
        "Defective product", "Wrong item shipped", "Changed mind",
        "Better price elsewhere", "Arrived too late", "Not as described",
        "Size/fit issue", "Damaged in transit",
    ]
    return random.choice(reasons)


def _write(filename: str, rows: list[dict]):
    path = os.path.join(DATA_DIR, filename)
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    main()
