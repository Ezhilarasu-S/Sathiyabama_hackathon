import sys
import json
import joblib
import numpy as np

def predict():
    try:
        model = joblib.load("crop_model.pkl")
        le = joblib.load("label_encoder.pkl")
        
        # Read inputs from command line arguments
        args = sys.argv[1:]
        inputs = [float(x) for x in args]
        
        sample = np.array([inputs])
        prediction = model.predict(sample)
        crop_name = le.inverse_transform(prediction)[0]
        
        print(json.dumps({"recommended_crop": crop_name}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    predict()
