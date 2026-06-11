import db from './db.js';

/**
 * 営業部 業務時間ダッシュボード - Core Logic (v4.8.0)
 */

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
document.addEventListener('DOMContentLoaded', async () => {
  console.log('App initializing...');
  
  // 1. 設定の読み込み
  loadSettings();
  
  // 2. データの読み込み (IndexedDB)
  try {
    allRecords = await db.getAllData();
    console.log('Data loaded from IndexedDB:', Object.keys(allRecords));
  } catch (e) {
    console.error('Failed to load data:', e);
  }

  // 3. UI初期化
  initPeriodSelector();
  initEventListeners();
  
  // 4. ログイン状態チェック
  checkLoginStatus();

  // 5. ログインボタン初期化
  initLogin();
});

// グローバル関数のエクスポート
window.switchTab = switchTab;
window.doLogout = doLogout;

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
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main-screen').style.display = 'none';
}

function showMainScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';
  renderAll();
}

function initLogin() {
  const loginBtn = document.getElementById('login-button');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const passwordInput = document.getElementById('login-password');
      const password = passwordInput ? passwordInput.value : '';
      const storedPassword = localStorage.getItem('dash_password') || 'admin1234';
      
      if (password === storedPassword) {
        sessionStorage.setItem('isLoggedIn', 'true');
        showMainScreen();
      } else {
        const errorEl = document.getElementById('login-error');
        if (errorEl) {
          errorEl.style.display = 'block';
          setTimeout(() => { errorEl.style.display = 'none'; }, 3000);
        }
      }
    });
  }
}

window.doLogout = () => {
  sessionStorage.removeItem('isLoggedIn');
  location.reload();
};

