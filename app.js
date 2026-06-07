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
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main-screen').style.display = 'none';
}

function showMainScreen() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';
  renderAll();
}

// ログインボタンのイベントリスナー設定
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

window.doLogout = () => {
  sessionStorage.removeItem('isLoggedIn');
  location.reload();
};

// ===== 設定管理 =====
function loadSettings() {
  const stored = localStorage.getItem('dash_settings');
  if (stored) {
    try {
      currentSettings = JSON.parse(stored);
      if (currentSettings.version !== SETTINGS_VERSION) {
        currentSettings = { ...DEFAULT_LEVEL_CONFIG, ...currentSettings, version: SETTINGS_VERSION };
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

      await db.saveMonthlyData(ym, records);
      allRecords[ym] = records;
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
  console.log(`Rendering tab: ${activeTab}`);
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
    vacationWork: 0,
    contribution: 0,
    days: new Set(combinedRecords.map(r => r.date)).size,
    users: new Set(combinedRecords.map(r => r.name)).size,
    records: combinedRecords
  };

  combinedRecords.forEach(r => {
    stats.totalTime += r.totalTime;
    stats.otTime += r.otTime;
    stats.breakTime += r.breakTime;
    stats.vacationWork += r.vacationWork;
    stats.contribution += r.contribution;
  });

  return stats;
}

function updateHeader(data) {
  const periodEl = document.getElementById('header-period');
  if (!periodEl) return;
  if (!data) {
    periodEl.textContent = 'データ未読込';
    return;
  }
  periodEl.textContent = `${currentPeriod.start} 〜 ${currentPeriod.end} (${data.users}名 / ${data.days}日分)`;
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
