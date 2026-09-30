from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, SessionLocal
import database_models as db_models
import crud
import schemas

from routes import (
    users,
    transactions,
    models,
    frauds,
    drift_reports,
    predict,
    retrain,
    alerts,
    tables
)

# Create database tables automatically
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Financial Fraud Detection API",
    description="API for transaction management, fraud detection and model drift monitoring",
    version="1.0.0"
)


# CORS configuration for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Startup seed function for models and drift reports
@app.on_event("startup")
def seed_initial_metadata():
    db: Session = SessionLocal()
    try:
        # Seed initial model record if empty
        if db.query(db_models.Model).count() == 0:
            initial_model = schemas.ModelCreate(
                model_id="rf-balanced-v1",
                model_name="RandomForestClassifier (SMOTE)",
                model_accuracy=0.9992,
                model_precision=0.9240,
                model_recall=0.9610,
                model_f1_score=0.9420,
                model_roc_auc=0.9850,
                model_status="active",
                model_training_time=datetime.now()
            )
            crud.create_model(db, initial_model)
            print("[Database Seed] Seeded initial Random Forest model record into MySQL.")

        # Seed initial drift report if empty
        if db.query(db_models.DriftReport).count() == 0:
            initial_drift = schemas.DriftReportCreate(
                model_id="rf-balanced-v1",
                feature_name="amountToOrigBalance",
                drift_score=0.015,
                drift_status="stable",
                report_time=datetime.now()
            )
            crud.create_drift_report(db, initial_drift)
            print("[Database Seed] Seeded initial drift report into MySQL.")
    except Exception as e:
        print(f"[Seed Warning] {e}")
    finally:
        db.close()


# Register API routers
app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(models.router)
app.include_router(frauds.router)
app.include_router(drift_reports.router)
app.include_router(predict.router)
app.include_router(retrain.router)
app.include_router(alerts.router)
app.include_router(tables.router)


@app.get("/")
def root():
    return {
        "message": "Financial Fraud Detection API is running",
        "docs": "/docs"
    }