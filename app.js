console.log("app.js: Script start - v3");
function updateDebug(msg) {
  const el = document.getElementById('debug-console');
  if (el) {
    const time = new Date().toLocaleTimeString();
    el.innerHTML += `<br>[${time}] ${msg}`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const debugDiv = document.createElement('div');
  debugDiv.style.position = 'fixed';
  debugDiv.style.top = '0';
  debugDiv.style.left = '0';
  debugDiv.style.background = 'rgba(0,0,0,0.8)';
  debugDiv.style.color = 'white';
  debugDiv.style.zIndex = '9999';
  debugDiv.style.padding = '10px';
  debugDiv.style.fontSize = '12px';
  debugDiv.style.maxHeight = '200px';
  debugDiv.style.overflowY = 'auto';
  debugDiv.id = 'debug-console';
  debugDiv.innerHTML = '<b>Debug Console</b>';
  document.body.appendChild(debugDiv);
  updateDebug('App JS Loaded & DOM Ready');
});
/**
 * 営業部 業務時間ダッシュボード - Core Logic (v4.8.0)
 */

console.log('app.js: Script start');

// ===== 定数・グローバル変数 =====
const SETTINGS_VERSION = '4.8.0';
const DEFAULT_LEVEL_CONFIG = {
  lv1Max: 50,
  lv2Max: 100,
  lv3Max: 200,
  otAlert: 1.5,
  vacationAlert: 0.1,
  breakAlert: 45,
  version: SETTINGS_VERSION
};

let allRecords = {};
let currentSettings = {};
let currentPeriod = { start: '', end: '' };

// Chart instances
let summaryBubbleChart = null;
let riskLevelPieChart = null;
let dashboardWorktypeChart = null;
let dashboardPersonalChart = null;
let deptWorktypeChart = null;
let deptHonshaChart = null;
let deptFukuokaChart = null;
let deptOtTrendChart = null;
let personalCompareChart = null;
let personalTrendChart = null;

// ===== 初期化処理 =====
window.addEventListener('load', async () => {
  updateDebug("App initializing...");
  loadSettings();
  try {
    if (window.db) {
      updateDebug("Initializing IndexedDB...");
      await window.db.init();
      updateDebug("IndexedDB initialized.");
      
      updateDebug("Loading data from IndexedDB...");
      const loadedData = await window.db.getAllData();
      allRecords = loadedData || {};
      const keys = Object.keys(allRecords);
      updateDebug(`Data loaded. Months: ${keys.length} (${keys.join(', ') || 'none'})`);
    } else {
      updateDebug("ERROR: window.db is not defined!");
    }
  } catch (e) {
    updateDebug(`ERROR: ${e.message || e}`);
  }
  
  updateDebug("Initializing period selector...");
  initPeriodSelector();
  
  updateDebug("Initializing event listeners...");
  initEventListeners();
  
  updateDebug("Checking login status...");
  checkLoginStatus();
  
	  updateDebug("App initialization complete.");
	  updateVersionDisplay();
	});

function updateVersionDisplay() {
  const verEl = document.getElementById('app-version-display');
  if (verEl) verEl.textContent = `v${SETTINGS_VERSION}`;
  
  // ヘッダーのバージョン表示も更新
  const headerVerEl = document.querySelector('.version-info');
  if (headerVerEl) headerVerEl.textContent = `v${SETTINGS_VERSION} (2026/06/17)`;
}

window.forceUpdateApp = function() {
  if (confirm('アプリを強制更新しますか？\nキャッシュをクリアして最新版を読み込み直します。')) {
    // Service Workerのキャッシュ削除を試行
    if ('serviceWorker' in navigator) {
      caches.keys().then(names => {
        for (let name of names) caches.delete(name);
      });
    }
    
    // クエリパラメータにタイムスタンプを付与してリロード（キャッシュ回避）
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now());
    window.location.href = url.toString();
  }
};

window.showUpdateNotes = function() {
  alert(`最新の更新内容 (v${SETTINGS_VERSION}):\n・時間休・有給の休暇中業務判定ロジックを改善\n・ダッシュボードの集計不具合を修正\n・強制更新機能を追加`);
};

