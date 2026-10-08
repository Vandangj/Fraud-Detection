# Fraud Detection System

A full-stack financial fraud detection application that combines a FastAPI backend, MySQL database, machine learning model pipeline, and a React dashboard for monitoring fraud transactions, model performance, drift, and retraining workflows.

## Overview

This project is designed to:

- detect potentially fraudulent transactions using trained ML models
- store historical transaction and model metadata in MySQL
- monitor model drift and alert on performance changes
- expose APIs for predictions, retraining, fraud insights, and dashboard data
- present results through a Vite + React frontend

## Tech Stack

- Backend: FastAPI, SQLAlchemy, PyMySQL
- Frontend: React, Vite
- Database: MySQL
- ML: scikit-learn, XGBoost, LightGBM, imbalanced-learn, pandas, numpy
- Environment: Python + Node.js

## Project Structure

- `main.py` — FastAPI app entry point and router registration
- `database.py` — database engine and session configuration
- `database_models.py` — SQLAlchemy model definitions
- `crud.py` — database CRUD logic
- `schemas.py` — Pydantic request/response models
- `load_dataset.py` — dataset import utility for populating MySQL
- `ml/` — model loading, prediction, training, evaluating, and retraining logic
- `routes/` — API endpoints for users, transactions, frauds, predictions, drift, alerts, and retraining
- `frontend/` — React application for the dashboard UI
- `data/dataset.csv` — source transaction dataset
- `tests/` — test coverage for retraining logic

## Features

- transaction and user management
- real-time fraud prediction API
- model comparison and active model tracking
- model drift reporting and monitoring
- alert generation for anomalous transactions and drift events
- dashboard pages for overview, transactions, cases, drift monitoring, admin users, and model health
- retraining workflow for updating model artifacts

## Prerequisites

Before running the project, make sure you have:

- Python 3.10+
- Node.js 18+
- MySQL Server running locally or remotely

If your database does not exist yet, create it first:

```sql
CREATE DATABASE fraud_detection;
```

## Installation

### 1) Backend

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2) Frontend

```bash
cd frontend
npm install
```

## Running the Application

### Start the FastAPI backend

From the project root:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API documentation will be available at:

- http://localhost:8000/docs
- http://localhost:8000/redoc

### Start the React frontend

```bash
cd frontend
npm run dev
```

Then open:

- http://localhost:5173

## Loading Data

To import the dataset into MySQL:

```bash
python load_dataset.py
```

The app also seeds initial model metadata and a drift report automatically when the backend starts if the database is empty.

## Model Training and Retraining

The ML logic lives in the `ml/` package. You can train or retrain models using the built-in scripts under that folder, and the API exposes retraining endpoints through `routes/retrain.py`.

## API Highlights

Common endpoints include:

- `/` — health and API entry point
- `/users` — user management
- `/transactions` — transaction listing and management
- `/predict` — fraud prediction requests
- `/models` — model metadata and lifecycle endpoints
- `/drift-reports` — drift monitoring
- `/alerts` — alert data
- `/tables` — table metadata and data access endpoints

## Notes

- The frontend is configured for local development and expects the backend on `localhost:8000`.
- CORS is enabled for the Vite frontend at `http://localhost:5173`.
- This project is suitable for learning, demonstration, and further extension into a production-ready fraud monitoring system.

## License

This project does not currently include a formal license file. Use it for educational and internal demonstration purposes unless otherwise specified by the repository owner.
