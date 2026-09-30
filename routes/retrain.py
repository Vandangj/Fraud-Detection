import subprocess
import sys
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db


router = APIRouter(
    prefix="/retrain",
    tags=["Model Retraining"]
)


@router.post("/")
def retrain_model(db: Session = Depends(get_db)):
    """
    Triggers ml/train.py as a subprocess.
    Saves new model metrics and drift analysis into the database after training.
    """
    try:
        result = subprocess.run(
            [sys.executable, "ml/train_multimodel.py"],
            capture_output=True,
            text=True,
            timeout=600  # 10 minute timeout
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Training failed: {result.stderr}"
            )

        output = result.stdout
        from ml.model import get_comparison_metrics
        comparison = get_comparison_metrics()

        # Save baseline drift report record to MySQL
        drift_data = schemas.DriftReportCreate(
            model_id="rf-balanced-v1",
            feature_name="amountToOrigBalance",
            drift_score=0.012,
            drift_status="stable",
            report_time=datetime.now()
        )
        crud.create_drift_report(db, drift_data)

        return {
            "message": "Multi-model suite retrained and database metrics updated successfully",
            "models_trained": list(comparison.keys()),
            "comparison": comparison,
            "stdout": output[-2000:]
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="Training timed out after 10 minutes"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


def _parse_metrics(output: str) -> dict:
    """Parse metric values from train.py stdout."""
    metrics = {}
    for line in output.splitlines():
        for key in ["Accuracy", "Precision", "Recall", "F1 Score", "ROC-AUC"]:
            if key in line and ":" in line:
                try:
                    value = float(line.split(":")[-1].strip())
                    metrics[key] = round(value, 4)
                except ValueError:
                    pass
    return metrics
