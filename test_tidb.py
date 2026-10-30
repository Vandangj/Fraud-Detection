from getpass import getpass
from pathlib import Path
from sqlalchemy import create_engine, URL, text

password = getpass("Enter TiDB password: ")

url = URL.create(
    drivername="mysql+pymysql",
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

engine = create_engine(url, pool_pre_ping=True)

try:
    with engine.connect() as connection:
        print("TiDB connection: SUCCESS")
        print("Database:", connection.execute(text("SELECT DATABASE()")).scalar())
finally:
    engine.dispose()
