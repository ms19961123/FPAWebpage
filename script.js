 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/script.js b/script.js
index 8b137891791fe96927ad78e64b0aad7bded08bdc..75371a72c73dae24016ad079c0b1fd58bc35d20c 100644
--- a/script.js
+++ b/script.js
@@ -1 +1,191 @@
+const statusEl = document.getElementById('dataStatus');
+const latestCloseEl = document.getElementById('latestClose');
+const ytdReturnEl = document.getElementById('ytdReturn');
+const volatilityEl = document.getElementById('volatility');
+const rangeSelect = document.getElementById('rangeSelect');
+const slider = document.getElementById('multipleSlider');
+const multipleValue = document.getElementById('multipleValue');
+const impliedPriceEl = document.getElementById('impliedPrice');
 
+let fullSeries = [];
+let priceChart;
+let volumeChart;
+
+function parseCSV(text) {
+  const lines = text.trim().split('\n').slice(1);
+  return lines
+    .map((line) => {
+      const [date, open, high, low, close, volume] = line.split(',');
+      return {
+        date,
+        open: Number(open),
+        high: Number(high),
+        low: Number(low),
+        close: Number(close),
+        volume: Number(volume)
+      };
+    })
+    .filter((d) => d.close > 0 && Number.isFinite(d.close));
+}
+
+function pct(a, b) {
+  return ((a - b) / b) * 100;
+}
+
+function calcVolatility(data, lookback = 90) {
+  const tail = data.slice(-lookback);
+  const returns = tail.slice(1).map((p, i) => Math.log(p.close / tail[i].close));
+  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
+  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
+  return Math.sqrt(variance) * Math.sqrt(252) * 100;
+}
+
+function getWindowData() {
+  const selected = Number(rangeSelect.value);
+  return fullSeries.slice(-selected);
+}
+
+function buildOrUpdateCharts() {
+  const data = getWindowData();
+  const labels = data.map((d) => d.date);
+  const closes = data.map((d) => d.close);
+  const volumes = data.map((d) => d.volume / 1_000_000);
+
+  const commonOptions = {
+    responsive: true,
+    maintainAspectRatio: false,
+    interaction: { mode: 'index', intersect: false },
+    scales: {
+      x: { ticks: { color: '#9fb0d0', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.05)' } },
+      y: { ticks: { color: '#9fb0d0' }, grid: { color: 'rgba(255,255,255,0.05)' } }
+    },
+    plugins: {
+      legend: { labels: { color: '#dce6ff' } },
+      tooltip: { backgroundColor: '#081126' }
+    }
+  };
+
+  if (!priceChart) {
+    priceChart = new Chart(document.getElementById('priceChart'), {
+      type: 'line',
+      data: {
+        labels,
+        datasets: [
+          {
+            label: 'PLTR Close ($)',
+            data: closes,
+            borderColor: '#6be7ff',
+            backgroundColor: 'rgba(107, 231, 255, 0.18)',
+            fill: true,
+            tension: 0.26,
+            pointRadius: 0
+          }
+        ]
+      },
+      options: commonOptions
+    });
+  } else {
+    priceChart.data.labels = labels;
+    priceChart.data.datasets[0].data = closes;
+    priceChart.update();
+  }
+
+  if (!volumeChart) {
+    volumeChart = new Chart(document.getElementById('volumeChart'), {
+      type: 'bar',
+      data: {
+        labels,
+        datasets: [
+          {
+            label: 'Volume (Millions)',
+            data: volumes,
+            backgroundColor: 'rgba(141, 125, 255, 0.65)',
+            borderRadius: 3
+          }
+        ]
+      },
+      options: commonOptions
+    });
+  } else {
+    volumeChart.data.labels = labels;
+    volumeChart.data.datasets[0].data = volumes;
+    volumeChart.update();
+  }
+}
+
+function initComparisonChart() {
+  new Chart(document.getElementById('comparisonChart'), {
+    type: 'bar',
+    data: {
+      labels: ['PLTR', 'Large-Cap Software Median', 'Defense Prime Median'],
+      datasets: [
+        {
+          label: 'Forward Revenue Multiple (x)',
+          data: [24, 11, 3.5],
+          backgroundColor: ['#6effb4', '#6be7ff', '#8d7dff']
+        }
+      ]
+    },
+    options: {
+      responsive: true,
+      maintainAspectRatio: false,
+      scales: {
+        x: { ticks: { color: '#c6d0e8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
+        y: { ticks: { color: '#c6d0e8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
+      },
+      plugins: {
+        legend: { labels: { color: '#dce6ff' } }
+      }
+    }
+  });
+}
+
+function updateTargetFromMultiple() {
+  const multiple = Number(slider.value);
+  multipleValue.textContent = `${multiple}x`;
+  const revenue2027 = 8.5e9;
+  const netCashAdj = 4.0e9;
+  const shares = 2.3e9;
+  const implied = ((revenue2027 * multiple + netCashAdj) / shares).toFixed(2);
+  impliedPriceEl.textContent = `$${implied}`;
+}
+
+async function loadData() {
+  try {
+    const api = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://stooq.com/q/d/l/?s=pltr.us&i=d');
+    const res = await fetch(api);
+    if (!res.ok) throw new Error('Failed to load stock data');
+    const csv = await res.text();
+    fullSeries = parseCSV(csv);
+
+    if (fullSeries.length < 200) throw new Error('Insufficient data');
+
+    const latest = fullSeries[fullSeries.length - 1];
+    const oneYearAgo = fullSeries[Math.max(0, fullSeries.length - 252)];
+
+    latestCloseEl.textContent = `$${latest.close.toFixed(2)}`;
+    ytdReturnEl.textContent = `${pct(latest.close, oneYearAgo.close).toFixed(1)}%`;
+    volatilityEl.textContent = `${calcVolatility(fullSeries).toFixed(1)}%`;
+
+    buildOrUpdateCharts();
+    statusEl.textContent = `Loaded ${fullSeries.length} daily records through ${latest.date}.`; 
+  } catch (err) {
+    statusEl.textContent = `Could not load live market data (${err.message}).`; 
+    console.error(err);
+  }
+}
+
+rangeSelect.addEventListener('change', buildOrUpdateCharts);
+slider.addEventListener('input', updateTargetFromMultiple);
+
+const observer = new IntersectionObserver((entries) => {
+  entries.forEach((entry) => {
+    if (entry.isIntersecting) entry.target.classList.add('visible');
+  });
+}, { threshold: 0.2 });
+
+document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
+
+updateTargetFromMultiple();
+initComparisonChart();
+loadData();
 
EOF
)
