"""
Main entry point: orchestrate the full pipeline and start the API server.
"""
import os
import sys

def main():
    """Run full pipeline then start API server."""
    from scripts.generate_data import main as gen
    from scripts.ingest import main as ingest
    from scripts.run_ml import main as run_ml
    import uvicorn

    db_path = os.path.join(os.path.dirname(__file__), "data", "retail.db")
    
    if not os.path.exists(db_path):
        print("=" * 60)
        print("  First-time setup: Building database...")
        print("=" * 60)
        gen()
        ingest()
        run_ml()
    else:
        print("✅ Database found. Starting API server...")
        print("   To rebuild: delete data/retail.db and restart.")

    print("\n🚀 Starting Retail Intelligence API at http://localhost:8000")
    print("   Docs: http://localhost:8000/docs\n")
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    main()
