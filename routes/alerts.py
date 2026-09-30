from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db


router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)


@router.get(
    "/",
    response_model=list[schemas.AlertResponse],
    summary="List persisted fraud and drift alerts",
)
def get_alerts(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    alert_type: Optional[Literal["FRAUD_DETECTED", "MODEL_DRIFT"]] = None,
    severity: Optional[Literal["critical", "high", "medium"]] = None,
    model_id: Optional[str] = Query(default=None, min_length=1, max_length=50),
    transaction_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
):
    try:
        return crud.get_alerts(
            db,
            skip=skip,
            limit=limit,
            alert_type=alert_type,
            severity=severity,
            model_id=model_id,
            transaction_id=transaction_id,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Alerts could not be retrieved because the database is unavailable.",
        ) from exc
