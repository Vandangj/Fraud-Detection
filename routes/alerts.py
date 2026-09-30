from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
import database_models as models


router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)


@router.get("/")
def get_alerts(db: Session = Depends(get_db)):
    """
    Derives alerts from:
    - High fraud-score predictions (score >= 0.7)
    - Drift reports with status 'drift_detected'
    """
    alerts = []

    # --- High fraud score alerts ---
    high_fraud = (
        db.query(models.Fraud_prediction)
        .filter(models.Fraud_prediction.Fraud_score >= 0.70)
        .order_by(models.Fraud_prediction.prediction_time.desc())
        .limit(50)
        .all()
    )

    for f in high_fraud:
        alerts.append({
            "alert_id": f"fraud-{f.prediction_id}",
            "type": "HIGH_FRAUD_SCORE",
            "severity": "critical" if float(f.Fraud_score) >= 0.90 else "high",
            "message": f"Transaction {f.transaction_id} flagged with fraud score {float(f.Fraud_score):.2%}",
            "transaction_id": f.transaction_id,
            "fraud_score": float(f.Fraud_score),
            "timestamp": f.prediction_time.isoformat() if f.prediction_time else None,
        })

    # --- Drift alerts ---
    drift_alerts = (
        db.query(models.drift_reports)
        .filter(models.drift_reports.drift_status == "drift_detected")
        .order_by(models.drift_reports.report_time.desc())
        .limit(20)
        .all()
    )

    for d in drift_alerts:
        alerts.append({
            "alert_id": f"drift-{d.report_id}",
            "type": "DRIFT_DETECTED",
            "severity": "high" if float(d.drift_score) >= 0.25 else "medium",
            "message": f"Feature '{d.feature_name}' drift detected (PSI={float(d.drift_score):.4f})",
            "feature_name": d.feature_name,
            "drift_score": float(d.drift_score),
            "model_id": d.model_id,
            "timestamp": d.report_time.isoformat() if d.report_time else None,
        })

    # Sort all alerts by timestamp descending
    alerts.sort(key=lambda x: x["timestamp"] or "", reverse=True)

    return alerts
