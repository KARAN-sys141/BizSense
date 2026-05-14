// Dynamic API URL (Local vs Production)
const BACKEND_URL = "https://your-render-app-name.onrender.com"; // Change this to your actual Render URL later
const API = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost" 
    ? "http://127.0.0.1:8000/api" 
    : `${BACKEND_URL}/api`;

const dropZone   = document.getElementById("drop-zone");
const fileInput  = document.getElementById("file-input");
const queryInput = document.getElementById("query-input");
const sendBtn    = document.getElementById("send-btn");
const chatDisplay = document.getElementById("chat-display");

let charts = {};

document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(s => s.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
});

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) uploadFile(file);
    else showToast("Only .csv files are supported!", "error");
});

fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
});

async function uploadFile(file) {

    document.getElementById("drop-icon").textContent = "⏳";
    dropZone.querySelector("p").textContent = "SCANNING DATA...";

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res  = await fetch(`${API}/upload`, { method: "POST", body: formData });
        const data = await res.json();

        if (data.status !== "success") throw new Error(data.detail || "Upload failed");

        document.getElementById("drop-icon").textContent = "✅";
        dropZone.querySelector("p").textContent = file.name;

        const kpis = data.kpis;
        setKPI("stat-rev",  kpis.revenue  || "N/A");
        setKPI("stat-prof", kpis.profit   || "N/A");
        setKPI("stat-ord",  kpis.orders   || "N/A");
        setKPI("stat-cust", kpis.customers || "N/A");
        setKPI("stat-aov",  kpis.avg_order_value || "N/A");

        document.getElementById("stats-panel").style.opacity = "1";
        document.getElementById("stats-panel").style.pointerEvents = "auto";

        const badge = document.getElementById("file-badge");
        badge.classList.remove("hidden");
        document.getElementById("file-badge-name").textContent = file.name;
        document.getElementById("file-badge-rows").textContent = `${data.rows.toLocaleString()} rows loaded`;

        document.getElementById("header-file").textContent = `${file.name} · ${data.rows.toLocaleString()} rows`;

        queryInput.disabled = false;
        sendBtn.disabled    = false;

        document.getElementById("dashboard-empty").classList.add("hidden");
        document.getElementById("dashboard-content").classList.remove("hidden");
        document.getElementById("insights-empty").classList.add("hidden");
        document.getElementById("insights-content").classList.remove("hidden");
        document.getElementById("anomalies-empty").classList.add("hidden");
        document.getElementById("anomalies-content").classList.remove("hidden");
        document.getElementById("chat-empty").classList.add("hidden");

        showToast(`✅ ${file.name} loaded — ${data.rows.toLocaleString()} rows`);

        await Promise.all([loadCharts(), loadInsights(), loadAnomalies()]);

    } catch (err) {
        document.getElementById("drop-icon").textContent = "❌";
        dropZone.querySelector("p").textContent = "Upload Failed";
        showToast("Upload failed: " + err.message, "error");
    }
}

function setKPI(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

async function loadCharts() {
    try {
        const res  = await fetch(`${API}/charts`);
        const data = await res.json();
        if (data.status !== "success") return;

        const c = data.charts;

        Object.values(charts).forEach(ch => ch.destroy());
        charts = {};

        const green  = "#10b981";
        const blue   = "#6366f1";
        const amber  = "#f59e0b";
        const rose   = "#f43f5e";
        const purple = "#a855f7";

        const gridColor  = "#ffffff08";
        const tickColor  = "#52525b";

        const baseOptions = {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 } } },
                y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 }, callback: v => "$" + (v >= 1000 ? (v/1000).toFixed(0)+"K" : v) } },
            },
        };

        if (c.monthly_sales) {
            charts.trend = new Chart(document.getElementById("chart-trend"), {
                type: "line",
                data: {
                    labels: c.monthly_sales.labels,
                    datasets: [{
                        data: c.monthly_sales.values,
                        borderColor: green,
                        backgroundColor: green + "15",
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: green,
                        pointRadius: 4,
                    }]
                },
                options: { ...baseOptions },
            });
        }

        if (c.category_sales) {
            charts.category = new Chart(document.getElementById("chart-category"), {
                type: "bar",
                data: {
                    labels: c.category_sales.labels,
                    datasets: [{
                        data: c.category_sales.values,
                        backgroundColor: [green, blue, amber, rose, purple],
                        borderRadius: 8,
                    }]
                },
                options: { ...baseOptions, plugins: { legend: { display: false } } },
            });
        }

        if (c.region_sales) {
            charts.region = new Chart(document.getElementById("chart-region"), {
                type: "doughnut",
                data: {
                    labels: c.region_sales.labels,
                    datasets: [{
                        data: c.region_sales.values,
                        backgroundColor: [green, blue, amber, rose],
                        borderColor: "#050505",
                        borderWidth: 3,
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: "bottom",
                            labels: { color: "#71717a", font: { size: 11 }, padding: 16 }
                        }
                    }
                },
            });
        }

        if (c.top_subcategories) {
            const colors = c.top_subcategories.values.map(v => v >= 0 ? green : rose);
            charts.subcats = new Chart(document.getElementById("chart-subcats"), {
                type: "bar",
                data: {
                    labels: c.top_subcategories.labels,
                    datasets: [{
                        data: c.top_subcategories.values,
                        backgroundColor: colors,
                        borderRadius: 8,
                    }]
                },
                options: {
                    ...baseOptions,
                    indexAxis: "y",  
                    scales: {
                        x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10 }, callback: v => "$" + (v >= 1000 ? (v/1000).toFixed(0)+"K" : v) } },
                        y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 } } },
                    },
                },
            });
        }

    } catch (err) {
        console.error("Charts failed:", err);
    }
}

