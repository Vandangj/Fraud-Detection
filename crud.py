from datetime import datetime
import hashlib
import json
import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import database_models as models
import schemas


logger = logging.getLogger(__name__)


# users

def create_user(db: Session, user: schemas.UserCreate):

    db_user = models.User(
        account_id=user.account_id,
        name=user.name,
        account_type=user.account_type,
        email=user.email,
        password_hash=user.password_hash,
        created_at=datetime.now()
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(models.User)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_user(db: Session, user_id: int):

    return db.query(models.User).filter(
        models.User.user_id == user_id
    ).first()


def update_user(
    db: Session,
    user_id: int,
    user: schemas.UserUpdate
):

    db_user = get_user(db, user_id)

    if not db_user:
        return None

    update_data = user.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_user, key, value)

    db.commit()
    db.refresh(db_user)

    return db_user


def delete_user(db: Session, user_id: int):

    db_user = get_user(db, user_id)

    if not db_user:
        return None

    db.delete(db_user)
    db.commit()

    return db_user


# transactions

def _commit_transaction(db: Session):
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

def create_transaction(
    db: Session,
    transaction: schemas.TransactionCreate
):

    db_transaction = models.Transaction(
        user_id=transaction.user_id,
        sender_account_id=transaction.sender_account_id,
        destination_account_id=transaction.destination_account_id,
        step=transaction.step,
        transaction_type=transaction.transaction_type,
        amount=transaction.amount,
        old_balance=transaction.old_balance,
        new_balance=transaction.new_balance,
        is_fraud=transaction.is_fraud
    )

    db.add(db_transaction)
    _commit_transaction(db)
    db.refresh(db_transaction)

    return db_transaction