function checkLoginStatus() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  if (isLoggedIn === 'true') showMainScreen();
  else showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main-screen').style.display = 'none';
}

function showMainScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';
  renderAll();
}

function handleLogin() {
  const password = document.getElementById('login-password').value;
  const storedPassword = localStorage.getItem('dash_password') || 'admin1234';
  if (password === storedPassword) {
    sessionStorage.setItem('isLoggedIn', 'true');
    showMainScreen();
  } else {
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'block';
    setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
  }
}

function doLogout() {
  sessionStorage.removeItem('isLoggedIn');
  location.reload();
}

window.handleLogin = handleLogin;
window.doLogout = doLogout;
window.switchTab = switchTab;

function renderPersonalTab() {
  const data = getAggregatedData();
  renderPersonalAnalysis(data);
}
window.renderPersonalTab = renderPersonalTab;

function renderPersonalDetailFromSelect() {
  const data = getAggregatedData();
  const sel = document.getElementById('personal-member-filter');
  if (sel) renderPersonalDetail(data, sel.value);
}
window.renderPersonalDetail = renderPersonalDetailFromSelect;

function renderOtList() {
  const data = getAggregatedData();
  renderDashboard(data);
}
window.renderOtList = renderOtList;

// ===== 設定管理 =====
function loadSettings() {
  const stored = localStorage.getItem("dash_settings");
  if (stored) {
    try {
      currentSettings = JSON.parse(stored);
      currentSettings = { ...DEFAULT_LEVEL_CONFIG, ...currentSettings, version: SETTINGS_VERSION };
    } catch (e) { currentSettings = { ...DEFAULT_LEVEL_CONFIG }; }
  } else {
    currentSettings = { ...DEFAULT_LEVEL_CONFIG };
    saveSettings();
  }
}

function saveSettings() {
  localStorage.setItem('dash_settings', JSON.stringify(currentSettings));
}

// ===== 期間選択 UI =====
function initPeriodSelector() {
  const startSelect = document.getElementById('period-start');
  const endSelect = document.getElementById('period-end');
  if (!startSelect || !endSelect) return;
  
  const months = Object.keys(allRecords).sort();
  if (months.length === 0) {
    startSelect.innerHTML = '<option value="">データなし</option>';
    endSelect.innerHTML = '<option value="">データなし</option>';
    return;
  }

  const options = months.map(m => `<option value="${m}">${m}</option>`).join('');
  startSelect.innerHTML = options;
  endSelect.innerHTML = options;

  const latest = months[months.length - 1];
  startSelect.value = latest;
  endSelect.value = latest;
  currentPeriod = { start: latest, end: latest };

  startSelect.onchange = (e) => {
    currentPeriod.start = e.target.value;
    if (currentPeriod.start > currentPeriod.end) {
      endSelect.value = currentPeriod.start;
      currentPeriod.end = currentPeriod.start;
    }
    renderAll();
  };

  endSelect.onchange = (e) => {
    currentPeriod.end = e.target.value;
    if (currentPeriod.end < currentPeriod.start) {
      startSelect.value = currentPeriod.end;
      currentPeriod.start = currentPeriod.end;
    }
    renderAll();
  };
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = content.id === `tab-${tabId}` ? 'block' : 'none';
  });
  renderAll();
}

function initEventListeners() {
  const saveBtn = document.getElementById("save-alert-settings-btn");
  if (saveBtn) {
    saveBtn.onclick = () => {
      currentSettings.otAlert = parseFloat(document.getElementById("setting-ot-alert").value);
      currentSettings.vacationAlert = parseFloat(document.getElementById("setting-vacation-alert").value);
      currentSettings.breakAlert = parseFloat(document.getElementById("setting-break-alert").value);
      saveSettings();
      alert("保存しました");
      renderAll();
    };
  }
  const fileInput = document.getElementById('csv-file-input');
  if (fileInput) fileInput.onchange = (e) => handleCSVFiles(e.target.files);
  
  const clearBtn = document.getElementById('clear-all-btn');
  if (clearBtn) {
    clearBtn.onclick = async () => {
      if (confirm('全削除しますか？')) {
        if (window.db) await window.db.clearAll();
        allRecords = {};
        initPeriodSelector();
        renderAll();
      }
    };
  }
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) exportBtn.onclick = exportAllData;
  const importBtn = document.getElementById('import-data-btn');
  if (importBtn) importBtn.onclick = () => document.getElementById('import-file-input').click();
  const importInput = document.getElementById('import-file-input');
  if (importInput) importInput.onchange = (e) => importAllData(e.target.files[0]);
}

