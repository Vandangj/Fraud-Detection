import os
import sys
import time
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    roc_curve,
    precision_recall_curve,
    auc
)
from imblearn.over_sampling import SMOTE
import xgboost as xgb
import lightgbm as lgb

# Add parent directory to sys.path to access database & models
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
try:
    from database import SessionLocal
    import database_models as db_models
    import schemas
    import crud
except Exception as e:
    print(f"[Warning] Could not import database modules: {e}")
    SessionLocal = None

DATA_PATH = "data/dataset.csv"
MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)


def load_stratified_dataset(data_path, sample_non_fraud=80000):
    """
    Efficiently loads all fraud cases and a representative sample of non-fraud cases
    to allow fast, accurate multi-model training without crashing RAM.
    """
    print(f"[Dataset] Loading data from {data_path}...")
    chunksize = 200000
    fraud_chunks = []
    non_fraud_chunks = []
    total_non_fraud_sampled = 0

    for i, chunk in enumerate(pd.read_csv(data_path, chunksize=chunksize)):
        frauds = chunk[chunk["isFraud"] == 1]
        if not frauds.empty:
            fraud_chunks.append(frauds)

        if total_non_fraud_sampled < sample_non_fraud:
            sample_size = min(int(sample_non_fraud / 10), len(chunk[chunk["isFraud"] == 0]))
            non_frauds = chunk[chunk["isFraud"] == 0].sample(n=sample_size, random_state=42)
            non_fraud_chunks.append(non_frauds)
            total_non_fraud_sampled += len(non_frauds)

    df_fraud = pd.concat(fraud_chunks, ignore_index=True)
    df_non_fraud = pd.concat(non_fraud_chunks, ignore_index=True)

    df = pd.concat([df_fraud, df_non_fraud], ignore_index=True)
    # Shuffle
    df = df.sample(frac=1.0, random_state=42).reset_index(drop=True)

    print(f"[Dataset] Combined Shape: {df.shape}")
    print(f"[Dataset] Class Breakdown:\n{df['isFraud'].value_counts()}")
    return df


def engineer_features(df):
    """Generate feature engineered columns."""
    df = df.copy()
    if "nameOrig" in df.columns:
        df = df.drop(columns=["nameOrig"])
    if "nameDest" in df.columns:
        df = df.drop(columns=["nameDest"])

    df["balanceDiffOrig"] = df["oldbalanceOrg"] - df["newbalanceOrig"]
    df["balanceDiffDest"] = df["newbalanceDest"] - df["oldbalanceDest"]
    df["amountToOrigBalance"] = df["amount"] / (df["oldbalanceOrg"] + 1)
    df["amountToDestBalance"] = df["amount"] / (df["oldbalanceDest"] + 1)

    df = pd.get_dummies(df, columns=["type"], drop_first=True)

    # Ensure all expected one-hot columns are present
    for col in ["type_CASH_OUT", "type_DEBIT", "type_PAYMENT", "type_TRANSFER"]:
        if col not in df.columns:
            df[col] = 0

    X = df.drop(columns=["isFraud"])
    y = df["isFraud"].astype(int)

    return X, y


