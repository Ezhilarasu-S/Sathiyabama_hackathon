from flask import Flask, request, jsonify, send_from_directory
import pandas as pd
import numpy as np
import joblib
import os
import json
import google.generativeai as genai
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split

app = Flask(__name__, static_folder='dist')

# Gemini AI Setup
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = None

# --- ML Model Training (Auto-run if missing) ---
def train_models():
    print("Training models...")
    # 1. Crop Recommendation Model
    try:
        # Create dummy data if CSV missing
        if not os.path.exists("Crop_recommendation.csv"):
            data = {
                'N': np.random.randint(0, 140, 100),
                'P': np.random.randint(0, 140, 100),
                'K': np.random.randint(0, 140, 100),
                'temperature': np.random.uniform(10, 40, 100),
                'humidity': np.random.uniform(20, 100, 100),
                'ph': np.random.uniform(4, 9, 100),
                'rainfall': np.random.uniform(20, 300, 100),
                'label': np.random.choice(['rice', 'maize', 'wheat', 'cotton'], 100)
            }
            pd.DataFrame(data).to_csv("Crop_recommendation.csv", index=False)
        
        df = pd.read_csv("Crop_recommendation.csv")
        le = LabelEncoder()
        df['label'] = le.fit_transform(df['label'])
        X = df.drop('label', axis=1)
        y = df['label']
        m = RandomForestClassifier(n_estimators=10, random_state=42)
        m.fit(X, y)
        joblib.dump(m, "crop_model.pkl")
        joblib.dump(le, "label_encoder.pkl")
        print("Crop model trained.")
    except Exception as e:
        print(f"Crop training failed: {e}")

    # 2. Climate Risk Model
    try:
        data = {
            'temp_anomaly': np.random.uniform(-2, 5, 100),
            'pressure': np.random.uniform(950, 1050, 100),
            'humidity': np.random.uniform(30, 90, 100),
            'wind_speed': np.random.uniform(0, 50, 100),
            'precip_accum': np.random.uniform(0, 20, 100),
            'risk': np.random.choice([0, 1, 2], 100) # 0: Low, 1: Med, 2: High
        }
        df_risk = pd.DataFrame(data)
        X_risk = df_risk.drop('risk', axis=1)
        y_risk = df_risk['risk']
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_risk)
        m_risk = RandomForestClassifier(n_estimators=10, random_state=42)
        m_risk.fit(X_scaled, y_risk)
        joblib.dump(m_risk, "random_forest_model.pkl")
        joblib.dump(scaler, "scaler.pkl")
        print("Risk model trained.")
    except Exception as e:
        print(f"Risk training failed: {e}")

# Load or Train
if not all(os.path.exists(f) for f in ["crop_model.pkl", "label_encoder.pkl", "random_forest_model.pkl", "scaler.pkl"]):
    train_models()

crop_model = joblib.load("crop_model.pkl")
crop_le = joblib.load("label_encoder.pkl")
risk_model = joblib.load("random_forest_model.pkl")
risk_scaler = joblib.load("scaler.pkl")

@app.route('/api/gemini/chat', methods=['POST'])
def gemini_chat():
    if not model:
        return jsonify({"error": "Gemini API key not configured"}), 500
    data = request.json
    message = data.get("message")
    context = data.get("context", "")
    try:
        prompt = f"System: You are CRACSE AI, a specialist in Indian agriculture and climate risk. Provide actionable, scientific, and localized advice for farmers.\nContext: {context}\n\nUser Question: {message}"
        response = model.generate_content(prompt)
        return jsonify({"text": response.text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict/crop', methods=['POST'])
def predict_crop():
    data = request.json
    try:
        n = float(data.get('n', 90))
        p = float(data.get('p', 42))
        k = float(data.get('k', 43))
        temp = float(data.get('temperature', 25.0))
        hum = float(data.get('humidity', 80.0))
        ph = float(data.get('ph', 6.5))
        rain = float(data.get('rainfall', 200.0))
        sample = np.array([[n, p, k, temp, hum, ph, rain]])
        prediction = crop_model.predict(sample)
        crop_name = crop_le.inverse_transform(prediction)[0]
        return jsonify({"crop": crop_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/predict/risk', methods=['POST'])
def predict_risk():
    data = request.json
    try:
        temp_anom = float(data.get('temp_anomaly', 0.0))
        pres = float(data.get('pressure', 1013.0))
        hum = float(data.get('humidity', 60.0))
        wind = float(data.get('wind_speed', 10.0))
        precip = float(data.get('precip_accum', 0.0))
        input_data = pd.DataFrame({
            'temp_anomaly': [temp_anom],
            'pressure': [pres],
            'humidity': [hum],
            'wind_speed': [wind],
            'precip_accum': [precip]
        })
        input_scaled = risk_scaler.transform(input_data)
        prediction = risk_model.predict(input_scaled)[0]
        risk_labels = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk"}
        return jsonify({"risk": risk_labels[prediction]})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/weather/history', methods=['GET'])
def get_weather_history():
    history = [
        {"date": "2023-10-01", "temp": 32},
        {"date": "2023-10-02", "temp": 33},
        {"date": "2023-10-03", "temp": 31},
        {"date": "2023-10-04", "temp": 35},
        {"date": "2023-10-05", "temp": 34},
        {"date": "2023-10-06", "temp": 36},
        {"date": "2023-10-07", "temp": 38},
    ]
    return jsonify(history)

@app.route('/api/mandi-prices', methods=['GET'])
def get_mandi_prices():
    prices = [
        {"crop": "Wheat", "price": 2125, "unit": "Quintal", "trend": "up"},
        {"crop": "Rice", "price": 1940, "unit": "Quintal", "trend": "down"},
        {"crop": "Cotton", "price": 6000, "unit": "Quintal", "trend": "stable"},
    ]
    return jsonify(prices)

@app.route('/api/weather/current', methods=['GET'])
def get_weather():
    return jsonify({
        "temp": 32.5,
        "humidity": 60,
        "condition": "Partly Cloudy",
        "location": "Detected via GPS",
        "forecast": [
            {"day": "Mon", "temp": 33, "risk": "Low"},
            {"day": "Tue", "temp": 35, "risk": "Medium"},
            {"day": "Wed", "temp": 38, "risk": "High"}
        ]
    })

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