// ===== 設定管理 =====
function loadSettings() {
  const stored = localStorage.getItem("dash_settings");
  if (stored) {
    try {
      currentSettings = JSON.parse(stored);
      // 新しい設定項目が追加された場合に対応
      currentSettings = { ...DEFAULT_LEVEL_CONFIG, ...currentSettings, version: SETTINGS_VERSION };
      if (currentSettings.version !== SETTINGS_VERSION) {
        saveSettings();
      }
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

// ===== イベントリスナー =====
function initEventListeners() {
  // アラート設定保存ボタンのイベントリスナー
  const saveAlertSettingsBtn = document.getElementById("save-alert-settings-btn");
  if (saveAlertSettingsBtn) {
    saveAlertSettingsBtn.onclick = () => {
      currentSettings.otAlert = parseFloat(document.getElementById("setting-ot-alert").value);
      currentSettings.vacationAlert = parseFloat(document.getElementById("setting-vacation-alert").value);
      currentSettings.breakAlert = parseFloat(document.getElementById("setting-break-alert").value);
      saveSettings();
      alert("アラート設定を保存しました。");
      renderAll(); // 設定変更を反映するため再描画
    };
  }

  // 設定タブがアクティブになったときに設定値をUIに反映
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", (e) => {
      if (e.currentTarget.dataset.tab === "settings") {
        document.getElementById("setting-ot-alert").value = currentSettings.otAlert;
        document.getElementById("setting-vacation-alert").value = currentSettings.vacationAlert;
        document.getElementById("setting-break-alert").value = currentSettings.breakAlert;
      }
    });
  });
  const fileInput = document.getElementById('csv-file-input');
  if (fileInput) fileInput.onchange = (e) => handleCSVFiles(e.target.files);

  const dropArea = document.getElementById('csv-drop-area');
  if (dropArea) {
    dropArea.ondragover = (e) => { e.preventDefault(); dropArea.classList.add('drag-over'); };
    dropArea.ondragleave = () => dropArea.classList.remove('drag-over');
    dropArea.ondrop = (e) => {
      e.preventDefault();
      dropArea.classList.remove('drag-over');
      handleCSVFiles(e.dataTransfer.files);
    };
  }

  const clearBtn = document.getElementById('clear-all-btn');
  if (clearBtn) {
    clearBtn.onclick = async () => {
      if (confirm('すべての保存済みデータを削除しますか？')) {
        await db.clearAll();
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

      // 既存データとのマージ処理
      let mergedRecords = records;
      if (allRecords[ym]) {
        const existingRecords = allRecords[ym];
        // 氏名と日付をキーにして既存データをマップ化
        const recordMap = new Map();
        existingRecords.forEach(r => recordMap.set(`${r.name}_${r.date}`, r));
        
        // 新しいデータで上書きまたは追加
        records.forEach(r => recordMap.set(`${r.name}_${r.date}`, r));
        
        // マップから配列に戻す
        mergedRecords = Array.from(recordMap.values());
      }

      await db.saveMonthlyData(ym, mergedRecords);
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
  renderStoredDataList();

  // 各タブの描画ロジック（複数月対応）
  switch (activeTab) {
    case 'summary':
      renderSummary(data);
      break;
    case 'dashboard':
      renderDashboard(data);
      break;
    case 'dept':
      renderDepartmentalAnalysis(data);
      break;
    case 'personal':
      renderPersonalAnalysis(data);
      break;
    case 'daily':
      renderDailyAnalysis(data);
      break;
    case 'alert':
      renderAlerts(data);
      break;
    case 'csv':
      // CSVタブはrenderStoredDataListで既に描画されているため、追加処理なし
      break;
    case 'settings':
      // 設定タブは特別な描画ロジックが不要な場合が多い
      break;
  }
}

/**
 * 指定された期間内の営業日数を計算します。
 * @param {string} startYm - 開始年月 (YYYY-MM)
 * @param {string} endYm - 終了年月 (YYYY-MM)
 * @returns {number} 営業日数
 */
function calculateBusinessDays(startYm, endYm) {
  let businessDays = 0;
  let currentDate = new Date(startYm + "-01");
  const endDate = new Date(endYm + "-01");
  endDate.setMonth(endDate.getMonth() + 1); // 終了月の翌月1日までを範囲とする

  while (currentDate < endDate) {
    const dayOfWeek = currentDate.getDay(); // 0:日曜, 1:月曜, ..., 6:土曜
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 土日以外
      businessDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return businessDays;
}

function getAggregatedData() {
  const { start, end } = currentPeriod;
  if (!start || !end) return null;

  const targetMonths = Object.keys(allRecords).filter(m => m >= start && m <= end);
  let combinedRecords = [];
  targetMonths.forEach(m => {
    combinedRecords = combinedRecords.concat(allRecords[m]);
  });

  if (combinedRecords.length === 0) return null;

  const stats = {
    totalTime: 0,
    otTime: 0,
    breakTime: 0,
    vacationWor    stats.contribution: 0,
    totalBusinessDays: calculateBusinessDays(start, end),
    uniqueDaysWithData: new Set(combinedRecords.map(r => r.date)).size,
    uniqueUsersWithData: new Set(combinedRecords.map(r => r.name)).size,
    records: combinedRecords
  };

  combinedRecords.forEach(r => {
    stats.totalTime += r.totalTime;
    stats.otTime += r.otTime;
    stats.breakTime += r.breakTime;
    stats.vacationWork += r.vacationWork;
    stats.contribution += r.contribution;
  });

  // 派生指標の計算
  stats.avgContributionPerUser = stats.uniqueUsersWithData > 0 ? stats.contribution / stats.uniqueUsersWithData : 0;
  stats.avgTotalTimePerUserPerBusinessDay = (stats.uniqueUsersWithData > 0 && stats.totalBusinessDays > 0) ? stats.totalTime / stats.uniqueUsersWithData / stats.totalBusinessDays : 0;
  stats.avgOtTimePerUserPerBusinessDay = (stats.uniqueUsersWithData > 0 && stats.totalBusinessDays > 0) ? stats.otTime / stats.uniqueUsersWithData / stats.totalBusinessDays : 0;
  // 休憩時間は、データが存在するユニークな日数で割るのが適切か
  stats.avgBreakTimePerDayPerUser = (stats.uniqueUsersWithData > 0 && stats.uniqueDaysWithData > 0) ? stats.breakTime / stats.uniqueUsersWithData / stats.uniqueDaysWithData : 0;

  return stats;
}

function renderSummary(data) {
  const sumAvgContributionEl = document.getElementById("sum-avg-contribution");
  const sumAvgRiskEl = document.getElementById("sum-avg-risk");
  const sumAlertCountEl = document.getElementById("sum-alert-count");

  if (!data || !data.records || data.records.length === 0) {
    if (sumAvgContributionEl) sumAvgContributionEl.textContent = "--";
    if (sumAvgRiskEl) sumAvgRiskEl.textContent = "--";
    if (sumAlertCountEl) sumAlertCountEl.textContent = "--";
    return;
  }

  // 平均貢献スコアの計算
  const avgContribution = data.avgContributionPerUser;
  if (sumAvgContributionEl) sumAvgContributionEl.textContent = avgContribution.toFixed(1);

  // 平均負荷リスクの計算
  const userRisks = {};
  data.records.forEach(r => {
    if (!userRisks[r.name]) {
      userRisks[r.name] = { otTime: 0, vacationWork: 0, breakTime: 0, totalTime: 0 };
    }
    userRisks[r.name].otTime += r.otTime;
    userRisks[r.name].vacationWork += r.vacationWork;
    userRisks[r.name].breakTime += r.breakTime;
    userRisks[r.name].totalTime += r.totalTime;
  });

  let totalRisk = 0;
  let riskCount = 0;
  for (const name in userRisks) {
    const user = userRisks[name];
    const risk = (user.otTime * 0.5 + user.vacationWork * 0.3);
    totalRisk += risk;
    riskCount++;
  }
  const avgRisk = riskCount > 0 ? (totalRisk / riskCount).toFixed(2) : 0;
  if (sumAvgRiskEl) sumAvgRiskEl.textContent = avgRisk;

  // 要対応者数 (Lv.3以上 = リスク > 2.0)
  let lv3Count = 0;
  for (const name in userRisks) {
    const user = userRisks[name];
    const risk = (user.otTime * 0.5 + user.vacationWork * 0.3);
    if (risk > 2.0) lv3Count++;
  }
  if (sumAlertCountEl) sumAlertCountEl.textContent = `${lv3Count}名`;

  // バブルチャート（貢献度 × 負荷リスク）
  renderSummaryBubbleChart(userRisks);

  // リスクレベルパイチャート
  renderRiskLevelPieChart(userRisks);
}

let summaryBubbleChart = null;
function renderSummaryBubbleChart(userRisks) {
  const canvas = document.getElementById("chart-summary-bubble");
  if (!canvas) return;

  const bubbleData = [];
  for (const name in userRisks) {
    const user = userRisks[name];
    const risk = (user.otTime * 0.5 + user.vacationWork * 0.3);
    const contribution = user.totalTime > 0 ? (user.otTime / user.totalTime * 100) : 0; // 仮の貢献度計算
    bubbleData.push({
      x: contribution,
      y: risk,
      r: 10,
      name: name
    });
  }

  if (summaryBubbleChart) summaryBubbleChart.destroy();
  summaryBubbleChart = new Chart(canvas, {
    type: 'bubble',
    data: {
      datasets: [{
        label: 'メンバー分布',
        data: bubbleData,
        backgroundColor: 'rgba(54, 162, 235, 0.6)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: '貢献度スコア' }, min: 0, max: 100 },
        y: { title: { display: true, text: '負荷リスク' }, min: 0 }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => {
              const p = context.raw;
              return `${p.name}: 貢献度 ${p.x.toFixed(1)}, リスク ${p.y.toFixed(2)}`;
            }
          }
        }
      }
    }
  });
}

let riskLevelPieChart = null;
function renderRiskLevelPieChart(userRisks) {
  const canvas = document.getElementById("chart-risk-level-pie");
  if (!canvas) return;

  const levels = { "低リスク": 0, "中リスク": 0, "高リスク": 0 };
  for (const name in userRisks) {
    const user = userRisks[name];
    const risk = (user.otTime * 0.5 + user.vacationWork * 0.3);
    if (risk > 2.0) levels["高リスク"]++;
    else if (risk > 1.0) levels["中リスク"]++;
    else levels["低リスク"]++;
  }

  if (riskLevelPieChart) riskLevelPieChart.destroy();
  riskLevelPieChart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: Object.keys(levels),
      datasets: [{
        data: Object.values(levels),
        backgroundColor: ['#4bc0c0', '#ffcd56', '#ff6384']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function renderDashboard(data) {
  const kpiTotalEl = document.getElementById("kpi-total");
  const kpiOtEl = document.getElementById("kpi-ot");
  const kpiVacationEl = document.getElementById("kpi-vacation");
  const kpiBreakAvgEl = document.getElementById("kpi-break-avg");
  const kpiAvgEl = document.getElementById("kpi-avg");
  const kpiAlertCountEl = document.getElementById("kpi-alert-count");

  if (!data || !data.records || data.records.length === 0) {
    if (kpiTotalEl) kpiTotalEl.textContent = "--";
    if (kpiOtEl) kpiOtEl.textContent = "--";
    if (kpiVacationEl) kpiVacationEl.textContent = "--";
    if (kpiBreakAvgEl) kpiBreakAvgEl.textContent = "--";
    if (kpiAvgEl) kpiAvgEl.textContent = "--";
    if (kpiAlertCountEl) kpiAlertCountEl.textContent = "--";
    return;
  }

  // KPIの更新
  if (kpiTotalEl) kpiTotalEl.textContent = `${data.totalTime.toFixed(1)}h`;
  if (kpiOtEl) kpiOtEl.textContent = `${data.otTime.toFixed(1)}h`;
  if (kpiVacationEl) kpiVacationEl.textContent = `${data.vacationWork.toFixed(1)}h`;
  if (kpiBreakAvgEl) kpiBreakAvgEl.textContent = `${(data.avgBreakTimePerDayPerUser * 60).toFixed(0)}分`; // 時間を分に変換
  if (kpiAvgEl) kpiAvgEl.textContent = `${data.avgContributionPerUser.toFixed(1)}点`;

  // アラート数の計算と表示
  const alerts = calculateAlerts(data.records, currentSettings);
  const uniqueAlertUsers = new Set(alerts.map(alert => alert.name)).size;
  if (kpiAlertCountEl) kpiAlertCountEl.textContent = `${uniqueAlertUsers}名`;

  // TODO: 前月比/前期間比のロジックを実装
}

function renderDepartmentalAnalysis(data) {
  const deptCompareBody = document.getElementById("dept-compare-body");
  if (!deptCompareBody || !data || !data.records || data.records.length === 0) {
    if (deptCompareBody) deptCompareBody.innerHTML = '<tr><td colspan="5">データがありません</td></tr>';
    return;
  }

  const departmentalStats = {
    "本社": { totalTime: 0, otTime: 0, contribution: 0, users: new Set() },
    "福岡支社": { totalTime: 0, otTime: 0, contribution: 0, users: new Set() },
    "九州支社": { totalTime: 0, otTime: 0, contribution: 0, users: new Set() }
  };
  const totalBusinessDays = data.totalBusinessDays;



  const departments = ["営業部全体", "本社", "福岡支社", "九州支社"]; // 固定の部門リスト
  const allDeptRecords = data.records;

  // "営業部全体"の統計を計算
  const totalDeptStats = {
    totalTime: 0,
    otTime: 0,
    contribution: 0,
    users: new Set()
  };
  allDeptRecords.forEach(record => {
    totalDeptStats.totalTime += record.totalTime;
    totalDeptStats.otTime += record.otTime;
    totalDeptStats.contribution += record.contribution;
    totalDeptStats.users.add(record.name);
  });
  departmentalStats["営業部全体"] = totalDeptStats;

  // 各部門の統計を計算
  allDeptRecords.forEach(record => {
    const dept = record.dept || '未設定';
    if (departmentalStats[dept]) { // 事前定義された部門のみを処理
      departmentalStats[dept].totalTime += record.totalTime;
      departmentalStats[dept].otTime += record.otTime;
      departmentalStats[dept].contribution += record.contribution;
      departmentalStats[dept].users.add(record.name);
    }
  });
  let tableHtml = "";
  const metrics = [
    { label: "総業務時間", key: "totalTime", unit: "h" },
    { label: "1人1営業日あたり総業務時間", key: "avgTotalTimePerUserPerBusinessDay", unit: "h" },
    { label: "時間外合計", key: "otTime", unit: "h" },
    { label: "1人1営業日あたり時間外時間", key: "avgOtTimePerUserPerBusinessDay", unit: "h" },
    { label: "1人あたり平均貢献スコア", key: "avgContributionPerUser", unit: "点" },
    { label: "メンバー数", key: "uniqueUsersInDept", unit: "名" }
  ];

  metrics.forEach(metric => {
    tableHtml += `<tr><td>${metric.label}</td>`;
    departments.forEach(dept => {
      const stats = departmentalStats[dept] || { totalTime: 0, otTime: 0, contribution: 0, users: new Set() };
      const uniqueUsersInDept = stats.users.size;

      const totalTime = stats.totalTime;
      const otTime = stats.otTime;
      const contribution = stats.contribution;

      const avgTotalTimePerUserPerBusinessDay = (uniqueUsersInDept > 0 && totalBusinessDays > 0)
        ? (totalTime / uniqueUsersInDept / totalBusinessDays).toFixed(2)
        : 0;
      const avgOtTimePerUserPerBusinessDay = (uniqueUsersInDept > 0 && totalBusinessDays > 0)
        ? (otTime / uniqueUsersInDept / totalBusinessDays).toFixed(2)
        : 0;
      const avgContributionPerUser = (uniqueUsersInDept > 0)
        ? (contribution / uniqueUsersInDept).toFixed(2)
        : 0;
      
      let value = 0;
      if (metric.key === "totalTime") {
        value = totalTime.toFixed(2);
      } else if (metric.key === "otTime") {
        value = otTime.toFixed(2);
      } else if (metric.key === "uniqueUsersInDept") {
        value = uniqueUsersInDept;
      } else if (metric.key === "avgTotalTimePerUserPerBusinessDay") {
        value = avgTotalTimePerUserPerBusinessDay;
      } else if (metric.key === "avgOtTimePerUserPerBusinessDay") {
        value = avgOtTimePerUserPerBusinessDay;
      } else if (metric.key === "avgContributionPerUser") {
        value = avgContributionPerUser;
      }
      tableHtml += `<td>${value}${metric.unit}</td>`;
    });
    tableHtml += `</tr>`;
  });
  deptCompareBody.innerHTML = tableHtml;
}

function renderPersonalAnalysis(data) {
  const personalDeptFilter = document.getElementById("personal-dept-filter");
  const personalMemberFilter = document.getElementById("personal-member-filter");
  
  if (!personalDeptFilter || !personalMemberFilter || !data || !data.records || data.records.length === 0) {
    if (personalDeptFilter) personalDeptFilter.innerHTML = 
      `<option value="all">全員</option>`;
    if (personalMemberFilter) personalMemberFilter.innerHTML = 
      `<option value="">-- 選択 --</option>`;
    document.getElementById("personal-compare-section").style.display = "block";
    document.getElementById("personal-detail-section").style.display = "none";
    return;
  }

  const uniqueDepts = new Set(data.records.map(r => r.dept || '未設定'));
  const uniqueMembers = new Set(data.records.map(r => r.name));

  // 部門フィルターの更新
  personalDeptFilter.innerHTML = 
    `<option value="all">全員</option>` +
    Array.from(uniqueDepts).sort().map(dept => `<option value="${dept}">${dept}</option>`).join("");

  // メンバーフィルターの更新
  personalMemberFilter.innerHTML = 
    `<option value="">-- 選択 --</option>` +
    Array.from(uniqueMembers).sort().map(name => `<option value="${name}">${name}</option>`).join("");

  // 現在選択されているフィルター値を保持
  const selectedDept = personalDeptFilter.value;
  const selectedMember = personalMemberFilter.value;

  // フィルターが変更された際のイベントリスナーを再設定
  personalDeptFilter.onchange = () => renderPersonalAnalysis(data);
  personalMemberFilter.onchange = () => renderPersonalDetail(data);

  // 選択されたメンバーに応じて表示を切り替える
  if (selectedMember && selectedMember !== "") {
    document.getElementById("personal-compare-section").style.display = "none";
    document.getElementById("personal-detail-section").style.display = "block";
    renderPersonalDetail(data, selectedMember);
  } else {
    document.getElementById("personal-compare-section").style.display = "block";
    document.getElementById("personal-detail-section").style.display = "none";
    renderPersonalCompare(data, selectedDept);
  }
}

// 個人別比較グラフの描画関数 (メンバー未選択時)
let personalCompareChart = null;
function renderPersonalCompare(data, selectedDept) {
  const personalCompareCanvas = document.getElementById("chart-personal-compare");
  if (!personalCompareCanvas || !data || !data.records || data.records.length === 0) {
    if (personalCompareChart) personalCompareChart.destroy();
    return;
  }

  const filteredRecords = selectedDept === "all"
    ? data.records
    : data.records.filter(r => (r.dept || '未設定') === selectedDept);

  const userStats = {};
  filteredRecords.forEach(record => {
    if (!userStats[record.name]) {
      userStats[record.name] = {
        totalTime: 0,
        otTime: 0,
        contribution: 0
      };
    }
    userStats[record.name].totalTime += record.totalTime;
    userStats[record.name].otTime += record.otTime;
    userStats[record.name].contribution += record.contribution;
  });

  const labels = Object.keys(userStats).sort();
  const totalTimes = labels.map(name => userStats[name].totalTime);
  const otTimes = labels.map(name => userStats[name].otTime);

  if (personalCompareChart) {
    personalCompareChart.destroy();
  }

  personalCompareChart = new Chart(personalCompareCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '総業務時間',
          data: totalTimes,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: '時間外時間',
          data: otTimes,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          title: {
            display: true,
            text: 'メンバー'
          }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          title: {
            display: true,
            text: '時間 (h)'
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: `個人別 業務時間比較 (${selectedDept === "all" ? "全" : selectedDept}メンバー)`
        }
      }
    }
  });
}

// 個人詳細分析の描画関数 (メンバー選択時)
function renderPersonalDetail(data, selectedMember) {
  if (!data || !data.records || data.records.length === 0 || !selectedMember) {
    // Clear all personal detail elements if no data or no member selected
    document.getElementById("pc-score-val").textContent = "--";
    document.getElementById("pc-lv-badge").textContent = "Lv.--";
    document.getElementById("pc-kpi-total").textContent = "--";
    document.getElementById("pc-kpi-ot").textContent = "--";
    document.getElementById("pc-kpi-vac").textContent = "--";
    document.getElementById("pc-kpi-break").textContent = "--";
    document.getElementById("pc-kpi-party").textContent = "--";
    return;
  }

  const memberRecords = data.records.filter(r => r.name === selectedMember);
  if (memberRecords.length === 0) {
    // Clear all personal detail elements if no data for selected member
    document.getElementById("pc-score-val").textContent = "--";
    document.getElementById("pc-lv-badge").textContent = "Lv.--";
    document.getElementById("pc-kpi-total").textContent = "--";
    document.getElementById("pc-kpi-ot").textContent = "--";
    document.getElementById("pc-kpi-vac").textContent = "--";
    document.getElementById("pc-kpi-break").textContent = "--";
    document.getElementById("pc-kpi-party").textContent = "--";
    return;
  }

  let totalTime = 0;
  let otTime = 0;
  let breakTime = 0;
  let vacationWork = 0;
  let contribution = 0;
  const uniqueDates = new Set();

  memberRecords.forEach(r => {
    totalTime += r.totalTime;
    otTime += r.otTime;
    breakTime += r.breakTime;
    vacationWork += r.vacationWork;
    contribution += r.contribution;
    uniqueDates.add(r.date);
  });

  const numMonths = (new Date(currentPeriod.end).getFullYear() - new Date(currentPeriod.start).getFullYear()) * 12
                  + (new Date(currentPeriod.end).getMonth() - new Date(currentPeriod.start).getMonth()) + 1;
  const totalBusinessDays = calculateBusinessDays(currentPeriod.start, currentPeriod.end);

  // 期間合計
  const periodTotalTime = totalTime;
  const periodOtTime = otTime;
  const periodVacationWork = vacationWork;
  const periodContribution = contribution;

  // 月平均
  const avgTotalTimePerMonth = numMonths > 0 ? (totalTime / numMonths).toFixed(2) : 0;
  const avgOtTimePerMonth = numMonths > 0 ? (otTime / numMonths).toFixed(2) : 0;
  const avgVacationWorkPerMonth = numMonths > 0 ? (vacationWork / numMonths).toFixed(2) : 0;
  const avgContributionPerMonth = numMonths > 0 ? (contribution / numMonths).toFixed(2) : 0;

  // 1人1営業日あたりの指標 (この関数内ではselectedMemberは1人なので、"1人あたり"は省略)
  const avgTotalTimePerBusinessDay = totalBusinessDays > 0 ? (totalTime / totalBusinessDays).toFixed(2) : 0;
  const avgOtTimePerBusinessDay = totalBusinessDays > 0 ? (otTime / totalBusinessDays).toFixed(2) : 0;
  const avgBreakTimePerDay = uniqueDates.size > 0 ? (breakTime / uniqueDates.size).toFixed(2) : 0;

  // KPIの更新
  document.getElementById("pc-kpi-total").textContent = `${avgTotalTimePerBusinessDay}h`; // 1人1営業日あたり総業務時間
  document.getElementById("pc-kpi-ot").textContent = `${avgOtTimePerBusinessDay}h`; // 1人1営業日あたり時間外時間
  document.getElementById("pc-kpi-vac").textContent = `${periodVacationWork}h`; // 休暇中業務時間/月 (期間合計)
  document.getElementById("pc-kpi-break").textContent = `${avgBreakTimePerDay}h`; // 1日平均休憩時間
  document.getElementById("pc-kpi-party").textContent = `--`; // 休憩中業務時間/月 (データ項目がないため保留)

  // スコアカードの更新 (仮)
  document.getElementById("pc-score-val").textContent = `${periodContribution.toFixed(0)}`;
  document.getElementById("pc-lv-badge").textContent = `Lv.${Math.floor(periodContribution / 50) + 1}`; // 仮のレベル計算

  // 日別負荷推移グラフの描画
  renderPersonalDailyTrend(memberRecords, selectedMember);

  // TODO: スコア内訳、主な負荷要因、面談用サマリー、業務区分別分析の描画
  console.log("Personal Detail for", selectedMember, {
    periodTotalTime, periodOtTime, periodVacationWork, periodContribution,
    avgTotalTimePerMonth, avgOtTimePerMonth, avgVacationWorkPerMonth, avgContributionPerMonth,
    avgTotalTimePerBusinessDay, avgOtTimePerBusinessDay, avgBreakTimePerDay
  });
}

let personalDailyTrendChart = null;
function renderPersonalDailyTrend(memberRecords, selectedMember) {
  const dailyTrendCanvas = document.getElementById("chart-pc-daily-trend");
  if (!dailyTrendCanvas || memberRecords.length === 0) {
    if (personalDailyTrendChart) personalDailyTrendChart.destroy();
    return;
  }

  // 日付ごとの集計
  const dailyStats = {};
  memberRecords.forEach(r => {
    if (!dailyStats[r.date]) {
      dailyStats[r.date] = { totalTime: 0, otTime: 0, contribution: 0 };
    }
    dailyStats[r.date].totalTime += r.totalTime;
    dailyStats[r.date].otTime += r.otTime;
    dailyStats[r.date].contribution += r.contribution;
  });

  const sortedDates = Object.keys(dailyStats).sort();
  const totalTimes = sortedDates.map(date => dailyStats[date].totalTime);
  const otTimes = sortedDates.map(date => dailyStats[date].otTime);

  if (personalDailyTrendChart) {
    personalDailyTrendChart.destroy();
  }

  personalDailyTrendChart = new Chart(dailyTrendCanvas, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [
        {
          label: '総業務時間',
          data: totalTimes,
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          fill: true,
          tension: 0.1
        },
        {
          label: '時間外時間',
          data: otTimes,
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          fill: true,
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: '日付'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '時間 (h)'
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: `${selectedMember}の日別負荷推移`
        }
      }
    }
  });
}

