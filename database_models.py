from sqlalchemy import Column, Integer, String, DateTime, Numeric, Boolean, UniqueConstraint
from sqlalchemy import ForeignKey
from database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String(50), unique=True, index=True)
    name = Column(String(50))
    account_type = Column(String(50))
    email = Column(String(50), unique=True, index=True)
    password_hash = Column(String(255))
    created_at = Column(DateTime)


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    sender_account_id = Column(String(50), nullable=False)
    destination_account_id = Column(String(50), nullable=False)
    step = Column(Integer)
    transaction_type = Column(String(50), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    old_balance = Column(Numeric(15, 2))
    new_balance = Column(Numeric(15, 2))
    is_fraud = Column(Boolean)


class Model(Base):
    __tablename__ = "models"

    model_id = Column(String(50), primary_key=True, index=True)
    model_name = Column(String(50))
    model_accuracy = Column(Numeric(15, 2))
    model_precision = Column(Numeric(15, 2))
    model_recall = Column(Numeric(15, 2))
    model_f1_score = Column(Numeric(15, 2))
    model_roc_auc = Column(Numeric(15, 2))
    model_status = Column(String(50))
    model_training_time = Column(DateTime)


class Fraud_prediction(Base):
    __tablename__ = "frauds"

    prediction_id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(
        Integer,
        ForeignKey("transactions.transaction_id")
    )
    model_id = Column(
        String(50),
        ForeignKey("models.model_id")
    )
    Fraud_score = Column(Numeric(15, 2))
    prediction = Column(Boolean)
    threshold = Column(Numeric(15, 2))
    prediction_time = Column(DateTime)


class drift_reports(Base):
    __tablename__ = "drift_reports"

    report_id = Column(Integer, primary_key=True, index=True)
    model_id = Column(
        String(50),
        ForeignKey("models.model_id")
    )

    feature_name = Column(String(50))
    drift_score = Column(Numeric(15, 2))
    drift_status = Column(String(50))
    checked_at = Column(DateTime)
    report_time = Column(DateTime)


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        UniqueConstraint("dedupe_key", name="uq_alerts_dedupe_key"),
        UniqueConstraint("source_prediction_id", name="uq_alerts_source_prediction"),
        UniqueConstraint("source_drift_report_id", name="uq_alerts_source_drift_report"),
    )

    alert_id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String(32), nullable=False, index=True)
    severity = Column(String(20), nullable=False)
    message = Column(String(500), nullable=False)
    transaction_id = Column(Integer, ForeignKey("transactions.transaction_id"), index=True)
    model_id = Column(String(50), ForeignKey("models.model_id"), index=True)
    fraud_probability = Column(Numeric(8, 6))
    feature_name = Column(String(50))
    drift_score = Column(Numeric(15, 6))
    drift_status = Column(String(50))
    source_prediction_id = Column(
        Integer,
        ForeignKey("frauds.prediction_id", ondelete="CASCADE"),
    )
    source_drift_report_id = Column(
        Integer,
        ForeignKey("drift_reports.report_id", ondelete="CASCADE"),
    )
    dedupe_key = Column(String(64), nullable=False)
    created_at = Column(DateTime, nullable=False, index=True)


DriftReport = drift_reports
FraudPrediction = Fraud_prediction