// ===== CSV処理 =====
async function handleCSVFiles(files) {
  const statusEl = document.getElementById('csv-status');
  if (statusEl) statusEl.innerHTML = '<p>処理中...</p>';
  let successCount = 0;
  for (const file of files) {
    try {
      const text = await file.text();
      const records = parseCSV(text);
      if (records.length === 0) continue;
      const ym = records[0].date.substring(0, 7);
      let merged = records;
      if (allRecords[ym]) {
        const map = new Map();
        allRecords[ym].forEach(r => map.set(`${r.name}_${r.date}`, r));
        records.forEach(r => map.set(`${r.name}_${r.date}`, r));
        merged = Array.from(map.values());
      }
      if (window.db) await window.db.saveMonthlyData(ym, merged);
      allRecords[ym] = merged;
      successCount++;
    } catch (e) { console.error(e); }
  }
  if (statusEl) statusEl.innerHTML = `<p class="success">${successCount}件成功</p>`;
  console.log('allRecords after CSV handle:', allRecords);
  initPeriodSelector();
  renderAll();
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(',').map(c => c.trim());
    const r = {};
    headers.forEach((h, idx) => {
      let val = cols[idx] || '';
      if (!isNaN(val) && val !== '') val = Number(val);
      r[h] = val;
    });
    // 業務区分による判定
    const workType = r['業務区分'] || r['type'] || '';
    const isVacation = workType.includes('有給') || workType.includes('時間休') || workType.includes('休暇');

    const norm = {
      date: r['日付'] || r['date'],
      name: r['氏名'] || r['name'],
      dept: r['部門'] || r['dept'] || '未設定',
      totalTime: r['総業務時間'] || r['total_time'] || 0,
      otTime: r['時間外時間'] || r['ot_time'] || 0,
      breakTime: r['休憩時間'] || r['break_time'] || 0,
      vacationWork: r['休暇中業務'] || r['vacation_work'] || (isVacation ? (r['総業務時間'] || r['total_time'] || 0) : 0),
      contribution: r['貢献スコア'] || r['contribution'] || 0
    };

    // もし時間外として記録されているが、休暇中である場合は休暇中に振り替える
    if (isVacation && norm.otTime > 0) {
      norm.vacationWork += norm.otTime;
      norm.otTime = 0;
    }
    if (norm.date && norm.name) records.push(norm);
  }
  return records;
}

// ===== 描画コア =====
function renderAll() {

  const activeTab = document.querySelector('.nav-item.active')?.dataset.tab;
  const data = getAggregatedData();
  updateHeader(data);
  if (activeTab === 'summary') renderSummary(data);
  else if (activeTab === 'dashboard') {
    renderDashboard(data);
    renderDepartmentalAnalysis(data);
  }
  else if (activeTab === 'dept') renderDepartmentalAnalysis(data);
  else if (activeTab === 'personal') renderPersonalAnalysis(data);
  else if (activeTab === 'daily') renderDailyAnalysis(data);
  else if (activeTab === 'alert') renderAlerts(data);
  else if (activeTab === 'csv') renderCSVTab();
}