def get_transactions(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(models.Transaction)
        .order_by(models.Transaction.transaction_id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_transaction(db: Session, transaction_id: int):

    return db.query(models.Transaction).filter(
        models.Transaction.transaction_id == transaction_id
    ).first()


def update_transaction(
    db: Session,
    transaction_id: int,
    transaction: schemas.TransactionUpdate
):

    db_transaction = get_transaction(db, transaction_id)

    if not db_transaction:
        return None

    update_data = transaction.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_transaction, key, value)

    _commit_transaction(db)
    db.refresh(db_transaction)

    return db_transaction


def delete_transaction(db: Session, transaction_id: int):

    db_transaction = get_transaction(db, transaction_id)

    if not db_transaction:
        return None

    db.delete(db_transaction)
    _commit_transaction(db)

    return db_transaction


# models

class ModelInUseError(Exception):
    pass


def _commit_model(db: Session):
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

def create_model(db: Session, model: schemas.ModelCreate):

    db_model = models.Model(
        model_id=model.model_id,
        model_name=model.model_name,
        model_accuracy=model.model_accuracy,
        model_precision=model.model_precision,
        model_recall=model.model_recall,
        model_f1_score=model.model_f1_score,
        model_roc_auc=model.model_roc_auc,
        model_status=model.model_status,
        model_training_time=model.model_training_time
    )

    db.add(db_model)
    _commit_model(db)
    db.refresh(db_model)

    return db_model


def get_models(db: Session):
    return db.query(models.Model).order_by(models.Model.model_id).all()


def get_model(db: Session, model_id: str):

    return db.query(models.Model).filter(
        models.Model.model_id == model_id
    ).first()


def update_model(
    db: Session,
    model_id: str,
    model: schemas.ModelUpdate
):

    db_model = get_model(db, model_id)

    if not db_model:
        return None

    update_data = model.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(db_model, key, value)

    _commit_model(db)
    db.refresh(db_model)

    return db_model


def delete_model(db: Session, model_id: str):

    db_model = get_model(db, model_id)

    if not db_model:
        return None

    has_fraud_predictions = db.query(models.Fraud_prediction.prediction_id).filter(
        models.Fraud_prediction.model_id == model_id
    ).first()
    has_drift_reports = db.query(models.drift_reports.report_id).filter(
        models.drift_reports.model_id == model_id
    ).first()
    if has_fraud_predictions or has_drift_reports:
        raise ModelInUseError(model_id)

    db.delete(db_model)
    _commit_model(db)

    return db_model


# fraud predictions

def create_fraud_prediction(
    db: Session,
    fraud: schemas.FraudPredictionCreate
):

    db_fraud = models.Fraud_prediction(
        transaction_id=fraud.transaction_id,
        model_id=fraud.model_id,
        Fraud_score=fraud.Fraud_score,
        prediction=fraud.prediction,
        threshold=fraud.threshold,
        prediction_time=fraud.prediction_time or datetime.now()
    )

    db.add(db_fraud)
    db.commit()
    db.refresh(db_fraud)

    return db_fraud


def get_fraud_predictions(db: Session):
    return db.query(models.Fraud_prediction).all()


def get_fraud_prediction(
    db: Session,
    prediction_id: int
):

    return db.query(models.Fraud_prediction).filter(
        models.Fraud_prediction.prediction_id == prediction_id
    ).first()


def delete_fraud_prediction(
    db: Session,
    prediction_id: int
):

    fraud = get_fraud_prediction(db, prediction_id)

    if not fraud:
        return None

    db.delete(fraud)
    db.commit()

    return fraud


# drift reports

def _commit_drift_report(db: Session):
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise

def create_drift_report(
    db: Session,
    report: schemas.DriftReportCreate
):

    db_report = models.drift_reports(
        model_id=report.model_id,
        feature_name=report.feature_name,
        drift_score=report.drift_score,
        drift_status=report.drift_status,
        checked_at=report.checked_at or datetime.now(),
        report_time=report.report_time or datetime.now()
    )

    db.add(db_report)
    _commit_drift_report(db)
    db.refresh(db_report)

    return db_report


def get_drift_reports(
    db: Session,
    skip: int = 0,
    limit: int = 500,
    model_id: str = None,
    feature_name: str = None,
    drift_status: str = None,
):
    query = db.query(models.drift_reports)
    if model_id is not None:
        query = query.filter(models.drift_reports.model_id == model_id)
    if feature_name is not None:
        query = query.filter(models.drift_reports.feature_name == feature_name)
    if drift_status is not None:
        query = query.filter(models.drift_reports.drift_status == drift_status)
    return (
        query.order_by(
            models.drift_reports.report_time.desc(),
            models.drift_reports.report_id.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_drift_report(
    db: Session,
    report_id: int
):

    return db.query(models.drift_reports).filter(
        models.drift_reports.report_id == report_id
    ).first()


def delete_drift_report(
    db: Session,
    report_id: int
):

    report = get_drift_report(db, report_id)

    if not report:
        return None

    db.delete(report)
    _commit_drift_report(db)

    return report


# alerts

def create_alert(db: Session, alert: schemas.AlertCreate):
    existing = db.query(models.Alert).filter(
        models.Alert.dedupe_key == alert.dedupe_key
    ).first()
    if existing:
        return existing

    db_alert = models.Alert(
        alert_type=alert.alert_type,
        severity=alert.severity,
        message=alert.message,
        transaction_id=alert.transaction_id,
        model_id=alert.model_id,
        fraud_probability=alert.fraud_probability,
        feature_name=alert.feature_name,
        drift_score=alert.drift_score,
        drift_status=alert.drift_status,
        source_prediction_id=alert.source_prediction_id,
        source_drift_report_id=alert.source_drift_report_id,
        dedupe_key=alert.dedupe_key,
        created_at=datetime.now(),
    )
    db.add(db_alert)
    try:
        db.commit()
        db.refresh(db_alert)
        return db_alert
    except SQLAlchemyError:
        db.rollback()
        existing = db.query(models.Alert).filter(
            models.Alert.dedupe_key == alert.dedupe_key
        ).first()
        if existing:
            return existing
        raise


def create_alert_best_effort(db: Session, alert: schemas.AlertCreate):
    try:
        return create_alert(db, alert)
    except Exception:
        db.rollback()
        logger.exception("Could not persist alert event %s", alert.alert_type)
        return None


def create_fraud_alert(db: Session, prediction, fraud_probability: float):
    probability = float(fraud_probability)
    dedupe_key = hashlib.sha256(
        f"FRAUD_DETECTED:{prediction.prediction_id}".encode("utf-8")
    ).hexdigest()
    alert = schemas.AlertCreate(
        alert_type="FRAUD_DETECTED",
        severity="critical" if probability >= 0.90 else "high",
        message=(
            f"Transaction {prediction.transaction_id} was classified as fraudulent "
            f"by {prediction.model_id} with {probability:.2%} probability."
        ),
        dedupe_key=dedupe_key,
        transaction_id=prediction.transaction_id,
        model_id=prediction.model_id,
        fraud_probability=probability,
        source_prediction_id=prediction.prediction_id,
    )
    return create_alert_best_effort(db, alert)


def create_drift_alert(db: Session, report):
    drift_score = float(report.drift_score)
    window_end_transaction_id = (
        db.query(models.Transaction.transaction_id)
        .order_by(models.Transaction.transaction_id.desc())
        .limit(1)
        .scalar()
    )
    signature = json.dumps(
        [
            report.model_id,
            report.feature_name,
            drift_score,
            report.drift_status,
            window_end_transaction_id,
        ],
        separators=(",", ":"),
    )
    dedupe_key = hashlib.sha256(f"MODEL_DRIFT:{signature}".encode("utf-8")).hexdigest()
    alert = schemas.AlertCreate(
        alert_type="MODEL_DRIFT",
        severity="medium" if report.drift_status == "warning" else "high",
        message=(
            f"Model {report.model_id} has {report.drift_status.replace('_', ' ')} "
            f"on feature '{report.feature_name}' (PSI={drift_score:.2f})."
        ),
        dedupe_key=dedupe_key,
        model_id=report.model_id,
        feature_name=report.feature_name,
        drift_score=drift_score,
        drift_status=report.drift_status,
        source_drift_report_id=report.report_id,
    )
    return create_alert_best_effort(db, alert)


def get_alerts(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    alert_type: str = None,
    severity: str = None,
    model_id: str = None,
    transaction_id: int = None,
):
    query = db.query(models.Alert)
    if alert_type is not None:
        query = query.filter(models.Alert.alert_type == alert_type)
    if severity is not None:
        query = query.filter(models.Alert.severity == severity)
    if model_id is not None:
        query = query.filter(models.Alert.model_id == model_id)
    if transaction_id is not None:
        query = query.filter(models.Alert.transaction_id == transaction_id)
    return (
        query.order_by(models.Alert.created_at.desc(), models.Alert.alert_id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )