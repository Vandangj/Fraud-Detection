import requests, json

r = requests.get("http://127.0.0.1:8000/openapi.json")
data = r.json()
paths = list(data["paths"].keys())
print("=== Registered Routes ===")
for p in sorted(paths):
    print(p)

print("\n=== Test key endpoints ===")
tests = [
    "/transactions/summary",
    "/transactions/",
    "/models/",
    "/models/comparison",
    "/retrain/history",
    "/drift-reports/",
]
for endpoint in tests:
    resp = requests.get(f"http://127.0.0.1:8000{endpoint}")
    preview = resp.text[:120].replace("\n", " ")
    print(f"  {resp.status_code}  {endpoint}  -- {preview}")
