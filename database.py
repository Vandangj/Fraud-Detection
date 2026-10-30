import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")

# Pass SSL certificate if connecting to TiDB Cloud or remote MySQL
connect_args = {}
ca_path = Path(__file__).resolve().parent / "tidb-ca.pem"
if ("localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL) and ca_path.is_file():
    connect_args["ssl"] = {"ca": str(ca_path)}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_size=10,
    max_overflow=20,
    pool_recycle=300,
    pool_timeout=30,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