async function loadInsights() {
    const grid = document.getElementById("insights-grid");
    grid.innerHTML = `<div class="section-loader"><div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div> Generating AI insights...</div>`;

    try {
        const res  = await fetch(`${API}/insights`);
        const data = await res.json();

        if (data.status !== "success") throw new Error(data.detail);

        grid.innerHTML = data.insights.map(ins => `
            <div class="insight-card ${ins.type}">
                <div class="flex items-start justify-between gap-4 mb-3">
                    <h3 class="font-bold text-base text-zinc-100">${ins.title}</h3>
                    <span class="impact-badge impact-${ins.impact} shrink-0">${ins.impact}</span>
                </div>
                <p class="text-sm text-zinc-400 mb-2">${ins.observation}</p>
                <div class="flex items-start gap-2 mt-3 pt-3 border-t border-zinc-800">
                    <span class="text-emerald-500 text-xs font-bold shrink-0">→ ACTION</span>
                    <p class="text-xs text-zinc-500">${ins.recommendation}</p>
                </div>
            </div>
        `).join("");

    } catch (err) {
        grid.innerHTML = `<p class="text-rose-400 text-sm">Could not load insights: ${err.message}</p>`;
    }
}

document.getElementById("refresh-insights").addEventListener("click", () => {

    loadInsights();
});

async function loadAnomalies() {
    const list = document.getElementById("anomalies-list");
    list.innerHTML = `<div class="section-loader"><div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div> Scanning for anomalies...</div>`;

    try {
        const res  = await fetch(`${API}/anomalies`);
        const data = await res.json();

        if (!data.anomalies.length) {
            list.innerHTML = `
                <div class="anomaly-card" style="border-left-color: #10b981">
                    <div>
                        <p class="font-bold text-emerald-400">✅ No Anomalies Detected</p>
                        <p class="text-sm text-zinc-500 mt-1">Sales data looks consistent across all periods.</p>
                    </div>
                </div>`;
            return;
        }

        list.innerHTML = data.anomalies.map(a => `
            <div class="anomaly-card anomaly-${a.type}">
                <div class="flex-1">
                    <div class="flex items-center gap-3 mb-1">
                        <span class="text-lg">${a.type === "spike" ? "📈" : "📉"}</span>
                        <span class="font-bold text-zinc-100">${a.period}</span>
                        <span class="impact-badge severity-${a.severity}">${a.severity}</span>
                    </div>
                    <p class="text-sm text-zinc-400">
                        Sales: <strong class="text-white">$${a.value.toLocaleString()}</strong> —
                        ${Math.abs(a.deviation_pct)}% ${a.type === "spike" ? "above" : "below"} average
                    </p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-zinc-600 uppercase font-bold">${a.type}</p>
                    <p class="text-2xl font-black ${a.type === "spike" ? "text-amber-400" : "text-rose-400"}">
                        ${a.deviation_pct > 0 ? "+" : ""}${a.deviation_pct}%
                    </p>
                </div>
            </div>
        `).join("");

    } catch (err) {
        list.innerHTML = `<p class="text-rose-400 text-sm">Could not load anomalies: ${err.message}</p>`;
    }
}

async function analyze() {
    const query = queryInput.value.trim();
    if (!query) return;

    appendMessage("user", query);
    queryInput.value = "";

    const loaderId = "loader-" + Date.now();
    chatDisplay.insertAdjacentHTML("beforeend", `
        <div class="ai-bubble" id="${loaderId}">
            <div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
            <p class="text-xs text-zinc-600 font-bold mt-2">Analyzing...</p>
        </div>`);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;

    try {
        const res  = await fetch(`${API}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: query }),
        });
        const data = await res.json();

        document.getElementById(loaderId)?.remove();

        let bodyHtml = "";
        if (data.type === "table") {
            bodyHtml = `<div class="table-scroll">${data.answer}</div>`;
        } else if (data.type === "value") {
            bodyHtml = `<div class="value-result">${data.answer}</div>`;
        } else {
            bodyHtml = `<p class="text-sm text-zinc-300 leading-relaxed">${data.answer}</p>`;
        }

        chatDisplay.insertAdjacentHTML("beforeend", `
            <div class="ai-bubble">
                <div class="flex items-center gap-2 mb-3">
                    <span class="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-1 rounded-md">BIZSENSE AI</span>
                </div>
                ${bodyHtml}
                ${data.code ? `<div class="code-tag">> ${data.code}</div>` : ""}
            </div>`);

    } catch (err) {
        document.getElementById(loaderId)?.remove();
        chatDisplay.insertAdjacentHTML("beforeend", `
            <div class="ai-bubble">
                <p class="text-rose-400 text-sm">Request failed. Is the server running?</p>
            </div>`);
    }

    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function appendMessage(role, text) {
    const cls = role === "user" ? "user-bubble" : "ai-bubble";
    chatDisplay.insertAdjacentHTML("beforeend", `<div class="${cls} text-sm">${text}</div>`);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

sendBtn.addEventListener("click", analyze);
queryInput.addEventListener("keydown", e => { if (e.key === "Enter") analyze(); });

document.querySelectorAll(".quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        queryInput.value = btn.textContent;
        analyze();
    });
});

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        background: ${type === "error" ? "#1a0a0a" : "#0a1a0f"};
        border: 1px solid ${type === "error" ? "#7f1d1d" : "#14532d"};
        color: ${type === "error" ? "#f87171" : "#4ade80"};
        padding: 12px 20px; border-radius: 12px;
        font-size: 12px; font-weight: 700;
        animation: fadeUp 0.3s ease-out;
        max-width: 320px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}