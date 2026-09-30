import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report
)

from imblearn.over_sampling import SMOTE


# ==========================================
# 1. LOAD DATASET
# ==========================================

DATA_PATH = "data/dataset.csv"

df = pd.read_csv(DATA_PATH)

print("Dataset Shape:", df.shape)
print("\nFraud Distribution:")
print(df["isFraud"].value_counts())


# ==========================================
# 2. REMOVE UNNECESSARY COLUMNS
# ==========================================

df = df.drop(
    columns=["nameOrig", "nameDest"]
)


# ==========================================
# 3. FEATURE ENGINEERING
# ==========================================

df["balanceDiffOrig"] = (
    df["oldbalanceOrg"] - df["newbalanceOrig"]
)

df["balanceDiffDest"] = (
    df["newbalanceDest"] - df["oldbalanceDest"]
)

df["amountToOrigBalance"] = (
    df["amount"] /
    (df["oldbalanceOrg"] + 1)
)

df["amountToDestBalance"] = (
    df["amount"] /
    (df["oldbalanceDest"] + 1)
)


# ==========================================
# 4. ENCODE TRANSACTION TYPE
# ==========================================

df = pd.get_dummies(
    df,
    columns=["type"],
    drop_first=True
)


# ==========================================
# 5. SEPARATE FEATURES AND TARGET
# ==========================================

X = df.drop(columns=["isFraud"])

y = df["isFraud"]


print("\nFeatures:")
print(X.columns.tolist())


# ==========================================
# 6. TRAIN TEST SPLIT
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))


# ==========================================
# 7. APPLY SMOTE
# ==========================================

print("\nApplying SMOTE...")

smote = SMOTE(
    sampling_strategy=0.5,
    random_state=42
)

X_train_smote, y_train_smote = smote.fit_resample(
    X_train,
    y_train
)

print("Before SMOTE:")
print(y_train.value_counts())

print("\nAfter SMOTE:")
print(y_train_smote.value_counts())


# ==========================================
# 8. RANDOM FOREST
# ==========================================

print("\nTraining Random Forest...")

model = RandomForestClassifier(
    n_estimators=100,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)

model.fit(
    X_train_smote,
    y_train_smote
)

print("Model training completed.")


# ==========================================
# 9. PREDICT PROBABILITIES
# ==========================================

y_probability = model.predict_proba(
    X_test
)[:, 1]


# ==========================================
# 10. THRESHOLD
# ==========================================

threshold = 0.30

y_prediction = (
    y_probability >= threshold
).astype(int)


# ==========================================
# 11. EVALUATION
# ==========================================

accuracy = accuracy_score(
    y_test,
    y_prediction
)

precision = precision_score(
    y_test,
    y_prediction,
    zero_division=0
)

recall = recall_score(
    y_test,
    y_prediction,
    zero_division=0
)

f1 = f1_score(
    y_test,
    y_prediction,
    zero_division=0
)

roc_auc = roc_auc_score(
    y_test,
    y_probability
)


print("\n================================")
print("MODEL RESULTS")
print("================================")

print(f"Accuracy  : {accuracy:.4f}")
print(f"Precision : {precision:.4f}")
print(f"Recall    : {recall:.4f}")
print(f"F1 Score  : {f1:.4f}")
print(f"ROC-AUC   : {roc_auc:.4f}")

print("\nConfusion Matrix:")
print(confusion_matrix(
    y_test,
    y_prediction
))

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        y_prediction,
        zero_division=0
    )
)


# ==========================================
# 12. SAVE MODEL
# ==========================================

joblib.dump(
    model,
    "models/model.pkl"
)

joblib.dump(
    X_train.columns.tolist(),
    "models/features.pkl"
)

joblib.dump(
    threshold,
    "models/threshold.pkl"
)

print("\nModel saved successfully.")