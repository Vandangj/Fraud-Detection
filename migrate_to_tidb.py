from getpass import getpass
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, URL, text, inspect
import os
import sys

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL was not found in your .env file.")

BATCH_SIZE = 2000

TABLES = [
    ("users", "user_id"),
    ("models", "model_id"),
    ("transactions", "transaction_id"),
    ("frauds", "prediction_id"),
    ("drift_reports", "report_id"),
    ("alerts", "alert_id"),
    ("retraining_history", "history_id"),
]

local_engine = create_engine(DATABASE_URL)

password = getpass("Enter TiDB password: ")

tidb_url = URL.create(
    "mysql+pymysql",
    username="rCUYxFJMUcz86sG.root",
    password=password,
    host="gateway01.ap-southeast-1.prod.aws.tidbcloud.com",
    port=4000,
    database="fraud_detection",
    query={
        "ssl_ca": str(Path("tidb-ca.pem").resolve()),
        "ssl_verify_cert": "true",
        "ssl_verify_identity": "true",
    },
)

tidb_engine = create_engine(
    tidb_url,
    pool_pre_ping=True,
    pool_recycle=1800,
)

try:
    local_inspector = inspect(local_engine)
    tidb_inspector = inspect(tidb_engine)

    print("\nChecking table schemas...")

    for table, primary_key in TABLES:
        local_columns = {
            column["name"]
            for column in local_inspector.get_columns(table)
        }
        tidb_columns = {
            column["name"]
            for column in tidb_inspector.get_columns(table)
        }

        if local_columns != tidb_columns:
            raise RuntimeError(
                f"Column mismatch in {table}. Migration stopped."
            )

        if primary_key not in local_columns:
            raise RuntimeError(
                f"Primary key {primary_key} missing in {table}."
            )

    print("Schema check successful.")

    with tidb_engine.connect() as conn:
        print("\nCurrent TiDB records:")
        for table, _ in TABLES:
            count = conn.execute(
                text(f"SELECT COUNT(*) FROM `{table}`")
            ).scalar()
            print(f"{table}: {count:,}")

    confirmation = input(
        "\nType MIGRATE to start copying all records: "
    )

    if confirmation != "MIGRATE":
        print("Migration cancelled.")
        sys.exit(0)

    with local_engine.connect() as source:
        for table, primary_key in TABLES:
            print(f"\nStarting table: {table}")

            columns = [
                column["name"]
                for column in local_inspector.get_columns(table)
            ]

            quoted_columns = ", ".join(
                f"`{column}`" for column in columns
            )

            placeholders = ", ".join(
                f":{column}" for column in columns
            )

            insert_sql = text(
                f"INSERT INTO `{table}` ({quoted_columns}) "
                f"VALUES ({placeholders}) "
                f"ON DUPLICATE KEY UPDATE "
                f"`{primary_key}` = `{primary_key}`"
            )

            select_sql = text(
                f"SELECT {quoted_columns} FROM `{table}` "
                f"ORDER BY `{primary_key}`"
            )

            streamed_source = source.execution_options(
                stream_results=True,
                max_row_buffer=BATCH_SIZE,
            )

            result = streamed_source.execute(select_sql)
            rows = result.mappings()

            processed = 0

            while True:
                batch = rows.fetchmany(BATCH_SIZE)

                if not batch:
                    break

                try:
                    with tidb_engine.begin() as destination:
                        destination.execute(insert_sql, batch)
                except Exception:
                    print(
                        f"\nERROR while migrating {table} "
                        f"after {processed:,} submitted rows."
                    )
                    raise

                processed += len(batch)

                if processed % 20000 == 0:
                    print(f"  Submitted: {processed:,} rows")

            result.close()

            print(
                f"Finished {table}: "
                f"{processed:,} source rows processed."
            )

    print("\nMigration process completed.")

    print("\nFinal TiDB record counts:")
    with tidb_engine.connect() as conn:
        for table, _ in TABLES:
            count = conn.execute(
                text(f"SELECT COUNT(*) FROM `{table}`")
            ).scalar()
            print(f"{table}: {count:,}")

except Exception as error:
    print("\nMigration stopped:", str(error))
    print(
        "Already committed batches remain in TiDB. "
        "You can safely rerun this script."
    )
    sys.exit(1)

finally:
    local_engine.dispose()
    tidb_engine.dispose()
