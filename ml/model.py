import os
import json
import re
import joblib
import numpy as np
from pathlib import Path

os.makedirs("models", exist_ok=True)

MODEL_PATH = "models/model.pkl"
FEATURES_PATH = "models/features.pkl"
THRESHOLD_PATH = "models/threshold.pkl"
METRICS_PATH = "models/metrics_comparison.json"
RETRAINED_MODELS_DIR = Path(__file__).resolve().parents[1] / "models" / "retrained"
RETRAINED_MODEL_ID = re.compile(
    r"(?:rf-balanced|xgb-boosted|lgb-fast|gb-ensemble|lr-baseline)-v[1-9][0-9]*"
)

# Load primary baseline for backward compatibility
try:
    model = joblib.load(MODEL_PATH)
except Exception:
    model = None

try:
    features = joblib.load(FEATURES_PATH)
except Exception:
    features = []

try:
    threshold = float(joblib.load(THRESHOLD_PATH))
except Exception:
    threshold = 0.30

# Model registry paths
MODEL_FILES = {
    "rf-balanced-v1": "models/rf_model.pkl",
    "xgb-boosted-v1": "models/xgb_model.pkl",
    "lgb-fast-v1": "models/lgb_model.pkl",
    "gb-ensemble-v1": "models/gb_model.pkl",
    "lr-baseline-v1": "models/lr_model.pkl",
}

# Cache for loaded model instances
_loaded_models = {}
if model is not None:
    _loaded_models["rf-balanced-v1"] = model


def get_model(model_id: str = "rf-balanced-v1"):
    """Fetch or lazy-load model by model_id."""
    if model_id in _loaded_models:
        return _loaded_models[model_id]

    file_path = MODEL_FILES.get(model_id)
    if file_path is None and RETRAINED_MODEL_ID.fullmatch(model_id):
        file_path = str(RETRAINED_MODELS_DIR / f"{model_id}.pkl")
    if not file_path or not os.path.exists(file_path):
        if RETRAINED_MODEL_ID.fullmatch(model_id):
            return None
        # Fall back to default primary model
        return model

    try:
        loaded = joblib.load(file_path)
        _loaded_models[model_id] = loaded
        return loaded
    except Exception as e:
        print(f"[Model Registry] Failed to load {model_id} from {file_path}: {e}")
        return model


def get_available_models():
    """List available model IDs that have existing model artifact files."""
    available = []
    for m_id, fpath in MODEL_FILES.items():
        if os.path.exists(fpath):
            available.append(m_id)
    if RETRAINED_MODELS_DIR.exists():
        available.extend(
            path.stem
            for path in RETRAINED_MODELS_DIR.glob("*.pkl")
            if RETRAINED_MODEL_ID.fullmatch(path.stem)
        )
    if not available and model is not None:
        available.append("rf-balanced-v1")
    return available


def get_comparison_metrics():
    """Load precomputed multi-model benchmark metrics from JSON."""
    comparison_metrics = {}
    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, "r") as f:
                comparison_metrics.update(json.load(f))
        except Exception:
            pass

    if RETRAINED_MODELS_DIR.exists():
        for metadata_path in RETRAINED_MODELS_DIR.glob("*.json"):
            if not RETRAINED_MODEL_ID.fullmatch(metadata_path.stem):
                continue
            try:
                with metadata_path.open("r", encoding="utf-8") as metadata_file:
                    comparison_metrics[metadata_path.stem] = json.load(metadata_file)
            except (OSError, json.JSONDecodeError):
                continue

    return comparison_metrics


def predict_fraud(data, model_id: str = "rf-balanced-v1"):
    """Predict fraud probability and label using the specified model."""
    selected = get_model(model_id)
    if selected is None:
        raise ValueError(f"No model available for ID '{model_id}'")

    probability = selected.predict_proba(data)[:, 1]
    prediction = (probability >= threshold).astype(int)
    return prediction, probability


def explain_tree_prediction(selected_model, data):
    """Return class-1 TreeSHAP base value and feature contributions."""
    import shap

    explainer = shap.TreeExplainer(selected_model)
    values = explainer.shap_values(data)
    expected_value = np.asarray(explainer.expected_value)

    if isinstance(values, list):
        values = values[1] if len(values) > 1 else values[0]
    values = np.asarray(values)
    if values.ndim == 3:
        values = values[:, :, 1] if values.shape[2] > 1 else values[:, :, 0]
    if values.ndim == 2:
        values = values[0]

    if expected_value.ndim > 0:
        expected_value = expected_value[1] if expected_value.size > 1 else expected_value.flat[0]

    return float(expected_value), values.astype(float).tolist()


def predict_all_models(data):
    """Run prediction across all available models for comparative results."""
    results = {}
    for m_id in get_available_models():
        try:
            m = get_model(m_id)
            prob = float(m.predict_proba(data)[0][1])
            pred = bool(prob >= threshold)
            results[m_id] = {
                "model_id": m_id,
                "fraud_probability": round(prob, 4),
                "prediction": pred,
                "threshold": threshold
            }
        except Exception as e:
            results[m_id] = {
                "model_id": m_id,
                "error": str(e)
            }
    return results