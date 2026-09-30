from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db


router = APIRouter(
    prefix="/models",
    tags=["ML Models"]
)


@router.post(
    "/",
    response_model=schemas.ModelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a model",
    description="Stores model metadata in the models table. Metric fields must be between 0 and 1.",
)
def create_model(
    model: schemas.ModelCreate,
    db: Session = Depends(get_db)
):

    try:
        return crud.create_model(db, model)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A model with this model_id already exists or violates a database constraint.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The model could not be saved because the database is unavailable.",
        ) from exc


@router.get(
    "/",
    response_model=list[schemas.ModelResponse],
    summary="List registered models",
    description="Returns registered model metadata ordered by model_id.",
)
def get_models(db: Session = Depends(get_db)):
    try:
        return crud.get_models(db)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Models could not be retrieved because the database is unavailable.",
        ) from exc


@router.get(
    "/comparison",
    response_model=list[schemas.ModelComparisonResponse],
    summary="Compare registered models",
    description="Combines registered model status and database metrics with available benchmark metadata.",
)
def get_models_comparison(db: Session = Depends(get_db)):
    from ml.model import get_comparison_metrics

    cached_metrics = get_comparison_metrics()

    try:
        registered_models = crud.get_models(db)
        results = []
        for registered_model in registered_models:
            metrics = cached_metrics.get(registered_model.model_id, {})

            def metric_value(field_name: str):
                value = metrics.get(field_name)
                if value is None:
                    value = getattr(registered_model, field_name)
                return float(value) if value is not None else None

            results.append({
                "model_id": registered_model.model_id,
                "model_name": registered_model.model_name,
                "model_accuracy": metric_value("model_accuracy"),
                "model_precision": metric_value("model_precision"),
                "model_recall": metric_value("model_recall"),
                "model_f1_score": metric_value("model_f1_score"),
                "model_roc_auc": metric_value("model_roc_auc"),
                "model_status": registered_model.model_status,
                "model_training_time": registered_model.model_training_time,
                "latency_ms": metrics.get("latency_ms"),
                "training_time_sec": metrics.get("training_time_sec"),
                "confusion_matrix": metrics.get("confusion_matrix"),
                "roc_points": metrics.get("roc_points", []),
            })
        return results
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model comparisons could not be retrieved because the database is unavailable.",
        ) from exc


@router.get(
    "/{model_id}",
    response_model=schemas.ModelResponse,
    summary="Get model metadata",
)

def get_model(
    model_id: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db)
):
    try:
        model = crud.get_model(db, model_id)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The model could not be retrieved because the database is unavailable.",
        ) from exc

    if not model:
        raise HTTPException(
            status_code=404,
            detail="Model not found"
        )

    return model


@router.put(
    "/{model_id}",
    response_model=schemas.ModelResponse,
    summary="Update model metadata",
    description="Updates only model name, metrics, status, or training timestamp. The model_id is immutable.",
)
def update_model(
    model: schemas.ModelUpdate,
    model_id: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db)
):
    try:
        updated = crud.update_model(db, model_id, model)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The model update conflicts with a database constraint.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The model could not be updated because the database is unavailable.",
        ) from exc

    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Model not found"
        )

    return updated


@router.delete(
    "/{model_id}",
    summary="Delete model metadata",
    description="Deletes a model only when no fraud predictions or drift reports reference it.",
)
def delete_model(
    model_id: str = Path(min_length=1, max_length=50),
    db: Session = Depends(get_db)
):
    try:
        model = crud.delete_model(db, model_id)
    except crud.ModelInUseError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Model cannot be deleted while fraud predictions or drift reports reference it.",
        ) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Model cannot be deleted while dependent records exist.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The model could not be deleted because the database is unavailable.",
        ) from exc

    if not model:
        raise HTTPException(
            status_code=404,
            detail="Model not found"
        )

    return {
        "message": "Model deleted successfully"
    }