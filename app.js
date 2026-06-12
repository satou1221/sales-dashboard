/**
 * 営業部 業務時間ダッシュボード - Core Logic (v4.8.0)
 */

console.log('app.js loading...');

// ===== 定数・グローバル変数 =====
const SETTINGS_VERSION = '4.8.0';
const DEFAULT_LEVEL_CONFIG = {
  lv1Max: 50,
  lv2Max: 100,
  lv3Max: 200,
  otAlert: 1.5, // 時間外アラートのデフォルト値 (時間)
  vacationAlert: 0.1, // 休暇中業務アラートのデフォルト値 (時間)
  breakAlert: 45, // 休憩不足アラートのデフォルト値 (分)
  version: SETTINGS_VERSION
};

let allRecords = {}; // { '2024-05': [...], '2024-06': [...] }
let currentSettings = {};
let currentPeriod = { start: '', end: '' };

// ===== 初期化処理 =====
window.addEventListener('load', async () => {
  console.log('App initializing (window.load)...');
  
  // 1. 設定の読み込み
  loadSettings();
  
  // 2. データの読み込み (IndexedDB)
  try {
    if (window.db) {
      await window.db.init(); // 明示的に初期化を待つ
      allRecords = await window.db.getAllData();
      console.log('Data loaded from IndexedDB:', Object.keys(allRecords));
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }

  // 3. UI初期化
  initPeriodSelector();
  initEventListeners();
  
  // 4. ログイン状態チェック
  checkLoginStatus();
});

// ===== ログイン管理 =====
function checkLoginStatus() {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');
  if (isLoggedIn === 'true') {
    showMainScreen();
  } else {
    showLoginScreen();
  }
}

function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const mainScreen = document.getElementById('main-screen');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (mainScreen) mainScreen.style.display = 'none';
}

function showMainScreen() {
  const loginScreen = document.getElementById('login-screen');
  const mainScreen = document.getElementById('main-screen');
  if (loginScreen) loginScreen.style.display = 'none';
  if (mainScreen) mainScreen.style.display = 'flex';
  renderAll();
}

function handleLogin() {
  console.log('handleLogin called');
  const passwordInput = document.getElementById('login-password');
  const password = passwordInput ? passwordInput.value : '';
  const storedPassword = localStorage.getItem('dash_password') || 'admin1234';
  
  console.log('Attempting login...');
  if (password === storedPassword) {
    console.log('Login success');
    sessionStorage.setItem('isLoggedIn', 'true');
    showMainScreen();
  } else {
    console.log('Login failed');
    const errorEl = document.getElementById('login-error');
    if (errorEl) {
      errorEl.style.display = 'block';
      setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
    }
  }
}

function doLogout() {
  sessionStorage.removeItem('isLoggedIn');
  location.reload();
}

// グローバル公開
window.handleLogin = handleLogin;
window.doLogout = doLogout;
window.switchTab = switchTab;

// ===== 設定管理 =====
function loadSettings() {
  const stored = localStorage.getItem("dash_settings");
  if (stored) {
    try {
      currentSettings = JSON.parse(stored);
      currentSettings = { ...DEFAULT_LEVEL_CONFIG, ...currentSettings, version: SETTINGS_VERSION };
    } catch (e) {
      currentSettings = { ...DEFAULT_LEVEL_CONFIG };
    }
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

// ===== タブ切り替え =====
function switchTab(tabId) {
  console.log('Switching to tab:', tabId);
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = content.id === `tab-${tabId}` ? 'block' : 'none';
  });
  
  renderAll();
}

