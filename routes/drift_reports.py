from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from ml.drift import InsufficientDriftDataError, calculate_transaction_drift


router = APIRouter(
    prefix="/drift-reports",
    tags=["Model Drift"]
)


@router.post(
    "/",
    response_model=schemas.DriftReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a drift report",
    description="Stores a validated drift report for an existing model. Timestamps are filled automatically when omitted.",
)
def create_drift_report(
    report: schemas.DriftReportCreate,
    db: Session = Depends(get_db)
):

    try:
        if crud.get_model(db, report.model_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model not found.",
            )
        return crud.create_drift_report(db, report)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The drift report conflicts with a database constraint.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The drift report could not be saved because the database is unavailable.",
        ) from exc


@router.post(
    "/check",
    response_model=schemas.DriftReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Calculate and store drift",
    description="Compares recent transactions with the immediately preceding transaction window using PSI, then stores the report.",
)
def check_transaction_drift(
    request: schemas.DriftCheckRequest,
    db: Session = Depends(get_db),
):
    try:
        if crud.get_model(db, request.model_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model not found.",
            )

        drift_score, drift_status = calculate_transaction_drift(
            db,
            request.feature_name,
            request.sample_size,
        )
        report = schemas.DriftReportCreate(
            model_id=request.model_id,
            feature_name=request.feature_name,
            drift_score=drift_score,
            drift_status=drift_status,
        )
        return crud.create_drift_report(db, report)
    except InsufficientDriftDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The drift report conflicts with a database constraint.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Drift could not be calculated or stored because the database is unavailable.",
        ) from exc


@router.get(
    "/",
    response_model=list[schemas.DriftReportResponse],
    summary="List drift reports",
    description="Returns newest reports first with optional filters and bounded pagination.",
)
def get_drift_reports(
    skip: int = Query(default=0, ge=0, description="Number of reports to skip."),
    limit: int = Query(default=500, ge=1, le=1000, description="Maximum reports to return (1-1000)."),
    model_id: Optional[str] = Query(default=None, min_length=1, max_length=50),
    feature_name: Optional[str] = Query(default=None, min_length=1, max_length=50),
    drift_status: Optional[Literal["stable", "warning", "drift_detected"]] = None,
    db: Session = Depends(get_db)
):
    try:
        return crud.get_drift_reports(
            db,
            skip=skip,
            limit=limit,
            model_id=model_id,
            feature_name=feature_name,
            drift_status=drift_status,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Drift reports could not be retrieved because the database is unavailable.",
        ) from exc


@router.get(
    "/{report_id}",
    response_model=schemas.DriftReportResponse,
    summary="Get a drift report",
)
def get_drift_report(
    report_id: int = Path(ge=1),
    db: Session = Depends(get_db)
):
    try:
        report = crud.get_drift_report(db, report_id)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The drift report could not be retrieved because the database is unavailable.",
        ) from exc

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Drift report not found"
        )

    return report


@router.delete(
    "/{report_id}",
    summary="Delete a drift report",
)
def delete_drift_report(
    report_id: int = Path(ge=1),
    db: Session = Depends(get_db)
):
    try:
        report = crud.delete_drift_report(db, report_id)
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The drift report could not be deleted because dependent records exist.",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The drift report could not be deleted because the database is unavailable.",
        ) from exc

    if not report:
        raise HTTPException(
            status_code=404,
            detail="Drift report not found"
        )

    return {
        "message": "Drift report deleted successfully"
    }