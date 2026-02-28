import * as d3 from 'd3';
import { animate } from 'motion';

// --- State Management ---
let currentState = "Punjab";
let currentDistrict = "Ludhiana";
let weatherData: any[] = [];

// --- UI Elements ---
const forecastChart = document.getElementById('forecast-chart');
const mandiList = document.getElementById('mandi-list');
const riskTimeline = document.getElementById('risk-timeline');
const askGeminiBtn = document.getElementById('ask-gemini');
const geminiModal = document.getElementById('gemini-modal');
const closeModalBtn = document.getElementById('close-modal');
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendChatBtn = document.getElementById('send-chat');
const chatMessages = document.getElementById('chat-messages');
const navBtns = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.content-section');
const getLocationBtn = document.getElementById('get-location');
const weatherDisplay = document.getElementById('weather-display');

// --- Initialization ---
async function init() {
  await fetchWeatherHistory();
  await fetchMandiPrices();
  renderForecastChart();
  renderRiskTimeline();
  setupEventListeners();
  
  // Initial animations
  animate("main", { opacity: [0, 1], y: [20, 0] }, { duration: 0.8 });
}

// --- Navigation ---
function switchSection(sectionId: string) {
  sections.forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`section-${sectionId}`);
  if (target) {
    target.classList.remove('hidden');
    animate(target, { opacity: [0, 1], x: [10, 0] }, { duration: 0.4 });
  }

  navBtns.forEach(btn => {
    btn.classList.remove('bg-white/10');
    btn.classList.add('hover:bg-white/5', 'text-white/60');
    if (btn.getAttribute('data-section') === sectionId) {
      btn.classList.add('bg-white/10');
      btn.classList.remove('hover:bg-white/5', 'text-white/60');
    }
  });
}

// --- API Calls ---
async function fetchWeatherHistory() {
  try {
    const res = await fetch(`/api/weather/history?state=${currentState}&district=${currentDistrict}`);
    weatherData = await res.json();
  } catch (err) {
    console.error("Failed to fetch weather history", err);
  }
}

async function fetchMandiPrices() {
  try {
    const res = await fetch('/api/mandi-prices');
    const prices = await res.json();
    if (mandiList) {
      mandiList.innerHTML = prices.map((p: any) => `
        <div class="flex items-center justify-between p-4 bg-black/5 rounded-2xl border border-black/5 hover:bg-black/10 transition-all cursor-pointer">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <span class="text-lg font-bold text-emerald-600">${p.crop[0]}</span>
            </div>
            <div>
              <p class="text-sm font-bold">${p.crop}</p>
              <p class="text-[10px] text-black/40 uppercase tracking-widest">${p.unit}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-sm font-mono font-bold">₹${p.price}</p>
            <p class="text-[10px] ${p.trend === 'up' ? 'text-emerald-500' : p.trend === 'down' ? 'text-red-500' : 'text-black/40'} font-bold flex items-center justify-end gap-1">
              ${p.trend === 'up' ? '▲' : p.trend === 'down' ? '▼' : '●'} ${p.trend.toUpperCase()}
            </p>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error("Failed to fetch mandi prices", err);
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.getAttribute('data-section');
      if (section) switchSection(section);
    });
  });

  getLocationBtn?.addEventListener('click', () => {
    if (navigator.geolocation) {
      getLocationBtn.innerText = "Syncing GPS...";
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/weather/current?lat=${latitude}&lon=${longitude}`);
          const weather = await res.json();
          if (weatherDisplay) {
            weatherDisplay.innerHTML = `
              <div class="flex items-center justify-between mb-8">
                <div>
                  <h3 class="text-4xl font-bold">${weather.temp}°C</h3>
                  <p class="text-black/40">${weather.condition} in ${weather.location}</p>
                </div>
                <div class="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                   <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cloud-sun text-emerald-600"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/></svg>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-4">
                ${weather.forecast.map((f: any) => `
                  <div class="p-4 bg-black/5 rounded-2xl text-center">
                    <p class="text-xs font-bold uppercase mb-1">${f.day}</p>
                    <p class="text-lg font-bold">${f.temp}°C</p>
                    <p class="text-[10px] text-black/40 font-bold uppercase">${f.risk} Risk</p>
                  </div>
                `).join('')}
              </div>
            `;
          }
        } catch (err) {
          console.error(err);
        } finally {
          getLocationBtn.innerText = "Sync GPS Weather";
        }
      });
    }
  });

  askGeminiBtn?.addEventListener('click', () => {
    geminiModal?.classList.remove('hidden');
    geminiModal?.classList.add('flex');
    animate("#gemini-modal > div", { scale: [0.9, 1], opacity: [0, 1] }, { duration: 0.4 });
  });

  closeModalBtn?.addEventListener('click', () => {
    geminiModal?.classList.add('hidden');
    geminiModal?.classList.remove('flex');
  });

  sendChatBtn?.addEventListener('click', handleGeminiChat);
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleGeminiChat();
  });

  // ML Predictions
  const btnPredictCrop = document.getElementById('btn-predict-crop');
  const btnPredictRisk = document.getElementById('btn-predict-risk');

  btnPredictCrop?.addEventListener('click', async () => {
    const n = (document.getElementById('input-n') as HTMLInputElement).value;
    const p = (document.getElementById('input-p') as HTMLInputElement).value;
    const k = (document.getElementById('input-k') as HTMLInputElement).value;
    const rainfall = (document.getElementById('input-rainfall') as HTMLInputElement).value;

    btnPredictCrop.innerText = "Analyzing...";
    try {
      const res = await fetch('/api/predict/crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n, p, k, rainfall })
      });
      const data = await res.json();
      const resultDiv = document.getElementById('crop-result');
      const cropName = document.getElementById('crop-name');
      if (resultDiv && cropName) {
        cropName.innerText = data.crop;
        resultDiv.classList.remove('hidden');
        animate(resultDiv, { y: [10, 0], opacity: [0, 1] });
      }
    } catch (err) {
      console.error(err);
    } finally {
      btnPredictCrop.innerText = "Predict Best Crop";
    }
  });

  btnPredictRisk?.addEventListener('click', async () => {
    const tempAnomaly = (document.getElementById('input-temp-anomaly') as HTMLInputElement).value;
    const pressure = (document.getElementById('input-pressure') as HTMLInputElement).value;

    btnPredictRisk.innerText = "Analyzing Risk...";
    try {
      const res = await fetch('/api/predict/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temp_anomaly: tempAnomaly, pressure })
      });
      const data = await res.json();
      const riskDisplay = document.getElementById('risk-display');
      if (riskDisplay) {
        riskDisplay.innerText = data.risk;
        animate(riskDisplay, { scale: [1.2, 1] });
      }
    } catch (err) {
      console.error(err);
    } finally {
      btnPredictRisk.innerText = "Analyze Risk";
    }
  });
}

