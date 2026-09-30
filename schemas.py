from datetime import datetime
from typing import Optional

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# user

class UserCreate(BaseModel):
    account_id: str
    name: str
    account_type: str
    email: str
    password_hash: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    account_type: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None


class UserResponse(BaseModel):
    user_id: int
    account_id: Optional[str]
    name: Optional[str]
    account_type: Optional[str]
    email: Optional[str]
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# Transaction

class TransactionCreate(BaseModel):
    user_id: int = Field(gt=0)
    sender_account_id: str = Field(min_length=1, max_length=50)
    destination_account_id: str = Field(min_length=1, max_length=50)
    step: int = Field(ge=0)
    transaction_type: Literal["CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER", "CASH_IN"]
    amount: float = Field(gt=0, le=9999999999999.99, allow_inf_nan=False)
    old_balance: Optional[float] = Field(default=None, ge=0, le=9999999999999.99, allow_inf_nan=False)
    new_balance: Optional[float] = Field(default=None, ge=0, le=9999999999999.99, allow_inf_nan=False)
    is_fraud: Optional[bool] = False

    model_config = ConfigDict(extra="forbid")


class TransactionUpdate(BaseModel):
    transaction_type: Optional[Literal["CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER", "CASH_IN"]] = None
    amount: Optional[float] = Field(default=None, gt=0, le=9999999999999.99, allow_inf_nan=False)
    old_balance: Optional[float] = Field(default=None, ge=0, le=9999999999999.99, allow_inf_nan=False)
    new_balance: Optional[float] = Field(default=None, ge=0, le=9999999999999.99, allow_inf_nan=False)
    is_fraud: Optional[bool] = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def reject_null_required_fields(self):
        for field_name in ("transaction_type", "amount"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class TransactionResponse(BaseModel):
    transaction_id: int
    user_id: int
    sender_account_id: str
    destination_account_id: str
    step: Optional[int]
    transaction_type: str
    amount: float
    old_balance: Optional[float]
    new_balance: Optional[float]
    is_fraud: Optional[bool]

    model_config = ConfigDict(from_attributes=True)

# Model


class ModelCreate(BaseModel):
    model_id: str = Field(min_length=1, max_length=50)
    model_name: str = Field(min_length=1, max_length=50)
    model_accuracy: float = Field(ge=0, le=1, allow_inf_nan=False)
    model_precision: float = Field(ge=0, le=1, allow_inf_nan=False)
    model_recall: float = Field(ge=0, le=1, allow_inf_nan=False)
    model_f1_score: float = Field(ge=0, le=1, allow_inf_nan=False)
    model_roc_auc: float = Field(ge=0, le=1, allow_inf_nan=False)
    model_status: str = Field(min_length=1, max_length=50)
    model_training_time: Optional[datetime] = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ModelUpdate(BaseModel):
    model_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    model_accuracy: Optional[float] = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    model_precision: Optional[float] = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    model_recall: Optional[float] = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    model_f1_score: Optional[float] = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    model_roc_auc: Optional[float] = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    model_status: Optional[str] = Field(default=None, min_length=1, max_length=50)
    model_training_time: Optional[datetime] = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ModelResponse(BaseModel):
    model_id: str
    model_name: Optional[str]
    model_accuracy: Optional[float]
    model_precision: Optional[float]
    model_recall: Optional[float]
    model_f1_score: Optional[float]
    model_roc_auc: Optional[float]
    model_status: Optional[str]
    model_training_time: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)



# fruad detection

class FraudPredictionCreate(BaseModel):
    transaction_id: int
    model_id: str
    Fraud_score: float
    prediction: bool
    threshold: float
    prediction_time: Optional[datetime] = None


class FraudPredictionResponse(BaseModel):
    prediction_id: int
    transaction_id: Optional[int]
    model_id: Optional[str]
    Fraud_score: Optional[float]
    prediction: Optional[bool]
    threshold: Optional[float]
    prediction_time: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)



# drift reports


