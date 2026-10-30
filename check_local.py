from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

load_dotenv()

engine = create_engine(os.getenv("DATABASE_URL"))

tables = [
    "users",
    "transactions",
    "alerts",
    "frauds",
    "models",
    "drift_reports",
    "retraining_history"
]

with engine.connect() as conn:
    for table in tables:
        count = conn.execute(
            text(f"SELECT COUNT(*) FROM `{table}`")
        ).scalar()
        print(f"{table}: {count:,}")

engine.dispose()
