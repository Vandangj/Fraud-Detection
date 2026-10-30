import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
import pandas as pd

import crud
import schemas
import database_models as models
from database import get_db
from ml.model import model, features, threshold, get_model, explain_tree_prediction


router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"]
)


@router.get("/{transaction_id}/explanation")
def explain_transaction(
    transaction_id: int = Path(ge=1, description="Transaction ID."),
    db: Session = Depends(get_db),
):
    try:
        transaction = crud.get_transaction(db, transaction_id)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transaction could not be retrieved because the database is unavailable.",
        ) from exc
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if not features:
        raise HTTPException(status_code=503, detail="Model feature metadata is unavailable")

    amount = float(transaction.amount)
    old_balance = float(transaction.old_balance or 0)
    new_balance = float(transaction.new_balance or 0)
    transaction_type = transaction.transaction_type.upper()
    row = {
        "step": transaction.step or 0,
        "amount": amount,
        "oldbalanceOrg": old_balance,
        "newbalanceOrig": new_balance,
        "oldbalanceDest": 0,
        "newbalanceDest": 0,
        "isFlaggedFraud": 0,
        "balanceDiffOrig": old_balance - new_balance,
        "balanceDiffDest": 0,
        "amountToOrigBalance": amount / (old_balance + 1),
        "amountToDestBalance": amount,
        "type_CASH_OUT": int(transaction_type == "CASH_OUT"),
        "type_DEBIT": int(transaction_type == "DEBIT"),
        "type_PAYMENT": int(transaction_type == "PAYMENT"),
        "type_TRANSFER": int(transaction_type == "TRANSFER"),
    }
    input_data = pd.DataFrame([row]).reindex(columns=features, fill_value=0)
    selected_model = get_model("rf-balanced-v1")
    if selected_model is None:
        raise HTTPException(status_code=503, detail="Random Forest model is unavailable")

    try:
        base_value, shap_values = explain_tree_prediction(selected_model, input_data)
        probability = float(selected_model.predict_proba(input_data)[0][1])
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="TreeSHAP is unavailable. Install the backend requirements.",
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not explain this transaction: {exc}") from exc

    contributions = [
        {
            "feature": feature,
            "value": float(row.get(feature, 0)),
            "shap_value": float(shap_value),
        }
        for feature, shap_value in zip(features, shap_values)
    ]
    contributions.sort(key=lambda item: abs(item["shap_value"]), reverse=True)

    assumptions = [
        "Destination account balances are not stored for this transaction and were treated as 0.",
        "The training flag isFlaggedFraud is not stored and was treated as 0.",
    ]
    if transaction.old_balance is None or transaction.new_balance is None:
        assumptions.append("Missing sender balance values were treated as 0.")

    return {
        "transaction_id": transaction_id,
        "model_id": "rf-balanced-v1",
        "base_value": base_value,
        "fraud_probability": probability,
        "threshold": float(threshold),
        "contributions": contributions[:8],
        "assumptions": assumptions,
    }


@router.post(
    "/",
    response_model=schemas.TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a transaction",
    description="Stores a transaction for an existing user whose account matches the sender account.",
)
def create_transaction(
    transaction: schemas.TransactionCreate,
    db: Session = Depends(get_db)
):
    try:
        user = crud.get_user(db, transaction.user_id)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transaction database is unavailable.",
        ) from exc

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if user.account_id != transaction.sender_account_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="sender_account_id must match the account_id for user_id.",
        )

    # 2. Automatically run ML Model prediction if is_fraud wasn't explicitly set
    if transaction.is_fraud is None or transaction.is_fraud == False:
        try:
            old_orig = float(transaction.old_balance or 0.0)
            new_orig = float(transaction.new_balance or 0.0)
            old_dest = 0.0
            new_dest = float(transaction.amount or 0.0)

            tx_type = transaction.transaction_type.upper()
            row = {
                "step": transaction.step,
                "amount": transaction.amount,
                "oldbalanceOrg": old_orig,
                "newbalanceOrig": new_orig,
                "oldbalanceDest": old_dest,
                "newbalanceDest": new_dest,
                "isFlaggedFraud": 0,
                "balanceDiffOrig": old_orig - new_orig,
                "balanceDiffDest": new_dest - old_dest,
                "amountToOrigBalance": transaction.amount / (old_orig + 1),
                "amountToDestBalance": transaction.amount / (old_dest + 1),
                "type_CASH_OUT": int(tx_type == "CASH_OUT"),
                "type_DEBIT": int(tx_type == "DEBIT"),
                "type_PAYMENT": int(tx_type == "PAYMENT"),
                "type_TRANSFER": int(tx_type == "TRANSFER"),
            }

            df = pd.DataFrame([row])
            df = df.reindex(columns=features, fill_value=0)

            prob = float(model.predict_proba(df)[0][1])
            is_ml_fraud = prob >= threshold

            if is_ml_fraud:
                transaction.is_fraud = True
        except Exception as e:
            print(f"[ML Auto-Score Warning] {e}")

    # 3. Create transaction in MySQL
    try:
        db_tx = crud.create_transaction(db, transaction)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transaction conflicts with a database constraint.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transaction could not be saved because the database is unavailable.",
        ) from exc

    # 4. Save prediction record to MySQL frauds table
    try:
        prob = 0.95 if db_tx.is_fraud else 0.05
        fraud_pred = schemas.FraudPredictionCreate(
            transaction_id=db_tx.transaction_id,
            model_id="rf-balanced-v1",
            Fraud_score=prob,
            prediction=bool(db_tx.is_fraud),
            threshold=float(threshold),
            prediction_time=datetime.now()
        )
        crud.create_fraud_prediction(db, fraud_pred)
    except Exception as e:
        print(f"[DB Fraud Prediction Save Warning] {e}")

    return db_tx