function calculateAlerts(records, settings) {
  const alerts = [];
  const dailyRecordsByUser = {}; // { name: { date: [records] } }

  records.forEach(r => {
    if (!dailyRecordsByUser[r.name]) dailyRecordsByUser[r.name] = {};
    if (!dailyRecordsByUser[r.name][r.date]) dailyRecordsByUser[r.name][r.date] = [];
    dailyRecordsByUser[r.name][r.date].push(r);
  });

  for (const name in dailyRecordsByUser) {
    for (const date in dailyRecordsByUser[name]) {
      const dayRecords = dailyRecordsByUser[name][date];
      const totalTime = dayRecords.reduce((sum, r) => sum + r.totalTime, 0);
      const otTime = dayRecords.reduce((sum, r) => sum + r.otTime, 0);
      const breakTime = dayRecords.reduce((sum, r) => sum + r.breakTime, 0);
      const vacationWork = dayRecords.reduce((sum, r) => sum + r.vacationWork, 0);

      // 休暇中業務
      if (vacationWork >= settings.vacationAlert) {
        alerts.push({ type: '休暇中業務', name, date, value: vacationWork, message: `休暇中に業務を行っています (${vacationWork}h)` });
      }

      // 休憩不足
      if (breakTime < settings.breakAlert / 60 && totalTime > 0) { // 設定は分単位なので時間単位に変換
        alerts.push({ type: '休憩不足', name, date, value: breakTime, message: `休憩時間が不足しています (${(breakTime * 60).toFixed(0)}分)` });
      }

      // 時間外労働
      if (otTime >= settings.otAlert) {
        alerts.push({ type: '時間外労働', name, date, value: otTime, message: `時間外労働が${settings.otAlert}時間を超えています (${otTime}h)` });
      }

      // TODO: 休憩不足、複合条件、設定値に基づく詳細なアラート判定ロジックを実装
    }
  }

  return alerts;
}

