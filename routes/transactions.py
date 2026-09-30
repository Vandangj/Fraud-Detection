from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
import pandas as pd

import crud
import schemas
import database_models as models
from database import get_db
from ml.model import model, features, threshold


router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"]
)


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