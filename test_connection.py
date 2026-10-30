from pathlib import Path
from sqlalchemy import create_engine, text

line = next(
    x for x in Path(".env").read_text(encoding="utf-8-sig").splitlines()
    if x.strip().startswith("DATABASE_URL")
)

url = line.split("=", 1)[1].strip().strip('"').strip("'")
engine = create_engine(url)

with engine.connect() as connection:
    result = connection.execute(text("SELECT 1")).scalar()
    print("Local MySQL connection:", result)
