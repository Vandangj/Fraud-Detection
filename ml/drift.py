from typing import Iterable

import numpy as np
from sqlalchemy.orm import Session

import database_models as db_models


SUPPORTED_FEATURES = {
    "step": ("step", "numeric"),
    "amount": ("amount", "numeric"),
    "old_balance": ("old_balance", "numeric"),
    "oldbalanceOrg": ("old_balance", "numeric"),
    "new_balance": ("new_balance", "numeric"),
    "newbalanceOrig": ("new_balance", "numeric"),
    "transaction_type": ("transaction_type", "categorical"),
    "type": ("transaction_type", "categorical"),
    "is_fraud": ("is_fraud", "categorical"),
    "balanceDiffOrig": ("balanceDiffOrig", "numeric"),
    "amountToOrigBalance": ("amountToOrigBalance", "numeric"),
    "type_CASH_IN": ("type_CASH_IN", "categorical"),
    "type_CASH_OUT": ("type_CASH_OUT", "categorical"),
    "type_DEBIT": ("type_DEBIT", "categorical"),
    "type_PAYMENT": ("type_PAYMENT", "categorical"),
    "type_TRANSFER": ("type_TRANSFER", "categorical"),
}


class InsufficientDriftDataError(ValueError):
    pass


def _clean_values(values: Iterable) -> list:
    cleaned = []
    for value in values:
        if value is None:
            continue
        try:
            if not np.isfinite(value):
                continue
        except TypeError:
            pass
        cleaned.append(value)
    return cleaned


def _population_stability_index(
    reference: list,
    current: list,
    categorical: bool,
) -> float:
    if len(reference) < 2 or len(current) < 2:
        raise InsufficientDriftDataError(
            "At least two non-null reference and current values are required."
        )

    if categorical:
        categories = sorted(set(reference) | set(current), key=str)
        reference_counts = np.array(
            [sum(value == category for value in reference) for category in categories],
            dtype=float,
        )
        current_counts = np.array(
            [sum(value == category for value in current) for category in categories],
            dtype=float,
        )
    else:
        reference_values = np.asarray(reference, dtype=float)
        current_values = np.asarray(current, dtype=float)

        if np.all(reference_values == reference_values[0]):
            reference_value = reference_values[0]
            if np.all(current_values == reference_value):
                return 0.0
            reference_bins = np.ones(len(reference_values), dtype=int)
            current_bins = np.where(
                current_values < reference_value,
                0,
                np.where(current_values > reference_value, 2, 1),
            )
            bin_count = 3
        else:
            quantile_edges = np.unique(
                np.quantile(reference_values, np.linspace(0, 1, 11))
            )
            boundaries = (quantile_edges[:-1] + quantile_edges[1:]) / 2
            reference_bins = np.digitize(reference_values, boundaries)
            current_bins = np.digitize(current_values, boundaries)
            bin_count = len(boundaries) + 1

        reference_counts = np.bincount(reference_bins, minlength=bin_count).astype(float)
        current_counts = np.bincount(current_bins, minlength=bin_count).astype(float)

    epsilon = 1e-6
    expected = np.clip(reference_counts / len(reference), epsilon, None)
    actual = np.clip(current_counts / len(current), epsilon, None)
    expected /= expected.sum()
    actual /= actual.sum()

    score = np.sum((actual - expected) * np.log(actual / expected))
    return max(0.0, float(score))


def classify_drift(score: float) -> str:
    if score < 0.10:
        return "stable"
    if score < 0.25:
        return "warning"
    return "drift_detected"


def _extract_feature(row, feature_name: str):
    feature = SUPPORTED_FEATURES[feature_name][0]
    transaction_type = row.transaction_type

    if feature in {"step", "amount", "old_balance", "new_balance", "transaction_type", "is_fraud"}:
        return getattr(row, feature)
    if feature == "balanceDiffOrig":
        if row.old_balance is None or row.new_balance is None:
            return None
        return float(row.old_balance - row.new_balance)
    if feature == "amountToOrigBalance":
        if row.amount is None or row.old_balance is None:
            return None
        return float(row.amount / (row.old_balance + 1))
    return int(transaction_type == feature.removeprefix("type_"))


def calculate_transaction_drift(
    db: Session,
    feature_name: str,
    sample_size: int = 1000,
) -> tuple[float, str]:
    """Compare the latest transaction window with the immediately preceding window."""
    if feature_name not in SUPPORTED_FEATURES:
        raise ValueError(f"Unsupported drift feature: {feature_name}")

    transaction_columns = (
        db_models.Transaction.transaction_id,
        db_models.Transaction.step,
        db_models.Transaction.amount,
        db_models.Transaction.old_balance,
        db_models.Transaction.new_balance,
        db_models.Transaction.transaction_type,
        db_models.Transaction.is_fraud,
    )
    current_rows = (
        db.query(*transaction_columns)
        .order_by(db_models.Transaction.transaction_id.desc())
        .limit(sample_size)
        .all()
    )
    if len(current_rows) < 2:
        raise InsufficientDriftDataError(
            "At least two recent transactions are required to calculate drift."
        )

    oldest_current_id = current_rows[-1].transaction_id
    reference_rows = (
        db.query(*transaction_columns)
        .filter(db_models.Transaction.transaction_id < oldest_current_id)
        .order_by(db_models.Transaction.transaction_id.desc())
        .limit(sample_size)
        .all()
    )

    reference_values = _clean_values(
        _extract_feature(row, feature_name) for row in reference_rows
    )
    current_values = _clean_values(
        _extract_feature(row, feature_name) for row in current_rows
    )
    categorical = SUPPORTED_FEATURES[feature_name][1] == "categorical"
    raw_score = _population_stability_index(
        reference_values,
        current_values,
        categorical,
    )

    # The existing MySQL drift_score column stores two decimal places.
    score = round(raw_score, 2)
    return score, classify_drift(score)