let dailyTrendChart = null;
function renderDailyAnalysis(data) {
  const heatmapDeptFilter = document.getElementById("heatmap-dept-filter");
  if (!heatmapDeptFilter || !data || !data.records || data.records.length === 0) {
    if (heatmapDeptFilter) heatmapDeptFilter.innerHTML = 
      `<option value="all">全員</option>`;
    if (dailyTrendChart) dailyTrendChart.destroy();
    return;
  }

  const uniqueDepts = new Set(data.records.map(r => r.dept || '未設定'));
  heatmapDeptFilter.innerHTML = 
    `<option value="all">全員</option>` +
    Array.from(uniqueDepts).sort().map(dept => `<option value="${dept}">${dept}</option>`).join("");

  // イベントリスナーを再設定
  heatmapDeptFilter.onchange = () => renderDailyAnalysis(data); // フィルター変更時に再描画

  renderDailyTrendChart(data, heatmapDeptFilter.value);
  // TODO: Implement heatmap rendering
}

function renderDailyTrendChart(data, selectedDept) {
  const dailyTrendCanvas = document.getElementById("chart-daily-trend");
  if (!dailyTrendCanvas || !data || !data.records || data.records.length === 0) {
    if (dailyTrendChart) dailyTrendChart.destroy();
    return;
  }

  const filteredRecords = selectedDept === "all"
    ? data.records
    : data.records.filter(r => (r.dept || '未設定') === selectedDept);

  // 日付ごとの総業務時間を集計
  const dailyTotalTimes = {};
  filteredRecords.forEach(r => {
    if (!dailyTotalTimes[r.date]) {
      dailyTotalTimes[r.date] = 0;
    }
    dailyTotalTimes[r.date] += r.totalTime;
  });

  const sortedDates = Object.keys(dailyTotalTimes).sort();
  const totalTimes = sortedDates.map(date => dailyTotalTimes[date]);

  if (dailyTrendChart) {
    dailyTrendChart.destroy();
  }

  dailyTrendChart = new Chart(dailyTrendCanvas, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [
        {
          label: '総業務時間',
          data: totalTimes,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          fill: true,
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: '日付'
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '時間 (h)'
          }
        }
      },
      plugins: {
        title: {
          display: true,
          text: `日別 業務時間推移 (${selectedDept === "all" ? "全員合計" : selectedDept})`
        }
      }
    }
  });
}

