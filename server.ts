import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import dotenv from "dotenv";
import { execSync } from "child_process";

dotenv.config();

const db = new Database("cracse.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_type TEXT,
    crop_type TEXT,
    strategy TEXT,
    region TEXT
  );
`);

// Seed data
const rowCount = db.prepare("SELECT count(*) as count FROM strategies").get() as { count: number };
if (rowCount.count === 0) {
  const insertStrategy = db.prepare("INSERT INTO strategies (risk_type, crop_type, strategy, region) VALUES (?, ?, ?, ?)");
  insertStrategy.run("Heatwave", "Wheat", "Early sowing and use of heat-tolerant varieties like HD 2967.", "North India");
  insertStrategy.run("Drought", "Rice", "Direct Seeded Rice (DSR) technique and alternate wetting and drying.", "South India");
  insertStrategy.run("Flood", "Rice", "Submergence-tolerant varieties like Swarna-Sub1.", "East India");
}

// Train models on startup
try {
  console.log("Training ML models...");
  execSync("python3 train_models.py");
  console.log("ML models trained successfully.");
} catch (err) {
  console.error("Error training ML models. Ensure python3, pandas, scikit-learn, and joblib are installed.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Predict Crop (Calls Python Random Forest)
  app.post("/api/predict_crop", (req, res) => {
    const { N, P, K, temperature, humidity, ph, rainfall } = req.body;
    try {
      const output = execSync(`python3 predict_crop.py ${N} ${P} ${K} ${temperature} ${humidity} ${ph} ${rainfall}`).toString();
      res.json(JSON.parse(output));
    } catch (err) {
      res.status(500).json({ error: "ML model execution failed" });
    }
  });

  // API: Predict Risk (Calls Python Random Forest)
  app.post("/api/predict_risk", (req, res) => {
    const { temp_anomaly, pressure, humidity, wind_speed, precip_accum } = req.body;
    try {
      const output = execSync(`python3 predict_risk.py ${temp_anomaly} ${pressure} ${humidity} ${wind_speed} ${precip_accum}`).toString();
      res.json(JSON.parse(output));
    } catch (err) {
      res.status(500).json({ error: "ML model execution failed" });
    }
  });

  app.get("/api/weather/history", (req, res) => {
    const data = [
      { date: "2023-10-01", temp: 32, humidity: 65, rainfall: 5 },
      { date: "2023-10-05", temp: 34, humidity: 60, rainfall: 0 },
      { date: "2023-10-10", temp: 31, humidity: 70, rainfall: 12 },
      { date: "2023-10-15", temp: 35, humidity: 55, rainfall: 0 },
      { date: "2023-10-20", temp: 38, humidity: 45, rainfall: 0 },
      { date: "2023-10-25", temp: 33, humidity: 65, rainfall: 8 },
      { date: "2023-10-30", temp: 30, humidity: 75, rainfall: 20 },
    ];
    res.json(data);
  });

  app.get("/api/mandi-prices", (req, res) => {
    const prices = [
      { crop: "Wheat", price: 2125, unit: "Quintal", trend: "up" },
      { crop: "Rice (Paddy)", price: 2040, unit: "Quintal", trend: "stable" },
      { crop: "Maize", price: 1960, unit: "Quintal", trend: "down" },
    ];
    res.json(prices);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