_summary_cache = None
_summary_cache_time = 0


@router.get(
    "/summary",
    summary="Get transaction and fraud-prediction totals",
    description="Returns exact transaction and positive fraud-prediction counts for the overview.",
)
def get_transaction_summary(db: Session = Depends(get_db)):
    global _summary_cache, _summary_cache_time
    now = time.time()
    if _summary_cache and (now - _summary_cache_time < 5):
        return _summary_cache

    try:
        transaction_count = db.query(func.count(models.Transaction.transaction_id)).scalar() or 0
        fraud_prediction_count = (
            db.query(func.count(models.Transaction.transaction_id))
            .filter(models.Transaction.is_fraud.is_(True))
            .scalar()
            or 0
        )
        if fraud_prediction_count == 0:
            fraud_prediction_count = (
                db.query(func.count(models.Fraud_prediction.prediction_id))
                .filter(models.Fraud_prediction.prediction.is_(True))
                .scalar()
                or 0
            )
        result = {
            "transaction_count": transaction_count,
            "fraud_prediction_count": fraud_prediction_count,
        }
        _summary_cache = result
        _summary_cache_time = now
        return result
    except SQLAlchemyError as exc:
        if _summary_cache:
            return _summary_cache
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transaction totals could not be retrieved because the database is unavailable.",
        ) from exc


@router.get(
    "/",
    response_model=list[schemas.TransactionResponse],
    summary="List transactions",
    description="Returns transactions ordered by newest ID first. Use skip and limit for bounded offset pagination; limit is capped at 500.",
)
def get_transactions(
    skip: int = Query(default=0, ge=0, description="Number of transactions to skip."),
    limit: int = Query(default=100, ge=1, le=500, description="Maximum transactions to return (1-500)."),
    db: Session = Depends(get_db)
):
    try:
        return crud.get_transactions(db, skip, limit)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transactions could not be retrieved because the database is unavailable.",
        ) from exc


@router.get(
    "/{transaction_id}",
    response_model=schemas.TransactionResponse,
    summary="Get a transaction",
    description="Returns one transaction by its database ID.",
)
def get_transaction(
    transaction_id: int = Path(ge=1, description="Transaction ID."),
    db: Session = Depends(get_db)
):
    try:
        transaction = crud.get_transaction(db, transaction_id)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transaction could not be retrieved because the database is unavailable.",
        ) from exc
    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )
    return transaction


@router.put(
    "/{transaction_id}",
    response_model=schemas.TransactionResponse,
    summary="Update a transaction",
    description="Updates only transaction_type, amount, balances, or is_fraud. IDs, user association, sender, destination, and step are immutable.",
)
def update_transaction(
    transaction: schemas.TransactionUpdate,
    transaction_id: int = Path(ge=1, description="Transaction ID."),
    db: Session = Depends(get_db)
):
    try:
        updated = crud.update_transaction(db, transaction_id, transaction)
        if updated and transaction.is_fraud is not None:
            existing_pred = (
                db.query(models.Fraud_prediction)
                .filter(models.Fraud_prediction.transaction_id == transaction_id)
                .first()
            )
            if existing_pred:
                existing_pred.prediction = bool(transaction.is_fraud)
                existing_pred.Fraud_score = 0.95 if transaction.is_fraud else 0.05
                db.commit()
            else:
                new_pred = models.Fraud_prediction(
                    transaction_id=transaction_id,
                    model_id="rf-balanced-v1",
                    Fraud_score=0.95 if transaction.is_fraud else 0.05,
                    prediction=bool(transaction.is_fraud),
                    threshold=float(threshold),
                    prediction_time=datetime.now()
                )
                db.add(new_pred)
                db.commit()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transaction update conflicts with a database constraint.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transaction could not be updated because the database is unavailable.",
        ) from exc
    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )
    return updated


@router.delete(
    "/{transaction_id}",
    summary="Delete a transaction",
    description="Deletes a transaction unless dependent fraud prediction records prevent deletion.",
)
def delete_transaction(
    transaction_id: int = Path(ge=1, description="Transaction ID."),
    db: Session = Depends(get_db)
):
    try:
        transaction = crud.delete_transaction(db, transaction_id)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transaction cannot be deleted while dependent records exist.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transaction could not be deleted because the database is unavailable.",
        ) from exc
    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )
    return {
        "message": "Transaction deleted successfully"
    }