function renderAlerts(data) {
  const alertSummaryGrid = document.getElementById("alert-summary-grid");
  const alertDetailList = document.getElementById("alert-detail-list");
  const alertBadge = document.getElementById("alert-badge");

  if (!alertSummaryGrid || !alertDetailList || !alertBadge || !data || !data.records || data.records.length === 0) {
    if (alertSummaryGrid) alertSummaryGrid.innerHTML = 
      `<div class="chart-card full-width"><div class="chart-header"><h3>アラートサマリー</h3></div><div class="chart-body">データがありません</div></div>`;
    if (alertDetailList) alertDetailList.innerHTML = 
      `<div class="alert-detail-item">データがありません</div>`;
    if (alertBadge) alertBadge.style.display = "none";
    return;
  }

  const alerts = calculateAlerts(data.records, currentSettings); // currentSettingsはアラート判定に必要
  alertBadge.textContent = alerts.length;
  alertBadge.style.display = alerts.length > 0 ? "block" : "none";

  // 月別にアラートをグルーピング
  const alertsByMonth = {};
  alerts.forEach(alert => {
    const ym = alert.date.substring(0, 7);
    if (!alertsByMonth[ym]) {
      alertsByMonth[ym] = [];
    }
    alertsByMonth[ym].push(alert);
  });

  // アラートサマリーの描画
  let summaryHtml = 
  const sortedMonths = Object.keys(alertsByMonth).sort((a, b) => b.localeCompare(a));
  if (sortedMonths.length === 0) {
    summaryHtml = `<div class="chart-card full-width"><div class="chart-header"><h3>アラートサマリー</h3></div><div class="chart-body">アラートはありません</div></div>`;
  } else {
    summaryHtml = sortedMonths.map(ym => `
      <div class="alert-summary-card">
        <div class="alert-summary-month">${ym}</div>
        <div class="alert-summary-count">${alertsByMonth[ym].length}件</div>
      </div>
    `).join("");
  }
  alertSummaryGrid.innerHTML = summaryHtml;

  // アラート詳細一覧の描画
  let detailHtml = 
  if (sortedMonths.length === 0) {
    detailHtml = `<div class="alert-detail-item">アラートはありません</div>`;
  } else {
    detailHtml = sortedMonths.map(ym => `
      <div class="alert-month-group">
        <h4>${ym}</h4>
        ${alertsByMonth[ym].map(alert => `
          <div class="alert-detail-item">
            <span class="alert-type">${alert.type}</span>
            <span class="alert-name">${alert.name}</span>
            <span class="alert-date">${alert.date}</span>
            <span class="alert-message">${alert.message}</span>
          </div>
        `).join("")}
      </div>
    `).join("");
  }
  alertDetailList.innerHTML = detailHtml;
}