function getAggregatedData() {

  const months = Object.keys(allRecords).filter(m => m >= currentPeriod.start && m <= currentPeriod.end);

  let records = [];
  months.forEach(m => records = records.concat(allRecords[m]));
  if (records.length === 0) return { records: [], totalTime: 0, otTime: 0, vacationWork: 0, totalBusinessDays: 0, uniqueUserCount: 0, avgContributionPerUser: 0, avgBreakTimePerDayPerUser: 0 };
  
  const totalTime = records.reduce((s, r) => s + r.totalTime, 0);
  const otTime = records.reduce((s, r) => s + r.otTime, 0);
  const vacationWork = records.reduce((s, r) => s + r.vacationWork, 0);
  const totalBreak = records.reduce((s, r) => s + r.breakTime, 0);
  const totalScore = records.reduce((s, r) => s + r.contribution, 0);
  const users = new Set(records.map(r => r.name));
  const dates = new Set(records.map(r => r.date));
  
  return {
    records, totalTime, otTime, vacationWork,
    totalBusinessDays: dates.size,
    uniqueUserCount: users.size,
    avgContributionPerUser: totalScore / records.length,
    avgBreakTimePerDayPerUser: (records.length > 0) ? (totalBreak / records.length) : 0 // すでに分単位で入っている想定
  };
}

function updateHeader(data) {
  const el = document.getElementById('header-update');
  if (el) el.textContent = `集計対象: ${data.uniqueUserCount}名 / 営業日数: ${data.totalBusinessDays}日`;
}

// --- Summary ---
function renderSummary(data) {
  const scoreEl = document.getElementById("sum-avg-contribution");
  const riskEl = document.getElementById("sum-avg-risk");
  const alertEl = document.getElementById("sum-alert-count");
  if (!data.records.length) {
    [scoreEl, riskEl, alertEl].forEach(e => { if (e) e.textContent = "--"; });
    return;
  }
  const userStats = {};
  data.records.forEach(r => {
    if (!userStats[r.name]) userStats[r.name] = { ot: 0, vw: 0, score: 0, count: 0 };
    userStats[r.name].ot += r.otTime;
    userStats[r.name].vw += r.vacationWork;
    userStats[r.name].score += r.contribution;
    userStats[r.name].count++;
  });
  let totalRisk = 0;
  const userRisks = {};
  for (const n in userStats) {
    const s = userStats[n];
    const risk = (s.ot * 1.0 + s.vw * 3.0); // 休暇中業務の重みをさらに増やし、時間外も1.0に修正
    totalRisk += risk;
    userRisks[n] = { name: n, x: s.score / s.count, y: risk };
  }
  if (scoreEl) scoreEl.textContent = data.avgContributionPerUser.toFixed(1);
  if (riskEl) riskEl.textContent = (totalRisk / data.uniqueUserCount).toFixed(2);
  const alerts = calculateAlerts(data.records, currentSettings);
  if (alertEl) alertEl.textContent = `${new Set(alerts.map(a => a.name)).size}名`;

  renderSummaryCharts(userRisks, userStats);
}

