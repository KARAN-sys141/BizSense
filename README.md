# BizSense AI — Intelligent Business Analytics Dashboard

> Upload any sales CSV → Get AI-powered insights, anomaly detection, interactive charts, and natural language Q&A — all running 100% free on your local machine.

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green)
![LLaMA](https://img.shields.io/badge/LLaMA_3.3-Groq-orange)
![License](https://img.shields.io/badge/License-MIT-purple)

---

## What is BizSense?

BizSense is an AI-powered business intelligence tool that transforms raw CSV data into actionable business insights. Instead of spending hours in Excel or PowerBI, you simply upload your data and the system automatically detects KPIs, finds anomalies, generates executive-level insights using LLaMA 3, and lets you ask questions in plain English.

Built as a portfolio project demonstrating full-stack AI development — from data processing pipelines to LLM integration to interactive frontend dashboards.

---

## Live Demo Features

| Feature | Description |
|--------|-------------|
| 📊 **Auto KPI Detection** | Automatically identifies revenue, profit, orders from any CSV |
| 🧠 **AI Insights** | LLaMA 3.3 70B generates 5 business insights with recommendations |
| ⚠️ **Anomaly Detection** | IQR statistical method finds unusual months in your data |
| 💬 **Natural Language Q&A** | Ask "Which region has highest profit?" — get instant answers |
| 📈 **Interactive Charts** | Line, Bar, Doughnut, Horizontal Bar via Chart.js |
| 🔴 **Smart Alerts** | Color-coded severity: Critical / High / Medium |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **LLM** | Groq API — LLaMA 3.3 70B (insights) + LLaMA 3.1 8B (chat) | Free tier, fastest inference available |
| **Backend** | FastAPI + Uvicorn | Async Python, auto Swagger docs, production-ready |
| **Data Processing** | Pandas + NumPy | Industry standard for data manipulation |
| **Frontend** | Vanilla HTML + CSS + JavaScript | No framework bloat, pure performance |
| **Charts** | Chart.js via CDN | Lightweight, interactive, beautiful |
| **Styling** | Tailwind CSS via CDN | Rapid dark theme UI |
| **Env Management** | python-dotenv | Secure API key handling |

---

## Project Structure

```
BizSense/
├── backend/
│   └── main.py              # FastAPI server — all endpoints
├── frontend/
│   ├── index.html           # Single page app — 4 tab layout
│   ├── style.css            # Dark theme, table, chart styling
│   └── app.js               # Upload, charts, insights, chat logic
├── data/
│   └── Sample_Superstore.csv  # Kaggle Superstore dataset
├── .env                     # GROQ_API_KEY (not committed)
├── requirements.txt
└── README.md
```

---

## Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/bizsense-ai.git
cd bizsense-ai
```

### 2. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate      # Mac/Linux
venv\Scripts\activate         # Windows
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up Groq API key
- Go to [console.groq.com](https://console.groq.com) → Sign up free → Create API key
- Create `.env` file:
```
GROQ_API_KEY=your_key_here
```

### 5. Download Dataset
- Kaggle: [Superstore Dataset](https://www.kaggle.com/datasets/vivek468/superstore-dataset-final)
- Place it in `data/Sample_Superstore.csv`

### 6. Run the server
```bash
uvicorn backend.main:app --reload --port 8000
```

### 7. Open the app
- Open `frontend/index.html` with VS Code Live Server
- Or simply open the file directly in your browser

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload CSV, returns KPIs |
| `GET` | `/api/charts` | Chart.js data — trend, category, region, sub-category |
| `GET` | `/api/insights` | LLM-generated business insights (cached) |
| `GET` | `/api/anomalies` | IQR-based anomaly detection |
| `POST` | `/api/chat` | Natural language Q&A |
| `GET` | `/` | Health check |

---

## Dataset

This project is optimized for the **Kaggle Superstore Sales Dataset** — a widely recognized retail dataset used in business analytics portfolios globally. It contains 9,994 orders across 4 regions, 3 categories, 17 sub-categories, and 3 customer segments from 2014–2017.

Any CSV with numeric columns works — the system auto-detects KPIs.

---

## Architecture

```
CSV Upload
    ↓
Pandas (data cleaning + encoding fix)
    ↓
FastAPI endpoints (KPIs, Charts, Anomalies)
    ↓
Groq LLaMA 3.3 70B (insights generation)
Groq LLaMA 3.1 8B  (real-time Q&A)
    ↓
Chart.js + Vanilla JS (interactive frontend)
```

---

## Key Technical Decisions

**Why two different LLM models?**
LLaMA 3.3 70B for insights — quality matters, 5 seconds wait is acceptable. LLaMA 3.1 8B for chat — speed matters, user is waiting for each response.

**Why eval() for Q&A?**
Rapid prototyping approach — LLM generates Pandas code, we execute it directly against the DataFrame. Production systems would use a sandboxed execution environment. The validation engine (index cleanup, 50-row limit, type handling) makes it stable for demo use.

**Why no React/Vue?**
Clean vanilla JS demonstrates JavaScript fundamentals without framework dependency. Recruiters see you understand the DOM, fetch API, and async/await natively.

---

## Requirements

```
fastapi==0.111.0
uvicorn==0.30.1
pandas==2.2.2
numpy==1.26.4
groq==0.9.0
fpdf2==2.7.9
python-dotenv==1.0.1
python-multipart==0.0.9
httpx==0.27.0
```

---

## License

MIT License — feel free to use, modify, and distribute.