function updateHeader(data) {
  const periodEl = document.getElementById('header-period');
  if (!periodEl) return;
  if (!data) {
    periodEl.textContent = 'データ未読込';
    return;
  }
  periodEl.textContent = `${currentPeriod.start} 〜 ${currentPeriod.end} (${data.uniqueUsersWithData}名 / ${data.totalBusinessDays}営業日)`;
}

async function renderStoredDataList() {
  const listEl = document.getElementById('stored-data-list');
  if (!listEl) return;
  const metadata = await db.getAllMetadata();
  
  listEl.innerHTML = metadata.sort((a,b) => b.ym.localeCompare(a.ym)).map(m => `
    <tr>
      <td><strong>${m.ym}</strong></td>
      <td>${m.count}件</td>
      <td>${m.userCount}名</td>
      <td>${new Date(m.updatedAt).toLocaleString()}</td>
      <td>
        <button class="btn-danger-sm" onclick="window.deleteMonth('${m.ym}')">削除</button>
      </td>
    </tr>
  `).join('');
}

window.deleteMonth = async (ym) => {
  if (confirm(`${ym}のデータを削除しますか？`)) {
    await db.deleteMonthlyData(ym);
    delete allRecords[ym];
    initPeriodSelector();
    renderAll();
  }
};

async function exportAllData() {
  const all = await db.getAllData();
  const blob = new Blob([JSON.stringify(all)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

async function importAllData(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    for (const ym in data) {
      await db.saveMonthlyData(ym, data[ym]);
      allRecords[ym] = data[ym];
    }
    alert('インポートが完了しました');
    initPeriodSelector();
    renderAll();
  } catch (e) {
    alert('インポートに失敗しました');
  }
}

window.switchTab = (tabId) => {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const targetNavItem = document.querySelector(`[data-tab="${tabId}"]`);
  if (targetNavItem) targetNavItem.classList.add('active');
  
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  const targetTab = document.getElementById(`tab-${tabId}`);
  if (targetTab) targetTab.classList.add('active');
  
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) {
    const titles = {
      summary: '全体サマリー', dashboard: 'ダッシュボード', dept: '部門別分析',
      personal: '個人別分析', daily: '日別分析', alert: 'アラート',
      csv: 'CSV取込', settings: '設定'
    };
    pageTitle.textContent = titles[tabId] || tabId;
  }
  renderAll();
};
