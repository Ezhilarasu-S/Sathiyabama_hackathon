import pandas as pd
import numpy as np
import joblib
import json
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split

def train_crop_model():
    print("Training Crop Recommendation Model...")
    data = pd.read_csv("Crop_recommendation.csv")
    le = LabelEncoder()
    data['label'] = le.fit_transform(data['label'])
    X = data.drop('label', axis=1)
    y = data['label']
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X, y)
    joblib.dump(model, "crop_model.pkl")
    joblib.dump(le, "label_encoder.pkl")
    print("Crop Model Saved.")

def train_risk_model():
    print("Training Climate Risk Model...")
    df = pd.read_csv("dataset.csv")
    df.columns = df.columns.str.strip()
    
    # Create risk labels
    risk_score = (
        (df['temp_anomaly'] > 1.5).astype(int) * 2 +
        (df['wind_speed'] > 10).astype(int) * 1.5 +
        (df['precip_accum'] > 15).astype(int) * 1.5 +
        (df['pressure'] < 1000).astype(int) * 2 +
        (df['humidity'] > 85).astype(int)
    )
    df['risk_level'] = pd.cut(
        risk_score,
        bins=[-1, 1.5, 3.5, 100],
        labels=[0, 1, 2]
    ).astype(int)
    
    X = df.drop("risk_level", axis=1)
    y = df["risk_level"]
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_scaled, y)
    
    joblib.dump(model, "random_forest_model.pkl")
    joblib.dump(scaler, "scaler.pkl")
    
    metadata = {
        "model_type": "Random Forest Climate Risk Classifier",
        "features": list(X.columns),
        "classes": ["Low", "Medium", "High"]
    }
    with open("model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)
    print("Climate Risk Model Saved.")

if __name__ == "__main__":
    train_crop_model()
    train_risk_model()
