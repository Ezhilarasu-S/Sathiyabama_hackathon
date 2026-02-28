import sys
import json
import joblib
import pandas as pd

def predict():
    try:
        model = joblib.load("random_forest_model.pkl")
        scaler = joblib.load("scaler.pkl")
        
        args = sys.argv[1:]
        inputs = [float(x) for x in args]
        
        input_data = pd.DataFrame({
            'temp_anomaly': [inputs[0]],
            'pressure': [inputs[1]],
            'humidity': [inputs[2]],
            'wind_speed': [inputs[3]],
            'precip_accum': [inputs[4]]
        })
        
        input_scaled = scaler.transform(input_data)
        prediction = model.predict(input_scaled)[0]
        probabilities = model.predict_proba(input_scaled)[0]
        
        risk_labels = {0: "Low Risk", 1: "Medium Risk", 2: "High Risk"}
        
        result = {
            "risk_level": risk_labels[prediction],
            "probabilities": {
                "Low": round(probabilities[0], 4),
                "Medium": round(probabilities[1], 4),
                "High": round(probabilities[2], 4)
            }
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    predict()