class DriftReportCreate(BaseModel):
    model_id: str = Field(min_length=1, max_length=50)
    feature_name: str = Field(min_length=1, max_length=50)
    drift_score: float = Field(ge=0, le=9999999999999.99, allow_inf_nan=False)
    drift_status: Literal["stable", "warning", "drift_detected"]
    checked_at: Optional[datetime] = None
    report_time: Optional[datetime] = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class DriftCheckRequest(BaseModel):
    model_id: str = Field(min_length=1, max_length=50)
    feature_name: Literal[
        "step",
        "amount",
        "old_balance",
        "oldbalanceOrg",
        "new_balance",
        "newbalanceOrig",
        "transaction_type",
        "type",
        "is_fraud",
        "balanceDiffOrig",
        "amountToOrigBalance",
        "type_CASH_IN",
        "type_CASH_OUT",
        "type_DEBIT",
        "type_PAYMENT",
        "type_TRANSFER",
    ]
    sample_size: int = Field(default=1000, ge=50, le=10000)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class DriftReportResponse(BaseModel):
    report_id: int
    model_id: Optional[str]
    feature_name: Optional[str]
    drift_score: Optional[float]
    drift_status: Optional[str]
    checked_at: Optional[datetime]
    report_time: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


AlertType = Literal["FRAUD_DETECTED", "MODEL_DRIFT"]
AlertSeverity = Literal["critical", "high", "medium"]


class AlertCreate(BaseModel):
    alert_type: AlertType
    severity: AlertSeverity
    message: str = Field(min_length=1, max_length=500)
    dedupe_key: str = Field(min_length=1, max_length=64)
    transaction_id: Optional[int] = Field(default=None, gt=0)
    model_id: Optional[str] = Field(default=None, min_length=1, max_length=50)
    fraud_probability: Optional[float] = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    feature_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    drift_score: Optional[float] = Field(default=None, ge=0, le=9999999999999.99, allow_inf_nan=False)
    drift_status: Optional[Literal["warning", "drift_detected"]] = None
    source_prediction_id: Optional[int] = Field(default=None, gt=0)
    source_drift_report_id: Optional[int] = Field(default=None, gt=0)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_event_fields(self):
        if self.alert_type == "FRAUD_DETECTED":
            required = (
                self.transaction_id,
                self.model_id,
                self.fraud_probability,
                self.source_prediction_id,
            )
        else:
            required = (
                self.model_id,
                self.feature_name,
                self.drift_score,
                self.drift_status,
                self.source_drift_report_id,
            )
        if any(value is None for value in required):
            raise ValueError("Required fields are missing for this alert type")
        return self


class AlertResponse(BaseModel):
    alert_id: int
    alert_type: AlertType
    type: AlertType = Field(validation_alias="alert_type")
    severity: AlertSeverity
    message: str
    transaction_id: Optional[int] = None
    model_id: Optional[str] = None
    fraud_probability: Optional[float] = None
    fraud_score: Optional[float] = Field(default=None, validation_alias="fraud_probability")
    feature_name: Optional[str] = None
    drift_score: Optional[float] = None
    drift_status: Optional[str] = None
    prediction_id: Optional[int] = Field(default=None, validation_alias="source_prediction_id")
    drift_report_id: Optional[int] = Field(default=None, validation_alias="source_drift_report_id")
    timestamp: datetime = Field(validation_alias="created_at")

    model_config = ConfigDict(from_attributes=True)


class ModelComparisonResponse(BaseModel):
    model_id: str
    model_name: Optional[str]
    model_accuracy: Optional[float]
    model_precision: Optional[float]
    model_recall: Optional[float]
    model_f1_score: Optional[float]
    model_roc_auc: Optional[float]
    model_status: Optional[str]
    model_training_time: Optional[datetime] = None
    latency_ms: Optional[float] = None
    training_time_sec: Optional[float] = None
    confusion_matrix: Optional[list[list[int]]] = None
    roc_points: list[dict[str, float]] = Field(default_factory=list)


class RetrainRequest(BaseModel):
    source_model_id: str = Field(min_length=1, max_length=50)
    sample_non_fraud: int = Field(default=80000, ge=100, le=250000)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RetrainResponse(BaseModel):
    model_id: str
    source_model_id: str
    model_name: str
    model_type: str
    version: int
    training_status: Literal["completed"]
    model_status: str
    model_accuracy: float
    model_precision: float
    model_recall: float
    model_f1_score: float
    model_roc_auc: float
    training_time_sec: float
    threshold: float
    artifact_path: str
    model_training_time: datetime