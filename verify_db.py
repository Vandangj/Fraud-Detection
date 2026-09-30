from database import SessionLocal
import database_models as db_models

db = SessionLocal()
try:
    print("=" * 80)
    print("DATABASE TABLES SUMMARY & VERIFICATION")
    print("=" * 80)
    print(f"1. users:         {db.query(db_models.User).count():>10,d} rows")
    print(f"2. transactions:  {db.query(db_models.Transaction).count():>10,d} rows")
    print(f"3. models:        {db.query(db_models.Model).count():>10,d} rows")
    print(f"4. frauds:        {db.query(db_models.Fraud_prediction).count():>10,d} rows")
    print(f"5. drift_reports: {db.query(db_models.drift_reports).count():>10,d} rows")
    print("=" * 80)

    print("\n[MODELS TABLE] `SELECT * FROM models;`")
    print("-" * 105)
    print(f"{'model_id':<16} | {'model_name':<32} | {'accuracy':<8} | {'precision':<9} | {'recall':<6} | {'f1':<6} | {'roc_auc':<7} | {'status'}")
    print("-" * 105)
    for m in db.query(db_models.Model).all():
        print(f"{m.model_id:<16} | {m.model_name:<32} | {float(m.model_accuracy):<8.4f} | {float(m.model_precision):<9.4f} | {float(m.model_recall):<6.4f} | {float(m.model_f1_score):<6.4f} | {float(m.model_roc_auc):<7.4f} | {m.model_status}")

    print("\n[FRAUDS TABLE] `SELECT * FROM frauds LIMIT 5;`")
    print("-" * 90)
    print(f"{'prediction_id':<14} | {'tx_id':<8} | {'model_id':<16} | {'Fraud_score':<12} | {'prediction':<10} | {'threshold'}")
    print("-" * 90)
    for f in db.query(db_models.Fraud_prediction).limit(5).all():
        print(f"{f.prediction_id:<14} | {f.transaction_id:<8} | {f.model_id:<16} | {float(f.Fraud_score):<12.4f} | {str(bool(f.prediction)):<10} | {float(f.threshold):<8.2f}")

    print("\n[DRIFT_REPORTS TABLE] `SELECT * FROM drift_reports LIMIT 5;`")
    print("-" * 90)
    print(f"{'report_id':<10} | {'model_id':<16} | {'feature_name':<22} | {'drift_score':<12} | {'drift_status'}")
    print("-" * 90)
    for d in db.query(db_models.drift_reports).limit(5).all():
        print(f"{d.report_id:<10} | {d.model_id:<16} | {d.feature_name:<22} | {float(d.drift_score):<12.4f} | {d.drift_status}")

    print("=" * 80)
finally:
    db.close()
