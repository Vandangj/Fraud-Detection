import os
import sys
import random
from datetime import datetime, timedelta
import pandas as pd
import joblib

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from database import SessionLocal
import database_models as db_models

def populate():
    db = SessionLocal()
    try:
        print("[Populate] Checking existing records...")
        frauds_count = db.query(db_models.Fraud_prediction).count()
        drift_count = db.query(db_models.drift_reports).count()
        print(f"Current Frauds: {frauds_count}, Drift Reports: {drift_count}")

        # Ensure models exist
        models = db.query(db_models.Model).all()
        model_ids = [m.model_id for m in models]
        if not model_ids:
            print("[Error] No models found in database.")
            return

        print(f"[Populate] Available models: {model_ids}")

        # ------------------------------------------------------------------
        # 1. POPULATE FRAUDS TABLE
        # ------------------------------------------------------------------
        # Fetch fraud transactions (limit 250) and normal transactions (limit 250)
        print("[Populate] Fetching sample transactions for fraud prediction records...")
        fraud_txs = (
            db.query(db_models.Transaction)
            .filter(db_models.Transaction.is_fraud == True)
            .limit(250)
            .all()
        )
        normal_txs = (
            db.query(db_models.Transaction)
            .filter(db_models.Transaction.is_fraud == False)
            .limit(250)
            .all()
        )

        all_txs = fraud_txs + normal_txs
        random.shuffle(all_txs)
        print(f"[Populate] Scoring {len(all_txs)} transactions across models...")

        fraud_preds = []
        now = datetime.now()

        for idx, tx in enumerate(all_txs):
            # Rotate across trained models
            chosen_model_id = model_ids[idx % len(model_ids)]
            
            # Realistic probability score based on ground truth is_fraud
            if tx.is_fraud:
                # 90% - 99.8% probability
                score = round(random.uniform(0.88, 0.998), 4)
                prediction = True
            else:
                # 95% of normal transactions get 0.001 - 0.15, 5% borderline (false alarms)
                if random.random() < 0.05:
                    score = round(random.uniform(0.31, 0.58), 4)
                    prediction = True
                else:
                    score = round(random.uniform(0.002, 0.18), 4)
                    prediction = False

            # Spread timestamps over the last 14 days
            pred_time = now - timedelta(
                days=random.randint(0, 14),
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59)
            )

            pred_record = db_models.Fraud_prediction(
                transaction_id=tx.transaction_id,
                model_id=chosen_model_id,
                Fraud_score=score,
                prediction=prediction,
                threshold=0.30,
                prediction_time=pred_time
            )
            fraud_preds.append(pred_record)

        db.bulk_save_objects(fraud_preds)
        db.commit()
        print(f"[Populate] Successfully inserted {len(fraud_preds)} records into 'frauds' table.")

        # ------------------------------------------------------------------
        # 2. POPULATE DRIFT_REPORTS TABLE
        # ------------------------------------------------------------------
        print("[Populate] Generating drift reports across features and time windows...")
        features_meta = [
            {"feature": "amountToOrigBalance", "base_psi": 0.285, "status": "drift_detected"},
            {"feature": "type_TRANSFER", "base_psi": 0.264, "status": "drift_detected"},
            {"feature": "balanceDiffOrig", "base_psi": 0.165, "status": "warning"},
            {"feature": "amount", "base_psi": 0.138, "status": "warning"},
            {"feature": "oldbalanceDest", "base_psi": 0.082, "status": "stable"},
            {"feature": "newbalanceDest", "base_psi": 0.076, "status": "stable"},
            {"feature": "balanceDiffDest", "base_psi": 0.054, "status": "stable"},
            {"feature": "oldbalanceOrg", "base_psi": 0.038, "status": "stable"},
            {"feature": "newbalanceOrig", "base_psi": 0.032, "status": "stable"},
            {"feature": "type_CASH_OUT", "base_psi": 0.045, "status": "stable"},
            {"feature": "type_PAYMENT", "base_psi": 0.021, "status": "stable"},
        ]

        drift_records = []
        # Create reports across 4 distinct check checkpoints (today, 3d ago, 7d ago, 14d ago)
        checkpoints = [0, 3, 7, 14]

        for days_ago in checkpoints:
            chk_time = now - timedelta(days=days_ago, hours=random.randint(1, 6))
            rep_time = chk_time + timedelta(minutes=random.randint(5, 20))

            for model_id in model_ids:
                for f_info in features_meta:
                    # Add subtle random variation per checkpoint
                    psi_jitter = round(f_info["base_psi"] * random.uniform(0.88, 1.15), 4)
                    status = "stable"
                    if psi_jitter >= 0.25:
                        status = "drift_detected"
                    elif psi_jitter >= 0.10:
                        status = "warning"

                    d_rec = db_models.drift_reports(
                        model_id=model_id,
                        feature_name=f_info["feature"],
                        drift_score=psi_jitter,
                        drift_status=status,
                        checked_at=chk_time,
                        report_time=rep_time
                    )
                    drift_records.append(d_rec)

        db.bulk_save_objects(drift_records)
        db.commit()
        print(f"[Populate] Successfully inserted {len(drift_records)} records into 'drift_reports' table.")

        # Summary count verification
        final_frauds = db.query(db_models.Fraud_prediction).count()
        final_drift = db.query(db_models.drift_reports).count()
        print(f"\n[Verification] MySQL Database Summary:")
        print(f" - 'frauds' total rows: {final_frauds}")
        print(f" - 'drift_reports' total rows: {final_drift}")
        print(f" - 'models' total rows: {db.query(db_models.Model).count()}")
        print(f" - 'transactions' total rows: {db.query(db_models.Transaction).count()}")
        print(f" - 'users' total rows: {db.query(db_models.User).count()}")

    except Exception as e:
        db.rollback()
        print(f"[Error during population] {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    populate()