async function handleGeminiChat() {
  const message = chatInput.value.trim();
  if (!message) return;

  appendMessage('user', message);
  chatInput.value = '';

  const typingId = appendMessage('bot', 'Thinking...');

  try {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message, 
        context: `User is at ${currentState}, ${currentDistrict}. Current risk is Heatwave.` 
      })
    });
    const data = await res.json();
    
    const typingMsg = document.getElementById(typingId);
    if (typingMsg) {
      typingMsg.innerHTML = data.text || "I'm sorry, I couldn't process that request.";
    }
  } catch (err) {
    console.error(err);
    const typingMsg = document.getElementById(typingId);
    if (typingMsg) {
      typingMsg.innerHTML = "Error: Failed to connect to Python AI engine.";
    }
  }
}

function appendMessage(role: 'user' | 'bot', text: string): string {
  const id = `msg-${Date.now()}`;
  const msgDiv = document.createElement('div');
  msgDiv.className = `flex gap-3 ${role === 'user' ? 'flex-row-reverse' : ''}`;
  msgDiv.innerHTML = `
    <div class="w-8 h-8 ${role === 'user' ? 'bg-black' : 'bg-emerald-100'} rounded-full flex items-center justify-center shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-${role === 'user' ? 'user' : 'bot'} ${role === 'user' ? 'text-white' : 'text-emerald-600'}"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </div>
    <div id="${id}" class="${role === 'user' ? 'bg-emerald-500 text-white' : 'bg-white text-black'} p-4 rounded-2xl shadow-sm border border-black/5 text-sm max-w-[80%]">
      ${text}
    </div>
  `;
  chatMessages?.appendChild(msgDiv);
  chatMessages?.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
  return id;
}

function renderForecastChart() {
  if (!forecastChart || weatherData.length === 0) return;
  forecastChart.innerHTML = '';

  const margin = { top: 20, right: 30, bottom: 40, left: 40 };
  const width = forecastChart.clientWidth - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  const svg = d3.select("#forecast-chart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
    .domain(d3.extent(weatherData, d => new Date(d.date)) as [Date, Date])
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(weatherData, d => d.temp) as number + 5])
    .range([height, 0]);

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d") as any))
    .attr("class", "text-black/20 font-mono text-[10px]");

  svg.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .attr("class", "text-black/20 font-mono text-[10px]");

  const area = d3.area<any>()
    .x(d => x(new Date(d.date)))
    .y0(height)
    .y1(d => y(d.temp))
    .curve(d3.curveBasis);

  svg.append("path")
    .datum(weatherData)
    .attr("fill", "rgba(16, 185, 129, 0.1)")
    .attr("d", area);

  const line = d3.line<any>()
    .x(d => x(new Date(d.date)))
    .y(d => y(d.temp))
    .curve(d3.curveBasis);

  svg.append("path")
    .datum(weatherData)
    .attr("fill", "none")
    .attr("stroke", "#10b981")
    .attr("stroke-width", 3)
    .attr("d", line);

  svg.selectAll("circle")
    .data(weatherData)
    .enter()
    .append("circle")
    .attr("cx", d => x(new Date(d.date)))
    .attr("cy", d => y(d.temp))
    .attr("r", 4)
    .attr("fill", "#10b981")
    .attr("stroke", "white")
    .attr("stroke-width", 2);
}

function renderRiskTimeline() {
  if (!riskTimeline) return;
  const timelineData = [
    { period: "MAR 01 - MAR 07", risk: "Heatwave", level: "High", color: "text-orange-500", bg: "bg-orange-500/10" },
    { period: "MAR 08 - MAR 14", risk: "Normal", level: "Low", color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { period: "MAR 15 - MAR 21", risk: "Dry Spell", level: "Medium", color: "text-blue-500", bg: "bg-blue-500/10" },
  ];

  riskTimeline.innerHTML = timelineData.map(item => `
    <div class="relative pl-8 border-l-2 border-black/5 pb-6 last:pb-0">
      <div class="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-black/10 flex items-center justify-center">
        <div class="w-1.5 h-1.5 rounded-full ${item.color.replace('text', 'bg')}"></div>
      </div>
      <div class="flex justify-between items-start mb-2">
        <p class="text-[10px] font-mono text-black/40 font-bold">${item.period}</p>
        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${item.bg} ${item.color}">${item.level} RISK</span>
      </div>
      <p class="text-sm font-bold">${item.risk} Forecasted</p>
      <p class="text-xs text-black/40">Probability of extreme temperature spikes detected by Random Forest engine.</p>
    </div>
  `).join('');
}

init();
