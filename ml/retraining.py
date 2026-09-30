import os
import re
import tempfile
import time
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

import database_models as db_models
import schemas
from ml.train_multimodel import engineer_features


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = PROJECT_ROOT / "data" / "dataset.csv"
FEATURES_PATH = PROJECT_ROOT / "models" / "features.pkl"
ARTIFACT_DIR = PROJECT_ROOT / "models" / "retrained"
PREDICTION_THRESHOLD = 0.30
CHUNK_SIZE = 200000

MODEL_FAMILIES = {
    "rf-balanced": ("RandomForestClassifier", "Random Forest"),
    "xgb-boosted": ("XGBClassifier", "XGBoost"),
    "lgb-fast": ("LGBMClassifier", "LightGBM"),
    "gb-ensemble": ("HistGradientBoostingClassifier", "Gradient Boosting"),
    "lr-baseline": ("LogisticRegression", "Logistic Regression"),
}


class SourceModelNotFoundError(ValueError):
    pass


class UnsupportedModelFamilyError(ValueError):
    pass


class InsufficientTrainingDataError(ValueError):
    pass


class ModelTrainingError(RuntimeError):
    pass


def _family_for_model_id(model_id: str):
    match = re.fullmatch(r"(.+)-v([1-9][0-9]*)", model_id)
    if not match or match.group(1) not in MODEL_FAMILIES:
        raise UnsupportedModelFamilyError(
            f"Model '{model_id}' does not use a supported retraining configuration."
        )
    return match.group(1), MODEL_FAMILIES[match.group(1)]


def _build_estimator(family: str):
    if family == "rf-balanced":
        return RandomForestClassifier(
            n_estimators=100,
            max_depth=16,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )
    if family == "xgb-boosted":
        import xgboost as xgb

        return xgb.XGBClassifier(
            n_estimators=120,
            max_depth=6,
            learning_rate=0.08,
            random_state=42,
            eval_metric="logloss",
            n_jobs=-1,
        )
    if family == "lgb-fast":
        import lightgbm as lgb

        return lgb.LGBMClassifier(
            n_estimators=120,
            max_depth=6,
            learning_rate=0.08,
            random_state=42,
            verbose=-1,
            n_jobs=-1,
        )
    if family == "gb-ensemble":
        return HistGradientBoostingClassifier(
            max_iter=100,
            max_depth=8,
            class_weight="balanced",
            random_state=42,
        )
    if family == "lr-baseline":
        return LogisticRegression(
            max_iter=1000,
            class_weight="balanced",
            random_state=42,
        )
    raise UnsupportedModelFamilyError(f"Unsupported model family '{family}'.")