function renderSummaryCharts(userRisks, userStats) {
  const ctxB = document.getElementById("chart-summary-bubble")?.getContext('2d');
  if (ctxB) {
    if (summaryBubbleChart) summaryBubbleChart.destroy();
    summaryBubbleChart = new Chart(ctxB, {
      type: 'bubble',
      data: { datasets: [{ label: 'メンバー分布', data: Object.values(userRisks).map(u => ({ x: u.x, y: u.y, r: 8 })), backgroundColor: 'rgba(79, 142, 247, 0.6)' }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: '貢献度スコア' } }, y: { title: { display: true, text: '負荷リスク' } } } }
    });
  }
  const ctxP = document.getElementById("chart-risk-level-pie")?.getContext('2d');
  if (ctxP) {
    if (riskLevelPieChart) riskLevelPieChart.destroy();
    const lv = { "低": 0, "中": 0, "高": 0 };
    for (const n in userStats) {
      const r = (userStats[n].ot * 1.0 + userStats[n].vw * 3.0);
      if (r > 10.0) lv["高"]++; else if (r > 5.0) lv["中"]++; else lv["低"]++;
    }
    riskLevelPieChart = new Chart(ctxP, {
      type: 'pie',
      data: { labels: Object.keys(lv), datasets: [{ data: Object.values(lv), backgroundColor: ['#4bc0c0', '#ffcd56', '#ff6384'] }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

// --- Dashboard ---
function renderDashboard(data) {
  if (!data.records.length) return;
  document.getElementById("kpi-total").textContent = `${data.totalTime.toFixed(1)}h`;
  document.getElementById("kpi-ot").textContent = `${data.otTime.toFixed(1)}h`;
  document.getElementById("kpi-vacation").textContent = `${data.vacationWork.toFixed(1)}h`;
  document.getElementById("kpi-break-avg").textContent = `${data.avgBreakTimePerDayPerUser.toFixed(0)}分`;
  document.getElementById("kpi-avg").textContent = `${data.avgContributionPerUser.toFixed(1)}点`;
  
  const alerts = calculateAlerts(data.records, currentSettings);
  document.getElementById("kpi-alert-count").textContent = `${new Set(alerts.map(a => a.name)).size}名`;

  // 業務負荷スコアアラートパネルの更新
  updateScoreAlertPanel(data);

  // 時間外・休暇中業務一覧の更新
  updateOTVacationList(data);

  renderDashboardCharts(data);
}

function updateOTVacationList(data) {
  const body = document.getElementById("ot-vacation-body");
  if (!body) return;

  const filter = document.getElementById("ot-list-filter")?.value || "all";
  const filtered = data.records.filter(r => {
    if (r.otTime === 0 && r.vacationWork === 0) return false;
    if (filter !== "all" && r.name !== filter) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  body.innerHTML = filtered.length ? filtered.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.date}</td>
      <td>${r.otTime > 0 && r.vacationWork > 0 ? '時間外/休暇中' : r.otTime > 0 ? '時間外' : '休暇中'}</td>
      <td>${r.otTime.toFixed(1)}h</td>
      <td>${r.vacationWork.toFixed(1)}h</td>
      <td>-</td>
    </tr>
  `).join("") : '<tr><td colspan="6" style="text-align:center">対象データなし</td></tr>';

  // フィルタの選択肢を更新
  const filterEl = document.getElementById("ot-list-filter");
  if (filterEl && filterEl.options.length <= 1) {
    const names = Array.from(new Set(data.records.filter(r => r.otTime > 0 || r.vacationWork > 0).map(r => r.name))).sort();
    names.forEach(n => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      filterEl.appendChild(opt);
    });
  }
}

function updateScoreAlertPanel(data) {
  const userStats = {};
  data.records.forEach(r => {
    if (!userStats[r.name]) userStats[r.name] = { ot: 0, vw: 0, score: 0, count: 0 };
    userStats[r.name].ot += r.otTime;
    userStats[r.name].vw += r.vacationWork;
    userStats[r.name].score += r.contribution;
    userStats[r.name].count++;
  });

  const lv = { lv4: 0, lv3: 0, lv2: 0 };
  const memberRisks = [];

  for (const n in userStats) {
    const s = userStats[n];
    const risk = (s.ot * 1.0 + s.vw * 3.0);
    let level = 1;
    if (risk > 10.0) { level = 4; lv.lv4++; }
    else if (risk > 5.0) { level = 3; lv.lv3++; }
    else if (risk > 2.0) { level = 2; lv.lv2++; }
    
    memberRisks.push({ name: n, score: risk, level });
  }

  if (document.getElementById("sa-lv4-count")) document.getElementById("sa-lv4-count").textContent = lv.lv4;
  if (document.getElementById("sa-lv3-count")) document.getElementById("sa-lv3-count").textContent = lv.lv3;
  if (document.getElementById("sa-lv2-count")) document.getElementById("sa-lv2-count").textContent = lv.lv2;
  if (document.getElementById("sa-break-avg")) document.getElementById("sa-break-avg").textContent = `${data.avgBreakTimePerDayPerUser.toFixed(0)}分`;

  // ハイリスクメンバー TOP5
  const top5 = memberRisks.sort((a, b) => b.score - a.score).slice(0, 5);
  const top5Body = document.getElementById("sa-top-list");
  if (top5Body) {
    top5Body.innerHTML = top5.map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${m.name}</td>
        <td>${m.score.toFixed(1)}</td>
        <td>${m.level >= 4 ? '重点確認' : m.level >= 3 ? '要確認' : '注意'}</td>
      </tr>
    `).join("");
  }
}

function renderDashboardCharts(data) {
  // 業務区分別比率
  const ctxW = document.getElementById("chart-worktype")?.getContext('2d');
  if (ctxW) {
    if (dashboardWorktypeChart) dashboardWorktypeChart.destroy();
    const types = { "通常": 0, "時間外": 0, "休暇中": 0 };
    data.records.forEach(r => {
      types["通常"] += (r.totalTime - r.otTime - r.vacationWork);
      types["時間外"] += r.otTime;
      types["休暇中"] += r.vacationWork;
    });
    dashboardWorktypeChart = new Chart(ctxW, {
      type: 'doughnut',
      data: { labels: Object.keys(types), datasets: [{ data: Object.values(types), backgroundColor: ['#36a2eb', '#ff6384', '#ff9f40'] }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // 個人別業務時間
  const ctxP = document.getElementById("chart-personal")?.getContext('2d');
  if (ctxP) {
    if (dashboardPersonalChart) dashboardPersonalChart.destroy();
    const userMap = {};
    data.records.forEach(r => {
      if (!userMap[r.name]) userMap[r.name] = 0;
      userMap[r.name] += r.totalTime;
    });
    const sorted = Object.entries(userMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    dashboardPersonalChart = new Chart(ctxP, {
      type: 'bar',
      data: { labels: sorted.map(s => s[0]), datasets: [{ label: '総業務時間', data: sorted.map(s => s[1]), backgroundColor: '#4bc0c0' }] },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
    });
  }
}

// --- Dept ---
function renderDepartmentalAnalysis(data) {
  const body = document.getElementById("dept-compare-body");
  if (!body || !data.records.length) return;
  const depts = ["営業部全体", "本社", "福岡支社", "九州支社"];
  const stats = {};
  depts.forEach(d => stats[d] = { total: 0, ot: 0, score: 0, users: new Set() });
  data.records.forEach(r => {
    stats["営業部全体"].total += r.totalTime;
    stats["営業部全体"].ot += r.otTime;
    stats["営業部全体"].score += r.contribution;
    stats["営業部全体"].users.add(r.name);
    if (stats[r.dept]) {
      stats[r.dept].total += r.totalTime;
      stats[r.dept].ot += r.otTime;
      stats[r.dept].score += r.contribution;
      stats[r.dept].users.add(r.name);
    }
  });
  const metrics = [
    { l: "総業務時間", k: "total", u: "h" },
    { l: "1人1日平均", k: "avg", u: "h" },
    { l: "時間外合計", k: "ot", u: "h" },
    { l: "平均スコア", k: "score", u: "点" },
    { l: "人数", k: "count", u: "名" }
  ];
  body.innerHTML = metrics.map(m => `<tr><td>${m.l}</td>${depts.map(d => {
    const s = stats[d], u = s.users.size, b = data.totalBusinessDays;
    let v = 0;
    if (m.k === "total") v = s.total.toFixed(1);
    else if (m.k === "avg") v = (u && b) ? (s.total / u / b).toFixed(2) : 0;
    else if (m.k === "ot") v = s.ot.toFixed(1);
    else if (m.k === "score") v = u ? (s.score / u).toFixed(1) : 0;
    else if (m.k === "count") v = u;
    return `<td>${v}${m.u}</td>`;
  }).join("")}</tr>`).join("");

  renderDeptCharts(data, stats);
}

function renderDeptCharts(data, stats) {
  const ctxW = document.getElementById("chart-dept-worktype")?.getContext('2d');
  if (ctxW) {
    if (deptWorktypeChart) deptWorktypeChart.destroy();
    const labels = ["本社", "福岡支社", "九州支社"];
    const datasets = [
      { label: '通常', data: labels.map(l => stats[l].total - stats[l].ot), backgroundColor: '#36a2eb' },
      { label: '時間外', data: labels.map(l => stats[l].ot), backgroundColor: '#ff6384' }
    ];
    deptWorktypeChart = new Chart(ctxW, { type: 'bar', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } } });
  }
}

// --- Personal ---
function renderPersonalAnalysis(data) {
  const filter = document.getElementById("personal-member-filter");
  if (!filter) return;
  const members = Array.from(new Set(data.records.map(r => r.name))).sort();
  filter.innerHTML = '<option value="">-- 選択 --</option>' + members.map(m => `<option value="${m}">${m}</option>`).join("");
  
  const ctxC = document.getElementById("chart-personal-compare")?.getContext('2d');
  if (ctxC) {
    if (personalCompareChart) personalCompareChart.destroy();
    const userMap = {};
    data.records.forEach(r => { if (!userMap[r.name]) userMap[r.name] = 0; userMap[r.name] += r.totalTime; });
    personalCompareChart = new Chart(ctxC, { type: 'bar', data: { labels: Object.keys(userMap), datasets: [{ label: '総業務時間', data: Object.values(userMap), backgroundColor: '#4bc0c0' }] }, options: { responsive: true, maintainAspectRatio: false } });
  }
}

function renderPersonalDetail(data, name) {
  const section = document.getElementById("personal-detail-section");
  if (!name) { section.style.display = "none"; return; }
  section.style.display = "block";
  const records = data.records.filter(r => r.name === name).sort((a, b) => a.date.localeCompare(b.date));
  const total = records.reduce((s, r) => s + r.totalTime, 0);
  const ot = records.reduce((s, r) => s + r.otTime, 0);
  document.getElementById("pd-total-time").textContent = `${total.toFixed(1)}h`;
  document.getElementById("pd-ot-time").textContent = `${ot.toFixed(1)}h`;

  const ctxT = document.getElementById("chart-personal-trend")?.getContext('2d');
  if (ctxT) {
    if (personalTrendChart) personalTrendChart.destroy();
    personalTrendChart = new Chart(ctxT, { type: 'line', data: { labels: records.map(r => r.date), datasets: [{ label: '業務時間', data: records.map(r => r.totalTime), borderColor: '#36a2eb', fill: false }] }, options: { responsive: true, maintainAspectRatio: false } });
  }
}

// --- Daily / Alerts / CSV ---
function renderDailyAnalysis(data) { console.log("Daily rendered"); }
function renderAlerts(data) {
  const body = document.getElementById("alert-list-body");
  if (!body) return;
  const alerts = calculateAlerts(data.records, currentSettings);
  body.innerHTML = alerts.length ? alerts.map(a => `<tr><td>${a.date}</td><td>${a.name}</td><td><span class="badge-danger">${a.type}</span></td><td>${a.value}</td></tr>`).join("") : '<tr><td colspan="4">なし</td></tr>';
}

async function renderCSVTab() {
  const body = document.getElementById('stored-data-list');
  if (!body || !window.db) return;
  const meta = await window.db.getAllMetadata();
  body.innerHTML = meta.length ? meta.sort((a, b) => b.ym.localeCompare(a.ym)).map(m => `<tr><td>${m.ym}</td><td>${m.count}件</td><td>${m.userCount}名</td><td>${new Date(m.updatedAt).toLocaleString()}</td><td><button class="btn-icon" onclick="deleteData('${m.ym}')">🗑️</button></td></tr>`).join("") : '<tr><td colspan="5">なし</td></tr>';
}

function calculateAlerts(records, settings) {
  const alerts = [];
  records.forEach(r => {
    if (r.otTime >= settings.otAlert) alerts.push({ date: r.date, name: r.name, type: '時間外', value: `${r.otTime}h` });
    if (r.vacationWork >= settings.vacationAlert) alerts.push({ date: r.date, name: r.name, type: '休暇中', value: `${r.vacationWork}h` });
    if (r.breakTime < settings.breakAlert / 60) alerts.push({ date: r.date, name: r.name, type: '休憩不足', value: `${(r.breakTime * 60).toFixed(0)}分` });
  });
  return alerts;
}

function exportAllData() {
  const blob = new Blob([JSON.stringify(allRecords)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

async function importAllData(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    for (const ym in data) {
      if (window.db) await window.db.saveMonthlyData(ym, data[ym]);
      allRecords[ym] = data[ym];
    }
    alert("完了");
    initPeriodSelector();
    renderAll();
  } catch (e) { alert("エラー"); }
}