def train_and_evaluate_all():
    start_all = time.time()
    df = load_stratified_dataset(DATA_PATH)
    X, y = engineer_features(df)

    feature_names = X.columns.tolist()
    print(f"[Features] {len(feature_names)} features: {feature_names}")

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"[Split] Train: {len(X_train)} samples, Test: {len(X_test)} samples")

    # Apply SMOTE to training set
    print("[Preprocessing] Applying SMOTE oversampling...")
    smote = SMOTE(sampling_strategy=0.5, random_state=42)
    X_train_smote, y_train_smote = smote.fit_resample(X_train, y_train)
    print(f"[Preprocessing] After SMOTE: {dict(y_train_smote.value_counts())}")

    threshold = 0.30

    models_config = {
        "rf-balanced-v1": {
            "name": "RandomForestClassifier (SMOTE)",
            "estimator": RandomForestClassifier(
                n_estimators=100,
                max_depth=16,
                class_weight="balanced",
                random_state=42,
                n_jobs=-1
            ),
            "save_file": "rf_model.pkl",
            "is_primary": True
        },
        "xgb-boosted-v1": {
            "name": "XGBoost Classifier",
            "estimator": xgb.XGBClassifier(
                n_estimators=120,
                max_depth=6,
                learning_rate=0.08,
                random_state=42,
                eval_metric="logloss",
                n_jobs=-1
            ),
            "save_file": "xgb_model.pkl",
            "is_primary": False
        },
        "lgb-fast-v1": {
            "name": "LightGBM Classifier",
            "estimator": lgb.LGBMClassifier(
                n_estimators=120,
                max_depth=6,
                learning_rate=0.08,
                random_state=42,
                verbose=-1,
                n_jobs=-1
            ),
            "save_file": "lgb_model.pkl",
            "is_primary": False
        },
        "gb-ensemble-v1": {
            "name": "Gradient Boosting Classifier",
            "estimator": HistGradientBoostingClassifier(
                max_iter=100,
                max_depth=8,
                class_weight="balanced",
                random_state=42
            ),
            "save_file": "gb_model.pkl",
            "is_primary": False
        },
        "lr-baseline-v1": {
            "name": "Logistic Regression Baseline",
            "estimator": LogisticRegression(
                max_iter=1000,
                class_weight="balanced",
                random_state=42
            ),
            "save_file": "lr_model.pkl",
            "is_primary": False
        }
    }

    comparison_results = {}

    for model_id, cfg in models_config.items():
        print(f"\n==========================================")
        print(f"Training: {cfg['name']} ({model_id})")
        print(f"==========================================")

        clf = cfg["estimator"]
        t0 = time.time()
        clf.fit(X_train_smote, y_train_smote)
        train_time = time.time() - t0

        # Inference timing
        t_inf_start = time.time()
        y_prob = clf.predict_proba(X_test)[:, 1]
        inf_time_ms = ((time.time() - t_inf_start) / len(X_test)) * 1000

        y_pred = (y_prob >= threshold).astype(int)

        # Metrics
        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, zero_division=0))
        rec = float(recall_score(y_test, y_pred, zero_division=0))
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        roc = float(roc_auc_score(y_test, y_prob))

        cm = confusion_matrix(y_test, y_pred).tolist()

        # Compute ROC points for frontend charting (downsampled to 30 points)
        fpr, tpr, _ = roc_curve(y_test, y_prob)
        indices = np.linspace(0, len(fpr) - 1, min(30, len(fpr)), dtype=int)
        roc_points = [{"fpr": round(float(fpr[i]), 4), "tpr": round(float(tpr[i]), 4)} for i in indices]

        print(f"Accuracy  : {acc:.4f}")
        print(f"Precision : {prec:.4f}")
        print(f"Recall    : {rec:.4f}")
        print(f"F1 Score  : {f1:.4f}")
        print(f"ROC-AUC   : {roc:.4f}")
        print(f"Train Time: {train_time:.2f}s | Latency: {inf_time_ms:.4f} ms/query")

        # Save individual model
        save_path = os.path.join(MODELS_DIR, cfg["save_file"])
        joblib.dump(clf, save_path)
        print(f"Saved model to {save_path}")

        # If primary, also save to standard model.pkl for legacy code
        if cfg["is_primary"]:
            joblib.dump(clf, os.path.join(MODELS_DIR, "model.pkl"))

        comparison_results[model_id] = {
            "model_id": model_id,
            "model_name": cfg["name"],
            "model_accuracy": round(acc, 4),
            "model_precision": round(prec, 4),
            "model_recall": round(rec, 4),
            "model_f1_score": round(f1, 4),
            "model_roc_auc": round(roc, 4),
            "model_status": "active" if model_id in ["rf-balanced-v1", "xgb-boosted-v1"] else "evaluated",
            "training_time_sec": round(train_time, 2),
            "latency_ms": round(inf_time_ms, 3),
            "confusion_matrix": cm,
            "roc_points": roc_points,
            "save_file": cfg["save_file"],
            "model_training_time": datetime.now().isoformat()
        }

    # Save feature list and threshold
    joblib.dump(feature_names, os.path.join(MODELS_DIR, "features.pkl"))
    joblib.dump(threshold, os.path.join(MODELS_DIR, "threshold.pkl"))

    # Save comparison metadata JSON
    with open(os.path.join(MODELS_DIR, "metrics_comparison.json"), "w") as f:
        json.dump(comparison_results, f, indent=2)

    print("\nSaved features.pkl, threshold.pkl, and metrics_comparison.json successfully.")

    # Sync results to MySQL models table
    if SessionLocal:
        sync_models_to_mysql(comparison_results)

    total_time = time.time() - start_all
    print(f"\n[Multi-Model Complete] All models trained and saved in {total_time:.1f}s.")
    return comparison_results


def sync_models_to_mysql(results):
    """Upserts trained model results into MySQL models table."""
    print("\n[Database] Synchronizing models to MySQL 'models' table...")
    db = SessionLocal()
    try:
        for model_id, data in results.items():
            existing = db.query(db_models.Model).filter(db_models.Model.model_id == model_id).first()
            if existing:
                existing.model_name = data["model_name"]
                existing.model_accuracy = data["model_accuracy"]
                existing.model_precision = data["model_precision"]
                existing.model_recall = data["model_recall"]
                existing.model_f1_score = data["model_f1_score"]
                existing.model_roc_auc = data["model_roc_auc"]
                existing.model_status = data["model_status"]
                existing.model_training_time = datetime.now()
                print(f"Updated model {model_id} in MySQL.")
            else:
                new_m = db_models.Model(
                    model_id=model_id,
                    model_name=data["model_name"],
                    model_accuracy=data["model_accuracy"],
                    model_precision=data["model_precision"],
                    model_recall=data["model_recall"],
                    model_f1_score=data["model_f1_score"],
                    model_roc_auc=data["model_roc_auc"],
                    model_status=data["model_status"],
                    model_training_time=datetime.now()
                )
                db.add(new_m)
                print(f"Inserted new model {model_id} into MySQL.")
        db.commit()
        print("[Database] Models synchronized successfully.")
    except Exception as e:
        db.rollback()
        print(f"[Database Error] Failed to sync models to MySQL: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    train_and_evaluate_all()
