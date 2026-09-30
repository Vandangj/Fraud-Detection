from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import pandas as pd

import crud
import schemas
from database import get_db
from ml.model import get_model, features, threshold, predict_all_models, get_available_models


router = APIRouter(
    prefix="/predict",
    tags=["ML Prediction"]
)


class PredictRequest(BaseModel):
    transaction_id: int
    model_id: Optional[str] = "rf-balanced-v1"
    step: int
    amount: float
    oldbalanceOrg: float
    newbalanceOrig: float
    oldbalanceDest: float
    newbalanceDest: float
    isFlaggedFraud: Optional[int] = 0
    transaction_type: str  # CASH_OUT, DEBIT, PAYMENT, TRANSFER, CASH_IN


class PredictResponse(BaseModel):
    transaction_id: int
    model_id: str
    fraud_probability: float
    prediction: bool
    threshold: float
    prediction_id: int
    reasons: List[str]
    all_models: Optional[dict] = None


def explain_fraud_prediction(req: PredictRequest, probability: float, is_fraud: bool, model_name: str = "ML Model") -> List[str]:
    reasons = []
    
    # Check balance drain rule
    if req.oldbalanceOrg > 0 and req.newbalanceOrig == 0:
        reasons.append("Account balance fully drained to 0.00 (High-risk account takeover signature)")
        
    # Check type specific patterns
    if req.transaction_type.upper() in ["TRANSFER", "CASH_OUT"]:
        if req.amount > 100000:
            reasons.append(f"High-value {req.transaction_type} transaction exceeding $100k threshold")
        if req.oldbalanceOrg < req.amount:
            reasons.append("Transfer amount exceeds initial recorded balance")
    
    # Check zero balance destination anomaly
    if req.oldbalanceDest == 0 and req.newbalanceDest == 0 and req.amount > 0:
        reasons.append("Destination account balance remained zero after transfer (Mule account signature)")

    if not reasons:
        if is_fraud:
            reasons.append(f"{model_name} confidence score ({probability:.2%}) exceeds cutoff threshold ({threshold:.2f})")
        else:
            reasons.append("Transaction characteristics within normal baseline operating parameters")
            
    return reasons


def _prepare_df(req: PredictRequest) -> pd.DataFrame:
    balanceDiffOrig = req.oldbalanceOrg - req.newbalanceOrig
    balanceDiffDest = req.newbalanceDest - req.oldbalanceDest
    amountToOrigBalance = req.amount / (req.oldbalanceOrg + 1)
    amountToDestBalance = req.amount / (req.oldbalanceDest + 1)

    tx_type = req.transaction_type.upper()
    row = {
        "step": req.step,
        "amount": req.amount,
        "oldbalanceOrg": req.oldbalanceOrg,
        "newbalanceOrig": req.newbalanceOrig,
        "oldbalanceDest": req.oldbalanceDest,
        "newbalanceDest": req.newbalanceDest,
        "isFlaggedFraud": req.isFlaggedFraud or 0,
        "balanceDiffOrig": balanceDiffOrig,
        "balanceDiffDest": balanceDiffDest,
        "amountToOrigBalance": amountToOrigBalance,
        "amountToDestBalance": amountToDestBalance,
        "type_CASH_OUT": int(tx_type == "CASH_OUT"),
        "type_DEBIT": int(tx_type == "DEBIT"),
        "type_PAYMENT": int(tx_type == "PAYMENT"),
        "type_TRANSFER": int(tx_type == "TRANSFER"),
    }

    df = pd.DataFrame([row])
    return df.reindex(columns=features, fill_value=0)


@router.post("/", response_model=PredictResponse)
def predict_transaction(
    req: PredictRequest,
    db: Session = Depends(get_db)
):
    df = _prepare_df(req)
    selected_model_id = req.model_id or "rf-balanced-v1"
    active_clf = get_model(selected_model_id)

    probability = float(active_clf.predict_proba(df)[0][1])
    is_fraud = probability >= threshold

    reasons = explain_fraud_prediction(req, probability, is_fraud, selected_model_id)

    # Save prediction to DB
    fraud_data = schemas.FraudPredictionCreate(
        transaction_id=req.transaction_id,
        model_id=selected_model_id,
        Fraud_score=round(probability, 6),
        prediction=is_fraud,
        threshold=float(threshold),
        prediction_time=datetime.now()
    )

    saved = crud.create_fraud_prediction(db, fraud_data)

    if is_fraud:
        crud.create_fraud_alert(db, saved, probability)

    # Compute comparative results across all models
    multi_results = predict_all_models(df)

    return PredictResponse(
        transaction_id=req.transaction_id,
        model_id=selected_model_id,
        fraud_probability=probability,
        prediction=is_fraud,
        threshold=float(threshold),
        prediction_id=saved.prediction_id,
        reasons=reasons,
        all_models=multi_results
    )

