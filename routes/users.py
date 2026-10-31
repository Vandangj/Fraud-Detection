from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

import crud
import schemas
import database_models as db_models
from database import get_db


router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

STAFF_TYPES = ["admin", "analyst"]


@router.post("/", response_model=schemas.UserResponse)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    return crud.create_user(db, user)


@router.get("/", response_model=list[schemas.UserResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_users(db, skip, limit)


# NOTE: /staff and /counts MUST be declared before "/{user_id}",
# otherwise FastAPI tries to parse "staff"/"counts" as an integer user_id.
@router.get(
    "/staff",
    response_model=list[schemas.UserResponse],
    summary="List admin/analyst accounts (newest first)",
)
def get_staff(
    account_type: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    # Case-insensitive: the UI stores "Admin"/"Analyst", and TiDB's default
    # collation is case-sensitive.
    role_col = func.lower(db_models.User.account_type)
    query = db.query(db_models.User)
    if account_type:
        query = query.filter(role_col == account_type.lower())
    else:
        query = query.filter(role_col.in_(STAFF_TYPES))
    return (
        query.order_by(db_models.User.user_id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get(
    "/counts",
    summary="Persistent user counts grouped by account_type",
)
def get_user_counts(db: Session = Depends(get_db)):
    role_col = func.lower(db_models.User.account_type)
    rows = (
        db.query(role_col, func.count(db_models.User.user_id))
        .group_by(role_col)
        .all()
    )
    counts = {(account_type or "unknown"): count for account_type, count in rows}
    counts["total"] = sum(counts.values())
    counts["staff"] = sum(counts.get(t, 0) for t in STAFF_TYPES)
    return counts


@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db)
):

    user = crud.get_user(db, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user


@router.put("/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    user: schemas.UserUpdate,
    db: Session = Depends(get_db)
):

    updated_user = crud.update_user(db, user_id, user)

    if not updated_user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return updated_user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db)
):

    user = crud.delete_user(db, user_id)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {"message": "User deleted successfully"}