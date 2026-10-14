import re
from datetime import datetime
from pathlib import Path

import joblib
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from sklearn.metrics import confusion_matrix

import schemas
import database_models as db_models
from database import get_db
from ml.model import get_comparison_metrics
from ml.retraining import (
    ARTIFACT_DIR,
    DATASET_PATH,
    InsufficientTrainingDataError,
    ModelTrainingError,
    SourceModelNotFoundError,
    UnsupportedModelFamilyError,
    _load_stratified_data,
    _prepare_training_data,
    retrain_and_register,
)


router = APIRouter(
    prefix="/retrain",
    tags=["Model Retraining"]
)

RETRAINED_MODEL_ID = re.compile(
    r"(rf-balanced|xgb-boosted|lgb-fast|gb-ensemble|lr-baseline)-v([1-9][0-9]*)"
)


def _backfill_retraining_history(db: Session):
    existing_history = {
        row.model_id: row
        for row in db.query(db_models.RetrainingHistory).all()
    }
    cached_metrics = get_comparison_metrics()
    history_rows = []
    history_changed = False
    full_sample_data = None

    def get_full_sample_matrix(model_id, metrics):
        nonlocal full_sample_data
        artifact_path = Path(
            metrics.get("artifact_path") or ARTIFACT_DIR / f"{model_id}.pkl"
        )
        if not artifact_path.is_file():
            return None, None

        try:
            if full_sample_data is None:
                dataset = _load_stratified_data(DATASET_PATH, sample_non_fraud=80000)
                full_sample_data = _prepare_training_data(dataset)
            feature_frame, labels = full_sample_data
            estimator = joblib.load(artifact_path)
            predictions = estimator.predict(feature_frame)
            matrix = confusion_matrix(labels, predictions).tolist()
            return matrix, len(labels)
        except Exception:
            return None, None

    for model in db.query(db_models.Model).all():
        match = RETRAINED_MODEL_ID.fullmatch(model.model_id or "")
        if not match or int(match.group(2)) < 2:
            continue

        family = match.group(1)
        metrics = cached_metrics.get(model.model_id, {})
        holdout_matrix = metrics.get("confusion_matrix") or []
        validation_rows = metrics.get("validation_rows")
        if validation_rows is None and len(holdout_matrix) == 2:
            validation_rows = sum(sum(row) for row in holdout_matrix)
        training_rows = metrics.get("training_rows")
        if training_rows is None and validation_rows is not None:
            training_rows = int(round(validation_rows * 4))
        full_sample_matrix = metrics.get("full_sample_confusion_matrix")
        full_sample_rows = metrics.get("full_sample_rows")
        if not full_sample_matrix or full_sample_rows is None:
            computed_matrix, computed_rows = get_full_sample_matrix(model.model_id, metrics)
            full_sample_matrix = full_sample_matrix or computed_matrix
            full_sample_rows = full_sample_rows or computed_rows

        previous_history = existing_history.get(model.model_id)
        if previous_history:
            if previous_history.validation_rows is None and validation_rows is not None:
                previous_history.validation_rows = validation_rows
                history_changed = True
            if previous_history.training_rows is None and training_rows is not None:
                previous_history.training_rows = training_rows
                history_changed = True
            if previous_history.full_sample_confusion_matrix is None and full_sample_matrix is not None:
                previous_history.full_sample_confusion_matrix = full_sample_matrix
                history_changed = True
            if previous_history.full_sample_rows is None and full_sample_rows is not None:
                previous_history.full_sample_rows = full_sample_rows
                history_changed = True
            continue

        history_rows.append(
            db_models.RetrainingHistory(
                model_id=model.model_id,
                source_model_id=f"{family}-v1",
                model_name=model.model_name or model.model_id,
                model_type=metrics.get("model_type") or family,
                version=int(match.group(2)),
                training_status=metrics.get("training_status") or "completed",
                model_status=model.model_status or "evaluated",
                model_accuracy=metrics.get("model_accuracy", model.model_accuracy),
                model_precision=metrics.get("model_precision", model.model_precision),
                model_recall=metrics.get("model_recall", model.model_recall),
                model_f1_score=metrics.get("model_f1_score", model.model_f1_score),
                model_roc_auc=metrics.get("model_roc_auc", model.model_roc_auc),
                confusion_matrix=holdout_matrix,
                full_sample_confusion_matrix=full_sample_matrix,
                full_sample_rows=full_sample_rows,
                training_rows=training_rows,
                validation_rows=validation_rows,
                training_time_sec=metrics.get("training_time_sec"),
                threshold=metrics.get("threshold", 0.30),
                artifact_path=metrics.get("artifact_path"),
                retrained_at=model.model_training_time or datetime.now(),
            )
        )

    if history_rows:
        db.add_all(history_rows)
        history_changed = True
    if history_changed:
        db.commit()


@router.get(
    "/history",
    response_model=list[schemas.RetrainingHistoryResponse],
    summary="List retraining history",
)
def get_retraining_history(db: Session = Depends(get_db)):
    try:
        _backfill_retraining_history(db)
        return (
            db.query(db_models.RetrainingHistory)
            .order_by(db_models.RetrainingHistory.retrained_at.desc())
            .all()
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Retraining history could not be retrieved because the database is unavailable.",
        ) from exc


@router.post(
    "/",
    response_model=schemas.RetrainResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Retrain and register a versioned model",
    description=(
        "Retrains one selected model family from the fraud dataset, evaluates it on a stratified holdout, "
        "and saves a new evaluated model version without replacing production artifacts."
    ),
)
def retrain_model(
    request: schemas.RetrainRequest,
    db: Session = Depends(get_db),
):
    try:
        return retrain_and_register(db, request)
    except SourceModelNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source model '{exc}' was not found.",
        ) from exc
    except (UnsupportedModelFamilyError, InsufficientTrainingDataError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The configured training dataset is unavailable.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The retrained model could not be registered because the database is unavailable.",
        ) from exc
    except ModelTrainingError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
