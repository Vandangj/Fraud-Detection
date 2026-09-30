import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import database_models as db_models
import ml.model as model_registry
import ml.retraining as retraining
import routes.retrain as retrain_route
from database import Base
from schemas import RetrainRequest, RetrainResponse


PRODUCTION_MODEL_IDS = (
    "rf-balanced-v1",
    "xgb-boosted-v1",
    "lgb-fast-v1",
    "gb-ensemble-v1",
    "lr-baseline-v1",
)


class RetrainingTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.dataset_path = self.root / "training.csv"
        self.features_path = self.root / "features.pkl"
        self.artifact_dir = self.root / "retrained"
        self.artifact_dir.mkdir()

        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self._seed_models()
        self._write_dataset(fraud_rows=60, non_fraud_rows=200)
        joblib.dump(joblib.load(Path("models/features.pkl")), self.features_path)

        self.patches = [
            patch.object(retraining, "DATASET_PATH", self.dataset_path),
            patch.object(retraining, "FEATURES_PATH", self.features_path),
            patch.object(retraining, "ARTIFACT_DIR", self.artifact_dir),
        ]
        for active_patch in self.patches:
            active_patch.start()

    def tearDown(self):
        for active_patch in reversed(self.patches):
            active_patch.stop()
        self.session.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def _seed_models(self):
        for model_id in PRODUCTION_MODEL_IDS:
            self.session.add(
                db_models.Model(
                    model_id=model_id,
                    model_name=f"Original {model_id}",
                    model_accuracy=0.91,
                    model_precision=0.92,
                    model_recall=0.93,
                    model_f1_score=0.94,
                    model_roc_auc=0.95,
                    model_status="active",
                )
            )
        self.session.commit()

    def _write_dataset(self, fraud_rows, non_fraud_rows):
        rows = []
        for label, count in ((0, non_fraud_rows), (1, fraud_rows)):
            for index in range(count):
                amount = 100.0 + index if label == 0 else 1000.0 + index
                rows.append(
                    {
                        "step": index,
                        "type": "PAYMENT" if label == 0 else "TRANSFER",
                        "amount": amount,
                        "nameOrig": f"origin-{label}-{index}",
                        "oldbalanceOrg": amount * 2,
                        "newbalanceOrig": amount,
                        "nameDest": f"destination-{label}-{index}",
                        "oldbalanceDest": amount,
                        "newbalanceDest": amount * 2,
                        "isFraud": label,
                        "isFlaggedFraud": 0,
                    }
                )
        pd.DataFrame(rows).to_csv(self.dataset_path, index=False)

    def _request(self, model_id="lr-baseline-v1", **kwargs):
        return RetrainRequest(source_model_id=model_id, sample_non_fraud=100, **kwargs)

    def test_retrains_registers_new_version_without_changing_production(self):
        production_artifacts = {
            name: hashlib.sha256((Path("models") / name).read_bytes()).hexdigest()
            for name in (
                "rf_model.pkl",
                "xgb_model.pkl",
                "lgb_model.pkl",
                "gb_model.pkl",
                "lr_model.pkl",
            )
        }
        before = {
            model.model_id: (
                model.model_name,
                float(model.model_accuracy),
                model.model_status,
            )
            for model in self.session.query(db_models.Model).all()
        }

        result = retrain_route.retrain_model(self._request(), self.session)

        self.assertEqual(result.model_id, "lr-baseline-v2")
        self.assertEqual(result.model_status, "evaluated")
        self.assertEqual(result.training_status, "completed")
        self.assertTrue(Path(result.artifact_path).is_file())
        validated = RetrainResponse.model_validate(result.model_dump())
        self.assertEqual(validated.model_id, result.model_id)
        registered = self.session.get(db_models.Model, result.model_id)
        self.assertIsNotNone(registered)
        self.assertAlmostEqual(float(registered.model_accuracy), result.model_accuracy, places=2)

        after = {
            model.model_id: (
                model.model_name,
                float(model.model_accuracy),
                model.model_status,
            )
            for model in self.session.query(db_models.Model).all()
            if model.model_id in PRODUCTION_MODEL_IDS
        }
        self.assertEqual(after, before)
        self.assertEqual(
            {
                name: hashlib.sha256((Path("models") / name).read_bytes()).hexdigest()
                for name in production_artifacts
            },
            production_artifacts,
        )

        with patch.object(model_registry, "RETRAINED_MODELS_DIR", self.artifact_dir):
            loaded_model = model_registry.get_model(result.model_id)
            self.assertEqual(loaded_model.n_features_in_, len(joblib.load(self.features_path)))
            self.assertIn(result.model_id, model_registry.get_available_models())
        model_registry._loaded_models.pop(result.model_id, None)

    def test_unknown_source_model_returns_404(self):
        with self.assertRaises(HTTPException) as raised:
            retrain_route.retrain_model(self._request("unknown-v1"), self.session)
        self.assertEqual(raised.exception.status_code, 404)
        self.assertEqual(self.session.query(db_models.Model).count(), len(PRODUCTION_MODEL_IDS))

    def test_all_production_models_have_retraining_configurations(self):
        expected_families = {
            "rf-balanced-v1": "rf-balanced",
            "xgb-boosted-v1": "xgb-boosted",
            "lgb-fast-v1": "lgb-fast",
            "gb-ensemble-v1": "gb-ensemble",
            "lr-baseline-v1": "lr-baseline",
        }
        for model_id, expected_family in expected_families.items():
            with self.subTest(model_id=model_id):
                family, _ = retraining._family_for_model_id(model_id)
                self.assertEqual(family, expected_family)

    def test_insufficient_training_data_returns_422_without_registration(self):
        self._write_dataset(fraud_rows=0, non_fraud_rows=200)

        with self.assertRaises(HTTPException) as raised:
            retrain_route.retrain_model(self._request(), self.session)

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(self.session.query(db_models.Model).count(), len(PRODUCTION_MODEL_IDS))
        self.assertEqual(list(self.artifact_dir.glob("*.pkl")), [])

    def test_malformed_training_data_returns_422_without_registration(self):
        pd.DataFrame({"step": [1, 2], "isFraud": [0, 1]}).to_csv(
            self.dataset_path,
            index=False,
        )

        with self.assertRaises(HTTPException) as raised:
            retrain_route.retrain_model(self._request(), self.session)

        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(self.session.query(db_models.Model).count(), len(PRODUCTION_MODEL_IDS))
        self.assertEqual(list(self.artifact_dir.iterdir()), [])

    def test_training_failure_does_not_register_model_or_leave_artifact(self):
        class BrokenEstimator:
            def fit(self, X, y):
                raise RuntimeError("controlled training failure")

        with patch.object(retraining, "_build_estimator", return_value=BrokenEstimator()):
            with self.assertRaises(HTTPException) as raised:
                retrain_route.retrain_model(self._request(), self.session)

        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(self.session.query(db_models.Model).count(), len(PRODUCTION_MODEL_IDS))
        self.assertEqual(list(self.artifact_dir.iterdir()), [])

    def test_concurrent_artifact_collision_is_not_deleted(self):
        existing_artifact = self.artifact_dir / "lr-baseline-v2.pkl"
        expected_contents = b"artifact created by another worker"

        def create_colliding_artifact(estimator, path):
            Path(path).write_bytes(b"temporary artifact")
            existing_artifact.write_bytes(expected_contents)

        with (
            patch.object(retraining, "_next_model_version", return_value=2),
            patch.object(retraining.joblib, "dump", side_effect=create_colliding_artifact),
        ):
            with self.assertRaises(HTTPException) as raised:
                retrain_route.retrain_model(self._request(), self.session)

        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(existing_artifact.read_bytes(), expected_contents)
        self.assertEqual(self.session.query(db_models.Model).count(), len(PRODUCTION_MODEL_IDS))
        self.assertEqual(
            {path.name for path in self.artifact_dir.iterdir()},
            {existing_artifact.name},
        )

    def test_request_validation_and_openapi_contract(self):
        with self.assertRaises(ValidationError):
            RetrainRequest(source_model_id="", sample_non_fraud=100)
        with self.assertRaises(ValidationError):
            RetrainRequest(source_model_id="rf-balanced-v1", sample_non_fraud=1)
        with self.assertRaises(ValidationError):
            RetrainRequest(source_model_id="rf-balanced-v1", unexpected=True)

        app = FastAPI()
        app.include_router(retrain_route.router)
        operation = app.openapi()["paths"]["/retrain/"]["post"]
        request_ref = operation["requestBody"]["content"]["application/json"]["schema"]["$ref"]
        request_name = request_ref.rsplit("/", 1)[-1]
        request_schema = app.openapi()["components"]["schemas"][request_name]
        response_ref = operation["responses"]["201"]["content"]["application/json"]["schema"]["$ref"]
        response_name = response_ref.rsplit("/", 1)[-1]
        response_schema = app.openapi()["components"]["schemas"][response_name]
        self.assertIn("source_model_id", request_schema["required"])
        self.assertIn("model_id", response_schema["required"])
        self.assertIn("artifact_path", response_schema["required"])
        self.assertIn("model_roc_auc", response_schema["required"])


if __name__ == "__main__":
    unittest.main()