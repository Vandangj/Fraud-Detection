from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import schemas
from database import get_db
from ml.retraining import (
    InsufficientTrainingDataError,
    ModelTrainingError,
    SourceModelNotFoundError,
    UnsupportedModelFamilyError,
    retrain_and_register,
)


router = APIRouter(
    prefix="/retrain",
    tags=["Model Retraining"]
)


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