// ===== イベントリスナー =====
function initEventListeners() {
  const saveAlertSettingsBtn = document.getElementById("save-alert-settings-btn");
  if (saveAlertSettingsBtn) {
    saveAlertSettingsBtn.onclick = () => {
      currentSettings.otAlert = parseFloat(document.getElementById("setting-ot-alert").value);
      currentSettings.vacationAlert = parseFloat(document.getElementById("setting-vacation-alert").value);
      currentSettings.breakAlert = parseFloat(document.getElementById("setting-break-alert").value);
      saveSettings();
      alert("アラート設定を保存しました。");
      renderAll();
    };
  }

  const fileInput = document.getElementById('csv-file-input');
  if (fileInput) fileInput.onchange = (e) => handleCSVFiles(e.target.files);

  const clearBtn = document.getElementById('clear-all-btn');
  if (clearBtn) {
    clearBtn.onclick = async () => {
      if (confirm('すべての保存済みデータを削除しますか？')) {
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
  let errorCount = 0;

  for (const file of files) {
    try {
      const text = await file.text();
      const records = parseCSV(text);
      if (records.length === 0) throw new Error('データが空です');

      const firstDate = records[0].date;
      const ym = firstDate.substring(0, 7);

      let mergedRecords = records;
      if (allRecords[ym]) {
        const existingRecords = allRecords[ym];
        const recordMap = new Map();
        existingRecords.forEach(r => recordMap.set(`${r.name}_${r.date}`, r));
        records.forEach(r => recordMap.set(`${r.name}_${r.date}`, r));
        mergedRecords = Array.from(recordMap.values());
      }

      if (window.db) await window.db.saveMonthlyData(ym, mergedRecords);
      allRecords[ym] = mergedRecords;
      successCount++;
    } catch (e) {
      console.error(e);
      errorCount++;
    }
  }

  if (statusEl) {
    statusEl.innerHTML = `<p class="success">${successCount}件の取込に成功しました</p>`;
    if (errorCount > 0) statusEl.innerHTML += `<p class="error">${errorCount}件の失敗がありました</p>`;
  }

  initPeriodSelector();
  renderAll();
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = lines[i].split(',');
    const record = {};
    headers.forEach((h, idx) => {
      const key = h.trim();
      let val = cols[idx] ? cols[idx].trim() : '';
      if (!isNaN(val) && val !== '') val = Number(val);
      record[key] = val;
    });
    
    const normalized = {
      date: record['日付'] || record['date'],
      name: record['氏名'] || record['name'],
      dept: record['部門'] || record['dept'] || '未設定',
      totalTime: record['総業務時間'] || record['total_time'] || 0,
      otTime: record['時間外時間'] || record['ot_time'] || 0,
      breakTime: record['休憩時間'] || record['break_time'] || 0,
      vacationWork: record['休暇中業務'] || record['vacation_work'] || 0,
      contribution: record['貢献スコア'] || record['contribution'] || 0
    };
    
    if (normalized.date && normalized.name) {
      records.push(normalized);
    }
  }
  return records;
}

// ===== データ集計・描画 =====
function renderAll() {
  const activeTabEl = document.querySelector('.nav-item.active');
  if (!activeTabEl) return;
  const activeTab = activeTabEl.dataset.tab;
  const data = getAggregatedData();
  
  updateHeader(data);
  
  switch (activeTab) {
    case 'summary': renderSummary(data); break;
    case 'dashboard': renderDashboard(data); break;
    case 'dept': renderDepartmentalAnalysis(data); break;
    case 'personal': renderPersonalAnalysis(data); break;
    case 'daily': renderDailyAnalysis(data); break;
    case 'alert': renderAlerts(data); break;
    case 'csv': renderCSVTab(); break;
  }
}

async function renderCSVTab() {
  const body = document.getElementById('stored-data-list');
  if (!body) return;

  try {
    if (!window.db) return;
    const metadata = await window.db.getAllMetadata();
    
    if (metadata.length === 0) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;">保存済みのデータはありません</td></tr>';
      return;
    }

    // 日付順にソート
    metadata.sort((a, b) => b.ym.localeCompare(a.ym));

    body.innerHTML = metadata.map(m => `
      <tr>
        <td>${m.ym}</td>
        <td>${m.count}件</td>
        <td>${m.userCount}名</td>
        <td>${new Date(m.updatedAt).toLocaleString()}</td>
        <td>
          <button class="btn-icon" onclick="deleteData('${m.ym}')" title="削除">🗑️</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Failed to render CSV tab:', e);
    body.innerHTML = '<tr><td colspan="5">データの読み込みに失敗しました</td></tr>';
  }
}

async function deleteData(ym) {
  if (confirm(`${ym} のデータを削除しますか？`)) {
    try {
      await window.db.deleteMonthlyData(ym);
      delete allRecords[ym];
      initPeriodSelector();
      renderAll();
    } catch (e) {
      alert('削除に失敗しました');
    }
  }
}

window.deleteData = deleteData;

function getAggregatedData() {
  const selectedMonths = Object.keys(allRecords)
    .filter(m => m >= currentPeriod.start && m <= currentPeriod.end);
  
  let records = [];
  selectedMonths.forEach(m => {
    records = records.concat(allRecords[m]);
  });

  if (records.length === 0) return { records: [], totalTime: 0, otTime: 0, vacationWork: 0 };

  const totalTime = records.reduce((sum, r) => sum + r.totalTime, 0);
  const otTime = records.reduce((sum, r) => sum + r.otTime, 0);
  const vacationWork = records.reduce((sum, r) => sum + r.vacationWork, 0);
  const totalBreakTime = records.reduce((sum, r) => sum + r.breakTime, 0);
  const totalContribution = records.reduce((sum, r) => sum + r.contribution, 0);
  
  const uniqueUsers = new Set(records.map(r => r.name));
  const uniqueDates = new Set(records.map(r => r.date));
  const totalBusinessDays = uniqueDates.size;

  return {
    records,
    totalTime,
    otTime,
    vacationWork,
    totalBusinessDays,
    uniqueUserCount: uniqueUsers.size,
    avgContributionPerUser: totalContribution / uniqueUsers.size,
    avgBreakTimePerDayPerUser: (uniqueUsers.size > 0 && totalBusinessDays > 0) 
      ? (totalBreakTime / uniqueUsers.size / totalBusinessDays) : 0
  };
}

function updateHeader(data) {
  const updateEl = document.getElementById('header-update');
  if (updateEl) {
    updateEl.textContent = `集計対象: ${data.uniqueUserCount}名 / 営業日数: ${data.totalBusinessDays}日`;
  }
}

// --- Summary ---
let summaryBubbleChart = null;
let riskLevelPieChart = null;

function renderSummary(data) {
  const avgScoreEl = document.getElementById("summary-avg-score");
  const avgRiskEl = document.getElementById("summary-avg-risk");
  const alertUsersEl = document.getElementById("summary-alert-users");

  if (!data || data.records.length === 0) {
    if (avgScoreEl) avgScoreEl.textContent = "--";
    if (avgRiskEl) avgRiskEl.textContent = "--";
    if (alertUsersEl) alertUsersEl.textContent = "--";
    return;
  }

  const userStats = {};
  data.records.forEach(r => {
    if (!userStats[r.name]) userStats[r.name] = { otTime: 0, vacationWork: 0, contribution: 0, count: 0 };
    userStats[r.name].otTime += r.otTime;
    userStats[r.name].vacationWork += r.vacationWork;
    userStats[r.name].contribution += r.contribution;
    userStats[r.name].count++;
  });

  let totalRisk = 0;
  let userCount = 0;
  const userRisks = {};

  for (const name in userStats) {
    const s = userStats[name];
    const risk = (s.otTime * 0.5 + s.vacationWork * 0.3);
    totalRisk += risk;
    userCount++;
    userRisks[name] = {
      name,
      x: s.contribution / s.count,
      y: risk
    };
  }

  if (avgScoreEl) avgScoreEl.textContent = (data.avgContributionPerUser).toFixed(1);
  if (avgRiskEl) avgRiskEl.textContent = (totalRisk / userCount).toFixed(2);
  
  const alerts = calculateAlerts(data.records, currentSettings);
  const uniqueAlertUsers = new Set(alerts.map(a => a.name)).size;
  if (alertUsersEl) alertUsersEl.textContent = `${uniqueAlertUsers}名`;

  renderSummaryBubbleChart(userRisks);
  renderRiskLevelPieChart(userStats);
}

function renderSummaryBubbleChart(userRisks) {
  const canvas = document.getElementById("chart-summary-bubble");
  if (!canvas) return;
  if (summaryBubbleChart) summaryBubbleChart.destroy();
  
  summaryBubbleChart = new Chart(canvas, {
    type: 'bubble',
    data: {
      datasets: [{
        label: 'メンバー分布',
        data: Object.values(userRisks).map(u => ({ x: u.x, y: u.y, r: 8 })),
        backgroundColor: 'rgba(79, 142, 247, 0.6)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: '貢献度スコア' } },
        y: { title: { display: true, text: '負荷リスク' } }
      }
    }
  });
}

function renderRiskLevelPieChart(userStats) {
  const canvas = document.getElementById("chart-risk-level-pie");
  if (!canvas) return;
  if (riskLevelPieChart) riskLevelPieChart.destroy();

  const levels = { "低": 0, "中": 0, "高": 0 };
  for (const name in userStats) {
    const s = userStats[name];
    const risk = (s.otTime * 0.5 + s.vacationWork * 0.3);
    if (risk > 2.0) levels["高"]++;
    else if (risk > 1.0) levels["中"]++;
    else levels["低"]++;
  }

  riskLevelPieChart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: Object.keys(levels),
      datasets: [{
        data: Object.values(levels),
        backgroundColor: ['#4bc0c0', '#ffcd56', '#ff6384']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// --- Dashboard ---
function renderDashboard(data) {
  const ids = ["kpi-total", "kpi-ot", "kpi-vacation", "kpi-break-avg", "kpi-avg", "kpi-alert-count"];
  if (!data || data.records.length === 0) {
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = "--"; });
    return;
  }

  document.getElementById("kpi-total").textContent = `${data.totalTime.toFixed(1)}h`;
  document.getElementById("kpi-ot").textContent = `${data.otTime.toFixed(1)}h`;
  document.getElementById("kpi-vacation").textContent = `${data.vacationWork.toFixed(1)}h`;
  document.getElementById("kpi-break-avg").textContent = `${(data.avgBreakTimePerDayPerUser * 60).toFixed(0)}分`;
  document.getElementById("kpi-avg").textContent = `${data.avgContributionPerUser.toFixed(1)}点`;
  
  const alerts = calculateAlerts(data.records, currentSettings);
  const uniqueAlertUsers = new Set(alerts.map(a => a.name)).size;
  document.getElementById("kpi-alert-count").textContent = `${uniqueAlertUsers}名`;
}

// --- Dept ---
function renderDepartmentalAnalysis(data) {
  const body = document.getElementById("dept-compare-body");
  if (!body || !data || data.records.length === 0) {
    if (body) body.innerHTML = '<tr><td colspan="5">データなし</td></tr>';
    return;
  }

  const depts = ["営業部全体", "本社", "福岡支社", "九州支社"];
  const stats = {};
  depts.forEach(d => stats[d] = { totalTime: 0, otTime: 0, contribution: 0, users: new Set() });

  data.records.forEach(r => {
    stats["営業部全体"].totalTime += r.totalTime;
    stats["営業部全体"].otTime += r.otTime;
    stats["営業部全体"].contribution += r.contribution;
    stats["営業部全体"].users.add(r.name);

    if (stats[r.dept]) {
      stats[r.dept].totalTime += r.totalTime;
      stats[r.dept].otTime += r.otTime;
      stats[r.dept].contribution += r.contribution;
      stats[r.dept].users.add(r.name);
    }
  });

  let html = "";
  const metrics = [
    { label: "総業務時間", key: "totalTime", unit: "h" },
    { label: "1人1日平均時間", key: "avgDay", unit: "h" },
    { label: "時間外合計", key: "otTime", unit: "h" },
    { label: "1人1日平均残業", key: "avgOt", unit: "h" },
    { label: "平均貢献スコア", key: "avgScore", unit: "点" },
    { label: "メンバー数", key: "count", unit: "名" }
  ];

  metrics.forEach(m => {
    html += `<tr><td>${m.label}</td>`;
    depts.forEach(d => {
      const s = stats[d];
      const u = s.users.size;
      const b = data.totalBusinessDays;
      let val = 0;
      if (m.key === "totalTime") val = s.totalTime.toFixed(1);
      else if (m.key === "avgDay") val = (u > 0 && b > 0) ? (s.totalTime / u / b).toFixed(2) : 0;
      else if (m.key === "otTime") val = s.otTime.toFixed(1);
      else if (m.key === "avgOt") val = (u > 0 && b > 0) ? (s.otTime / u / b).toFixed(2) : 0;
      else if (m.key === "avgScore") val = (u > 0) ? (s.contribution / u).toFixed(1) : 0;
      else if (m.key === "count") val = u;
      html += `<td>${val}${m.unit}</td>`;
    });
    html += `</tr>`;
  });
  body.innerHTML = html;
}

// --- Personal ---
function renderPersonalAnalysis(data) {
  const memberFilter = document.getElementById("personal-member-filter");
  if (!memberFilter) return;

  const members = Array.from(new Set(data.records.map(r => r.name))).sort();
  memberFilter.innerHTML = '<option value="">-- 選択 --</option>' + 
    members.map(m => `<option value="${m}">${m}</option>`).join("");
  
  memberFilter.onchange = () => renderPersonalDetail(data, memberFilter.value);
}

function renderPersonalDetail(data, name) {
  const detailSection = document.getElementById("personal-detail-section");
  if (!name) { detailSection.style.display = "none"; return; }
  detailSection.style.display = "block";

  const userRecords = data.records.filter(r => r.name === name);
  const totalTime = userRecords.reduce((sum, r) => sum + r.totalTime, 0);
  const otTime = userRecords.reduce((sum, r) => sum + r.otTime, 0);
  
  document.getElementById("pd-total-time").textContent = `${totalTime.toFixed(1)}h`;
  document.getElementById("pd-ot-time").textContent = `${otTime.toFixed(1)}h`;
}

// --- Daily ---
function renderDailyAnalysis(data) {
  // 簡易実装
  console.log("Daily analysis rendered");
}

// --- Alerts ---
function renderAlerts(data) {
  const body = document.getElementById("alert-list-body");
  if (!body) return;
  
  const alerts = calculateAlerts(data.records, currentSettings);
  if (alerts.length === 0) {
    body.innerHTML = '<tr><td colspan="4">アラートなし</td></tr>';
    return;
  }

  body.innerHTML = alerts.map(a => `
    <tr>
      <td>${a.date}</td>
      <td>${a.name}</td>
      <td><span class="badge-danger">${a.type}</span></td>
      <td>${a.value}</td>
    </tr>
  `).join("");
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

// --- Export/Import ---
function exportAllData() {
  const dataStr = JSON.stringify(allRecords);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

async function importAllData(file) {
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    for (const ym in data) {
      if (window.db) await window.db.saveMonthlyData(ym, data[ym]);
      allRecords[ym] = data[ym];
    }
    alert("インポート完了");
    initPeriodSelector();
    renderAll();
  } catch (e) {
    alert("エラー: " + e.message);
  }
}