def _load_stratified_data(dataset_path: Path, sample_non_fraud: int) -> pd.DataFrame:
    required_columns = {
        "step",
        "type",
        "amount",
        "oldbalanceOrg",
        "newbalanceOrig",
        "oldbalanceDest",
        "newbalanceDest",
        "isFlaggedFraud",
        "isFraud",
    }
    fraud_chunks = []
    non_fraud_chunks = []
    sampled_non_fraud = 0
    non_fraud_per_chunk = max(1, sample_non_fraud // 10)

    try:
        with pd.read_csv(dataset_path, chunksize=CHUNK_SIZE) as reader:
            for chunk in reader:
                missing = required_columns - set(chunk.columns)
                if missing:
                    raise InsufficientTrainingDataError(
                        f"Training dataset is missing required columns: {', '.join(sorted(missing))}."
                    )

                fraud_rows = chunk[chunk["isFraud"] == 1]
                if not fraud_rows.empty:
                    fraud_chunks.append(fraud_rows)

                remaining = sample_non_fraud - sampled_non_fraud
                if remaining > 0:
                    non_fraud_rows = chunk[chunk["isFraud"] == 0]
                    count = min(non_fraud_per_chunk, remaining, len(non_fraud_rows))
                    if count:
                        non_fraud_chunks.append(
                            non_fraud_rows.sample(n=count, random_state=42)
                        )
                        sampled_non_fraud += count
    except FileNotFoundError:
        raise
    except InsufficientTrainingDataError:
        raise
    except Exception as exc:
        raise InsufficientTrainingDataError(
            f"Training dataset could not be read: {exc}"
        ) from exc

    if not fraud_chunks or not non_fraud_chunks:
        raise InsufficientTrainingDataError(
            "Training data must contain both fraud and non-fraud transactions."
        )

    data = pd.concat(fraud_chunks + non_fraud_chunks, ignore_index=True)
    data["isFraud"] = pd.to_numeric(data["isFraud"], errors="coerce")
    data = data[data["isFraud"].isin([0, 1])]
    class_counts = data["isFraud"].value_counts()
    if len(class_counts) != 2 or class_counts.min() < 2:
        raise InsufficientTrainingDataError(
            "At least two usable samples from each fraud class are required."
        )
    return data


def _prepare_training_data(data: pd.DataFrame):
    try:
        expected_features = joblib.load(FEATURES_PATH)
        if not expected_features:
            raise InsufficientTrainingDataError(
                "The prediction feature list is missing or empty."
            )
        feature_frame, labels = engineer_features(data)
        feature_frame = feature_frame.reindex(columns=expected_features, fill_value=0)
        feature_frame = feature_frame.apply(pd.to_numeric, errors="coerce")
        usable = np.isfinite(feature_frame.to_numpy(dtype=float)).all(axis=1)
        feature_frame = feature_frame.loc[usable]
        labels = labels.loc[usable]
    except InsufficientTrainingDataError:
        raise
    except Exception as exc:
        raise InsufficientTrainingDataError(
            f"Training data could not be prepared with prediction features: {exc}"
        ) from exc

    if feature_frame.empty or labels.nunique() != 2:
        raise InsufficientTrainingDataError(
            "Not enough usable feature rows from both fraud classes remain after preprocessing."
        )
    return feature_frame, labels


def _next_model_version(db, family: str) -> int:
    model_ids = {
        model_id
        for (model_id,) in db.query(db_models.Model.model_id).all()
        if model_id
    }
    versions = [
        int(match.group(1))
        for model_id in model_ids
        if (match := re.fullmatch(rf"{re.escape(family)}-v([1-9][0-9]*)", model_id))
    ]
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    for path in ARTIFACT_DIR.glob(f"{family}-v*.pkl"):
        match = re.fullmatch(rf"{re.escape(family)}-v([1-9][0-9]*)\.pkl", path.name)
        if match:
            versions.append(int(match.group(1)))
    return max(versions, default=1) + 1


def retrain_and_register(db, request: schemas.RetrainRequest) -> schemas.RetrainResponse:
    started_at = time.perf_counter()
    source_model = (
        db.query(db_models.Model)
        .filter(db_models.Model.model_id == request.source_model_id)
        .first()
    )
    if source_model is None:
        raise SourceModelNotFoundError(request.source_model_id)

    family, (model_type, display_name) = _family_for_model_id(request.source_model_id)
    data = _load_stratified_data(Path(DATASET_PATH), request.sample_non_fraud)
    features, labels = _prepare_training_data(data)

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            features,
            labels,
            test_size=0.20,
            random_state=42,
            stratify=labels,
        )
    except ValueError as exc:
        raise InsufficientTrainingDataError(
            f"Not enough class-balanced data for a stratified train/test split: {exc}"
        ) from exc

    fraud_count = int((y_train == 1).sum())
    non_fraud_count = int((y_train == 0).sum())
    if fraud_count < 6 and fraud_count < non_fraud_count:
        raise InsufficientTrainingDataError(
            "At least six fraud examples are required in the training split for SMOTE."
        )

    X_fit, y_fit = X_train, y_train
    if fraud_count / max(non_fraud_count, 1) < 0.5:
        try:
            X_fit, y_fit = SMOTE(
                sampling_strategy=0.5,
                random_state=42,
            ).fit_resample(X_train, y_train)
        except ValueError as exc:
            raise InsufficientTrainingDataError(
                f"Training data is insufficient for SMOTE: {exc}"
            ) from exc

    estimator = _build_estimator(family)
    try:
        estimator.fit(X_fit, y_fit)
        probabilities = estimator.predict_proba(X_test)[:, 1]
    except Exception as exc:
        raise ModelTrainingError(f"Model training failed: {exc}") from exc

    predictions = (probabilities >= PREDICTION_THRESHOLD).astype(int)
    metrics = {
        "model_accuracy": float(accuracy_score(y_test, predictions)),
        "model_precision": float(precision_score(y_test, predictions, zero_division=0)),
        "model_recall": float(recall_score(y_test, predictions, zero_division=0)),
        "model_f1_score": float(f1_score(y_test, predictions, zero_division=0)),
        "model_roc_auc": float(roc_auc_score(y_test, probabilities)),
    }

    version = _next_model_version(db, family)
    model_id = f"{family}-v{version}"
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    artifact_path = ARTIFACT_DIR / f"{model_id}.pkl"
    reservation_path = ARTIFACT_DIR / f".{model_id}.reserve"
    try:
        reservation_fd = os.open(
            reservation_path,
            os.O_CREAT | os.O_EXCL | os.O_WRONLY,
        )
    except FileExistsError as exc:
        raise ModelTrainingError(
            "Another retraining job is registering this model version. Retry the request."
        ) from exc
    os.close(reservation_fd)

    temporary_path = None
    artifact_created = False
    try:
        with tempfile.NamedTemporaryFile(
            dir=ARTIFACT_DIR,
            prefix=f".{model_id}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
        joblib.dump(estimator, temporary_path)
        if artifact_path.exists():
            raise ModelTrainingError(f"Refusing to overwrite existing artifact '{artifact_path}'.")
        os.replace(temporary_path, artifact_path)
        temporary_path = None
        artifact_created = True

        model_name = f"{display_name} Retrained v{version}"
        training_time = datetime.now()
        result = schemas.RetrainResponse(
            model_id=model_id,
            source_model_id=request.source_model_id,
            model_name=model_name,
            model_type=model_type,
            version=version,
            training_status="completed",
            model_status="evaluated",
            **metrics,
            training_time_sec=round(time.perf_counter() - started_at, 3),
            threshold=PREDICTION_THRESHOLD,
            artifact_path=str(artifact_path),
            model_training_time=training_time,
        )
        db.add(
            db_models.Model(
                model_id=model_id,
                model_name=model_name,
                model_accuracy=metrics["model_accuracy"],
                model_precision=metrics["model_precision"],
                model_recall=metrics["model_recall"],
                model_f1_score=metrics["model_f1_score"],
                model_roc_auc=metrics["model_roc_auc"],
                model_status="evaluated",
                model_training_time=training_time,
            )
        )
        db.commit()
        return result
    except Exception:
        db.rollback()
        if artifact_created:
            artifact_path.unlink(missing_ok=True)
        raise
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        reservation_path.unlink(missing_ok=True)