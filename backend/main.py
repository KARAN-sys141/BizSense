from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import io, os, json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

CHAT_MODEL    = "llama-3.1-8b-instant"      
INSIGHT_MODEL = "llama-3.3-70b-versatile"   

app = FastAPI(title="BizSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = {"df": None, "filename": None, "insights": None}

@app.post("/api/upload")
async def handle_upload(file: UploadFile = File(...)):
    try:
        content = await file.read()

        df = pd.read_csv(io.BytesIO(content), encoding="latin1")
        df.columns = df.columns.str.strip()
        db["df"]       = df
        db["filename"] = file.filename
        db["insights"] = None   

        kpis = {}

        if "Sales" in df.columns:
            kpis["revenue"]     = f"${df['Sales'].sum():,.2f}"
            kpis["revenue_raw"] = round(float(df["Sales"].sum()), 2)

        if "Profit" in df.columns:
            kpis["profit"]     = f"${df['Profit'].sum():,.2f}"
            kpis["profit_raw"] = round(float(df["Profit"].sum()), 2)
            if "Sales" in df.columns and df["Sales"].sum() != 0:
                margin = (df["Profit"].sum() / df["Sales"].sum()) * 100
                kpis["profit_margin"] = f"{margin:.1f}%"

        kpis["orders"] = (
            int(df["Order ID"].nunique()) if "Order ID" in df.columns else len(df)
        )

        if "Customer ID" in df.columns:
            kpis["customers"] = int(df["Customer ID"].nunique())

        if "Sales" in df.columns:
            kpis["avg_order_value"] = f"${df['Sales'].mean():,.2f}"

        return {
            "status":   "success",
            "filename": file.filename,
            "rows":     len(df),
            "columns":  df.columns.tolist(),
            "kpis":     kpis,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/charts")
def get_chart_data():
    if db["df"] is None:
        raise HTTPException(status_code=400, detail="Pehle CSV upload karo!")

    df     = db["df"]
    result = {}

    if "Order Date" in df.columns and "Sales" in df.columns:
        df_copy           = df.copy()
        df_copy["_date"]  = pd.to_datetime(df_copy["Order Date"], errors="coerce")
        df_copy["_month"] = df_copy["_date"].dt.to_period("M").astype(str)
        monthly           = (
            df_copy.groupby("_month")["Sales"]
            .sum()
            .reset_index()
            .sort_values("_month")
            .tail(12)
        )
        result["monthly_sales"] = {
            "labels": monthly["_month"].tolist(),
            "values": [round(v, 2) for v in monthly["Sales"].tolist()],
        }

    if "Category" in df.columns and "Sales" in df.columns:
        cat = df.groupby("Category")["Sales"].sum().reset_index()
        result["category_sales"] = {
            "labels": cat["Category"].tolist(),
            "values": [round(v, 2) for v in cat["Sales"].tolist()],
        }

    if "Region" in df.columns and "Sales" in df.columns:
        reg = df.groupby("Region")["Sales"].sum().reset_index()
        result["region_sales"] = {
            "labels": reg["Region"].tolist(),
            "values": [round(v, 2) for v in reg["Sales"].tolist()],
        }

    if "Sub-Category" in df.columns and "Profit" in df.columns:
        sub = (
            df.groupby("Sub-Category")["Profit"]
            .sum()
            .reset_index()
            .sort_values("Profit", ascending=False)
            .head(5)
        )
        result["top_subcategories"] = {
            "labels": sub["Sub-Category"].tolist(),
            "values": [round(v, 2) for v in sub["Profit"].tolist()],
        }

    return {"status": "success", "charts": result}

@app.get("/api/insights")
def get_insights():
   
    if db["df"] is None:
        raise HTTPException(status_code=400, detail="Pehle CSV upload karo!")

    if db["insights"]:
        return {"status": "success", "insights": db["insights"]}

    df = db["df"]

    lines = [f"Dataset: {db['filename']}, {len(df)} rows"]

    if "Sales" in df.columns:
        lines.append(f"Total Sales: ${df['Sales'].sum():,.0f}")
    if "Profit" in df.columns:
        lines.append(f"Total Profit: ${df['Profit'].sum():,.0f}")
        if "Sales" in df.columns and df["Sales"].sum() != 0:
            margin = (df["Profit"].sum() / df["Sales"].sum()) * 100
            lines.append(f"Overall Profit Margin: {margin:.1f}%")
    if "Category" in df.columns and "Sales" in df.columns:
        top_cat = df.groupby("Category")["Sales"].sum().idxmax()
        lines.append(f"Top Category by Sales: {top_cat}")
    if "Region" in df.columns and "Sales" in df.columns:
        top_reg = df.groupby("Region")["Sales"].sum().idxmax()
        lines.append(f"Best Region: {top_reg}")
    if "Sub-Category" in df.columns and "Profit" in df.columns:
        worst = df.groupby("Sub-Category")["Profit"].sum().idxmin()
        best  = df.groupby("Sub-Category")["Profit"].sum().idxmax()
        lines.append(f"Most Profitable Sub-Category: {best}")
        lines.append(f"Least Profitable Sub-Category: {worst}")
    if "Segment" in df.columns and "Sales" in df.columns:
        top_seg = df.groupby("Segment")["Sales"].sum().idxmax()
        lines.append(f"Top Customer Segment: {top_seg}")

    data_summary = "\n".join(lines)

    prompt = f"""You are a senior business analyst. Analyze this retail business data and provide exactly 5 actionable insights.

DATA SUMMARY:
{data_summary}

Return ONLY a valid JSON array. No explanation, no markdown, no extra text. Format:
[
  {{
    "title": "Short insight title (max 8 words)",
    "observation": "What the data shows (1 clear sentence)",
    "recommendation": "Specific action to take (1 sentence)",
    "impact": "High",
    "type": "positive"
  }}
]

Rules:
- "impact" must be exactly: High, Medium, or Low
- "type" must be exactly: positive, negative, or neutral
- Make recommendations specific and actionable
- Focus on business value"""

    try:
        response = client.chat.completions.create(
            model=INSIGHT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        raw   = response.choices[0].message.content.strip()

        start = raw.find("[")
        end   = raw.rfind("]") + 1
        if start == -1 or end == 0:
            raise ValueError("LLM ne valid JSON nahi diya")

        insights       = json.loads(raw[start:end])
        db["insights"] = insights
        return {"status": "success", "insights": insights}

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

@app.get("/api/anomalies")
def get_anomalies():
    
    if db["df"] is None:
        raise HTTPException(status_code=400, detail="Pehle CSV upload karo!")

    df        = db["df"]
    anomalies = []

    if "Order Date" not in df.columns or "Sales" not in df.columns:
        return {"status": "success", "anomalies": []}

    df_copy           = df.copy()
    df_copy["_date"]  = pd.to_datetime(df_copy["Order Date"], errors="coerce")
    df_copy["_month"] = df_copy["_date"].dt.to_period("M").astype(str)
    monthly           = df_copy.groupby("_month")["Sales"].sum()

    Q1    = monthly.quantile(0.25)
    Q3    = monthly.quantile(0.75)
    IQR   = Q3 - Q1
    lower = Q1 - 1.5 * IQR
    upper = Q3 + 1.5 * IQR
    mean  = float(monthly.mean())

    for period, value in monthly.items():
        if value < lower or value > upper:
            dev = ((value - mean) / mean) * 100 if mean != 0 else 0
            anomalies.append({
                "period":        str(period),
                "value":         round(float(value), 2),
                "type":          "spike" if value > upper else "drop",
                "deviation_pct": round(dev, 2),
                "severity":      "critical" if abs(dev) > 50 else "high",
            })

    return {"status": "success", "anomalies": anomalies}

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
async def handle_chat(request: ChatRequest):
    if db["df"] is None:
        return {"answer": "Pehle CSV file upload karo left side se!", "type": "error"}

    df   = db["df"]
    cols = ", ".join([f"{c} ({t})" for c, t in zip(df.columns, df.dtypes)])

    system_prompt = f"""You are BizSense AI, a senior business analyst assistant.
The user has uploaded a dataset with these columns: {cols}

STRICT RULES:
1. If the user asks about data/analysis → Return ONLY 1 line of valid Python/Pandas code using variable 'df'. No markdown, no explanation.
2. If the user greets or chats → Reply conversationally but start your reply with exactly 'CHAT: '
3. Always chain .reset_index() after groupby() or value_counts()
4. For sorting by value, use .sort_values(by='column', ascending=False)
5. Never use exec(), import, or open()
6. If a column name has spaces, use df['Column Name'] syntax"""

    try:
        response = client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": request.message},
            ],
            temperature=0,
        )
        ai_msg = response.choices[0].message.content.strip()

        if ai_msg.startswith("CHAT:"):
            return {
                "answer": ai_msg.replace("CHAT:", "").strip(),
                "type":   "text",
            }

        code   = ai_msg.replace("```python", "").replace("```", "").strip()
        result = eval(code, {"df": df, "pd": pd, "np": np})

        if isinstance(result, pd.Series):
            result = result.reset_index()

        if isinstance(result, pd.DataFrame):

            if not isinstance(result.index, pd.RangeIndex):
                result = result.reset_index()

            if "index" in result.columns:
                result = result.drop(columns=["index"])

            for garbage_col in ["level_0", "level_1", "index"]:
                if garbage_col in result.columns:
                    result = result.drop(columns=[garbage_col])

            if result.empty:
                return {
                    "answer": "Query ran successfully but returned no matching data.",
                    "type":   "error",
                    "code":   code,
                }

            if len(result) > 50:
                result = result.head(50)

            html = result.to_html(
                classes="data-table",
                index=False,
                float_format="{:,.2f}".format,
            )
            return {"answer": html, "type": "table", "code": code}

        else:

            val = f"{result:,.2f}" if isinstance(result, float) else str(result)
            return {"answer": val, "type": "value", "code": code}

    except Exception as e:
        return {
            "answer": "Could not compute. Please rephrase your query.",
            "type":   "error",
            "code":   str(e),
        }

@app.get("/")
def root():
    return {
        "status":         "running",
        "message":        "BizSense API is live!",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "chat_model":     CHAT_MODEL,
        "insight_model":  INSIGHT_MODEL,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)