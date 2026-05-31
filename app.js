'use strict';

// ============================================================
// 定数・グローバル
// ============================================================
const DEFAULT_PASSWORD = 'admin1234';
// デフォルトの業務区分マスター
const DEFAULT_WORK_MASTER = [
  { name: '九電碍・点', importance: 20, color: '#0066FF' },
  { name: '九電管路', importance: 15, color: '#9900CC' },
  { name: '他電力碍・点', importance: 15, color: '#00CCCC' },
  { name: '直送商', importance: 10, color: '#FF3300' },
  { name: '在庫商', importance: 10, color: '#FF9900' },
  { name: '外販製品（非電力）', importance: 10, color: '#00CC44' },
  { name: 'TKD', importance: 10, color: '#FF66CC' },
  { name: '社内対応', importance: 10, color: '#AAAAAA' },
  { name: '休憩', importance: 0, color: '#FFFF00' },
  { name: '懇親会', importance: 0, color: '#00FFCC' },
  { name: '時間外', importance: 0, color: '#FF0066' },
  { name: '休暇中業務', importance: 0, color: '#66FF00' },
];

// デフォルトの重み付け
const DEFAULT_RISK_WEIGHTS = {
  ot: 1.0,      // 1時間あたり1pt
  late: 1.5,    // 1時間あたり1.5pt
  break: 2.0,   // 1回あたり2pt
  vacation: 1.2 // 1時間あたり1.2pt
};

let allRecords = [];    // 全CSV行データ
let chartInstances = {}; // Chart.jsインスタンス管理

// ============================================================
// 設定（LocalStorage）
// ============================================================
function loadSettings() {
  const def = { 
    otAlert: 45, 
    vacationAlert: 10, 
    breakOk: 40, 
    breakWarn: 1,
    workMaster: DEFAULT_WORK_MASTER,
    riskWeights: DEFAULT_RISK_WEIGHTS
  };
  try { 
    const stored = JSON.parse(localStorage.getItem('dash_settings') || '{}');
    return Object.assign(def, stored); 
  }
  catch { return def; }
}

function getWorkColor(name) {
  const s = loadSettings();
  const found = s.workMaster.find(m => m.name === name);
  return found ? found.color : '#666666';
}
function saveSettings() {
  const s = loadSettings();
  s.otAlert       = parseInt(document.getElementById('set-ot-alert').value) || 45;
  s.vacationAlert = parseInt(document.getElementById('set-vacation-alert').value) || 10;
  s.breakOk       = parseInt(document.getElementById('set-break-ok').value) || 40;
  s.breakWarn     = parseInt(document.getElementById('set-break-warn').value) || 1;
  localStorage.setItem('dash_settings', JSON.stringify(s));
  showToast('アラート閾値設定を保存しました');
  renderAll();
}
function loadSettingsForm() {
  const s = loadSettings();
  document.getElementById('set-ot-alert').value       = s.otAlert;
  document.getElementById('set-vacation-alert').value = s.vacationAlert;
  document.getElementById('set-break-ok').value       = s.breakOk;
  document.getElementById('set-break-warn').value     = s.breakWarn;

  // 業務区分マスター
  renderWorkTypeMasterTable(s.workMaster);

  // 重み付け
  document.getElementById('weight-ot').value = s.riskWeights.ot;
  document.getElementById('weight-late').value = s.riskWeights.late;
  document.getElementById('weight-break').value = s.riskWeights.break;
  document.getElementById('weight-vacation').value = s.riskWeights.vacation;
}

function renderWorkTypeMasterTable(master) {
  const body = document.getElementById('worktype-master-body');
  body.innerHTML = master.map((m, i) => `
    <tr>
      <td><input type="text" class="wm-name" value="${m.name}"></td>
      <td><input type="number" class="wm-importance" value="${m.importance}" min="0" max="100" oninput="updateWorkTypeTotal()"></td>
      <td><input type="color" class="wm-color" value="${m.color}"></td>
      <td><button class="btn-delete-row" onclick="deleteWorkTypeRow(this)">🗑️</button></td>
    </tr>
  `).join('');
  updateWorkTypeTotal();
}

function addWorkTypeRow() {
  const body = document.getElementById('worktype-master-body');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="wm-name" value="新業務"></td>
    <td><input type="number" class="wm-importance" value="0" min="0" max="100" oninput="updateWorkTypeTotal()"></td>
    <td><input type="color" class="wm-color" value="#666666"></td>
    <td><button class="btn-delete-row" onclick="deleteWorkTypeRow(this)">🗑️</button></td>
  `;
  body.appendChild(tr);
  updateWorkTypeTotal();
}

function deleteWorkTypeRow(btn) {
  btn.closest('tr').remove();
  updateWorkTypeTotal();
}

function updateWorkTypeTotal() {
  const importances = Array.from(document.querySelectorAll('.wm-importance')).map(input => parseInt(input.value) || 0);
  const total = importances.reduce((s, v) => s + v, 0);
  const el = document.getElementById('worktype-total-importance');
  const msg = document.getElementById('worktype-total-msg');
  el.textContent = total;
  if (total === 100) {
    el.style.color = 'var(--green)';
    msg.textContent = '✅ 合計100%です';
    msg.style.color = 'var(--green)';
  } else {
    el.style.color = 'var(--red)';
    msg.textContent = `⚠️ 合計を100にしてください（現在:${total}）`;
    msg.style.color = 'var(--red)';
  }
}

function saveWorkTypeMaster() {
  const rows = Array.from(document.querySelectorAll('#worktype-master-body tr'));
  const master = rows.map(row => ({
    name: row.querySelector('.wm-name').value.trim(),
    importance: parseInt(row.querySelector('.wm-importance').value) || 0,
    color: row.querySelector('.wm-color').value
  })).filter(m => m.name);

  const total = master.reduce((s, m) => s + m.importance, 0);
  if (total !== 100) {
    if (!confirm(`重要度の合計が${total}です。100でなくても保存しますか？`)) return;
  }

  const s = loadSettings();
  s.workMaster = master;
  localStorage.setItem('dash_settings', JSON.stringify(s));
  showToast('業務区分マスターを保存しました');
  renderAll();
}

function saveRiskWeights() {
  const s = loadSettings();
  s.riskWeights = {
    ot: parseFloat(document.getElementById('weight-ot').value) || 0,
    late: parseFloat(document.getElementById('weight-late').value) || 0,
    break: parseFloat(document.getElementById('weight-break').value) || 0,
    vacation: parseFloat(document.getElementById('weight-vacation').value) || 0
  };
  localStorage.setItem('dash_settings', JSON.stringify(s));
  showToast('重み付け設定を保存しました');
  renderAll();
}

// ============================================================
// パスワード
// ============================================================
function getPassword() { return localStorage.getItem('dash_password') || DEFAULT_PASSWORD; }
function doLogin() {
  const pw = document.getElementById('login-password').value;
  if (pw === getPassword()) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    loadSettingsForm();
    loadStoredData();
    renderAll();
  } else {
    document.getElementById('login-error').style.display = 'block';
  }
}
document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
function doLogout() {
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
}
function changePassword() {
  const cur  = document.getElementById('set-pw-current').value;
  const nw   = document.getElementById('set-pw-new').value;
  const conf = document.getElementById('set-pw-confirm').value;
  const msg  = document.getElementById('pw-msg');
  if (cur !== getPassword())   { msg.style.color = '#e74c3c'; msg.textContent = '現在のパスワードが違います'; return; }
  if (nw.length < 4)           { msg.style.color = '#e74c3c'; msg.textContent = '4文字以上で設定してください'; return; }
  if (nw !== conf)             { msg.style.color = '#e74c3c'; msg.textContent = '新しいパスワードが一致しません'; return; }
  localStorage.setItem('dash_password', nw);
  msg.style.color = '#2ecc71'; msg.textContent = 'パスワードを変更しました';
  document.getElementById('set-pw-current').value = '';
  document.getElementById('set-pw-new').value = '';
  document.getElementById('set-pw-confirm').value = '';
}

// ============================================================
// タブ切替
// ============================================================
const TAB_TITLES = { summary:'全体サマリー', dashboard:'ダッシュボード', dept:'部門別分析', personal:'個人別分析', daily:'日別分析', alert:'アラート', csv:'CSV取込', settings:'設定' };
function switchTab(name) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  document.getElementById('page-title').textContent = TAB_TITLES[name] || name;
  if (name === 'summary')  renderSummaryTab();
  if (name === 'dept')     renderDeptTab();
  if (name === 'personal') renderPersonalTab();
  if (name === 'daily')    renderDailyTab();
  if (name === 'alert')    renderAlertTab();
  if (name === 'settings') loadSettingsForm();
}

// ============================================================
// CSV取込
// ============================================================
function loadStoredData() {
  try { allRecords = JSON.parse(localStorage.getItem('dash_records') || '[]'); } catch { allRecords = []; }
}
function saveStoredData() { localStorage.setItem('dash_records', JSON.stringify(allRecords)); }
function clearAllData() {
  if (!confirm('取込済みの全データを削除しますか？')) return;
  allRecords = [];
  saveStoredData();
  renderAll();
  showToast('全データを削除しました');
}

function handleCSVFiles(files) {
  const statusEl = document.getElementById('csv-status');
  statusEl.innerHTML = '';
  let loaded = 0, errors = 0;
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = e.target.result;
        const rows = parseCSV(text);
        // 既存の同一社員番号+月のデータを削除してから追加
        if (rows.length > 0) {
          const empId = rows[0].empId;
          const ym = rows[0].date.substring(0, 7);
          allRecords = allRecords.filter(r => !(r.empId === empId && r.date.startsWith(ym)));
          allRecords = allRecords.concat(rows);
        }
        loaded++;
        statusEl.innerHTML += `<div class="success">✅ ${file.name}：${rows.length}件取込完了</div>`;
      } catch(err) {
        errors++;
        statusEl.innerHTML += `<div class="error">❌ ${file.name}：読込エラー（${err.message}）</div>`;
      }
      if (loaded + errors === files.length) {
        saveStoredData();
        renderAll();
        document.getElementById('csv-file-input').value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  });
}

function parseCSV(text) {
  // BOM除去
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 9) continue;
    rows.push({
      empId:      cols[0].trim(),
      name:       cols[1].trim(),
      dept:       cols[2].trim(),
      role:       cols[3].trim(),
      date:       cols[4].trim(),
      dow:        cols[5].trim(),
      workType:   cols[6].trim(),
      startTime:  cols[7].trim(),
      endTime:    cols[8].trim(),
      normalMin:  parseInt(cols[9]) || 0,
      otMin:      parseInt(cols[10]) || 0,
      breakMin:   parseInt(cols[11]) || 0,
      partyMin:   parseInt(cols[12]) || 0,
      vacationMin:parseInt(cols[13]) || 0,
      memo:       (cols[14] || '').trim(),
    });
  }
  return rows;
}

// ドラッグ&ドロップ
const dropArea = document.getElementById('csv-drop-area');
dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
dropArea.addEventListener('drop', e => {
  e.preventDefault(); dropArea.classList.remove('drag-over');
  handleCSVFiles(e.dataTransfer.files);
});

// ============================================================
// データ集計ユーティリティ
// ============================================================
function fmtMin(min) {
  if (min == null || isNaN(min)) return '--';
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

function getMembers() {
  const map = {};
  allRecords.forEach(r => {
    if (!map[r.empId]) map[r.empId] = { empId:r.empId, name:r.name, dept:r.dept, role:r.role };
  });
  return Object.values(map);
}

function getMemberStats(empId) {
  const recs = allRecords.filter(r => r.empId === empId);
  const totalMin   = recs.reduce((s,r) => s + r.normalMin + r.otMin, 0);
  const otMin      = recs.reduce((s,r) => s + r.otMin, 0);
  const breakMin   = recs.reduce((s,r) => s + r.breakMin, 0);
  const vacMin     = recs.reduce((s,r) => s + r.vacationMin, 0);
  const partyMin   = recs.reduce((s,r) => s + r.partyMin, 0);

  // 業務区分別（通常+時間外）
  const byType = {};
  recs.forEach(r => {
    if (r.workType === '休憩') return;
    const key = r.workType;
    byType[key] = (byType[key] || 0) + r.normalMin + r.otMin + r.vacationMin;
  });

  // 日別休憩（1日あたりの合計）
  const breakByDay = {};
  recs.forEach(r => {
    if (!breakByDay[r.date]) breakByDay[r.date] = 0;
    breakByDay[r.date] += r.breakMin;
  });

  return { totalMin, otMin, breakMin, vacMin, partyMin, byType, breakByDay };
}

function getDeptStats(dept) {
  const members = getMembers().filter(m => !dept || m.dept === dept);
  let totalMin = 0, otMin = 0, vacMin = 0, breakMin = 0;
  members.forEach(m => {
    const s = getMemberStats(m.empId);
    totalMin += s.totalMin; otMin += s.otMin; vacMin += s.vacMin; breakMin += s.breakMin;
  });
  return { totalMin, otMin, vacMin, breakMin, count: members.length };
}

// ============================================================
// 全体レンダリング
// ============================================================
function renderAll() {
  updateHeaderPeriod();
  renderSummaryTab();
  renderKPI();
  renderWorktypeChart();
  renderPersonalBarChart();
  renderDeptCompare();
  renderDashboardAlerts();
  renderOtList();
  renderMemberGrid();
  renderScoreFactorList();
  renderCSVSummary();
  updateAlertBadge();
}

function updateHeaderPeriod() {
  if (allRecords.length === 0) {
    document.getElementById('header-period').textContent = 'データ未読込';
    return;
  }
  const dates = allRecords.map(r => r.date).sort();
  const ym = dates[0].substring(0,7);
  document.getElementById('header-period').textContent = `${ym.replace('-','年')}月 データ`;
  document.getElementById('header-update').textContent = `最終更新: ${new Date().toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`;
}

// ============================================================
// KPIカード
// ============================================================
function renderKPI() {
  const s = loadSettings();
  const members = getMembers();

  // 前月比表示用ヘルパー
  function setMom(elId, val, prevVal, unit) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (prevVal == null) { el.textContent = ''; return; }
    const diff = val - prevVal;
    const pct = prevVal !== 0 ? Math.round(diff / prevVal * 1000) / 10 : 0;
    const sign = diff >= 0 ? '+' : '';
    const arrow = diff >= 0 ? '▲' : '▼';
    const cls = diff > 0 ? 'mom-up' : diff < 0 ? 'mom-down' : 'mom-flat';
    if (unit === 'min') {
      const h = Math.floor(Math.abs(diff)/60), m = Math.abs(diff)%60;
      const diffStr = h > 0 ? `${sign}${h}時間${m}分` : `${sign}${m}分`;
      el.innerHTML = `<span class="${cls}">前月比 ${diffStr} ${arrow}</span>`;
    } else {
      el.innerHTML = `<span class="${cls}">前月比 ${sign}${pct}% ${arrow}</span>`;
    }
  }

  if (members.length === 0) {
    ['kpi-total','kpi-ot','kpi-vacation','kpi-break-avg','kpi-avg','kpi-alert-count'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '--';
    });
    ['kpi-total-mom','kpi-ot-mom','kpi-vacation-mom','kpi-break-mom','kpi-avg-mom','kpi-alert-mom'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    return;
  }

  let totalMin = 0, otMin = 0, vacMin = 0, breakMin = 0;
  let alertCount = 0;
  let totalBreakDays = 0;
  members.forEach(m => {
    const st = getMemberStats(m.empId);
    totalMin += st.totalMin; otMin += st.otMin; vacMin += st.vacMin; breakMin += st.breakMin;
    const days = Object.keys(st.breakByDay).length;
    totalBreakDays += days;
    // 重点確認（Lv.4）
    const sc = calculateScores(m.empId);
    if (sc.riskLevel >= 4) alertCount++;
  });

  const avgBreakMin = totalBreakDays > 0 ? Math.round(breakMin / totalBreakDays) : 0;
  const avgTotalMin = members.length > 0 ? Math.round(totalMin / members.length) : 0;

  // 前月データ取得（LocalStorageに保存されていれば）
  const prev = JSON.parse(localStorage.getItem('dash_prev_kpi') || 'null');

  document.getElementById('kpi-total').textContent       = fmtMin(totalMin);
  document.getElementById('kpi-ot').textContent          = fmtMin(otMin);
  document.getElementById('kpi-vacation').textContent    = fmtMin(vacMin);
  const breakEl = document.getElementById('kpi-break-avg');
  if (breakEl) breakEl.textContent = `${avgBreakMin}分`;
  document.getElementById('kpi-avg').textContent         = fmtMin(avgTotalMin);
  document.getElementById('kpi-alert-count').textContent = `${alertCount}人`;

  // 前月比表示
  if (prev) {
    setMom('kpi-total-mom', totalMin, prev.totalMin, 'pct');
    setMom('kpi-ot-mom', otMin, prev.otMin, 'pct');
    setMom('kpi-vacation-mom', vacMin, prev.vacMin, 'pct');
    setMom('kpi-break-mom', avgBreakMin, prev.avgBreakMin, 'min');
    setMom('kpi-avg-mom', avgTotalMin, prev.avgTotalMin, 'pct');
    const alertEl = document.getElementById('kpi-alert-mom');
    if (alertEl) {
      const diff = alertCount - prev.alertCount;
      const sign = diff >= 0 ? '+' : '';
      const cls = diff > 0 ? 'mom-up' : diff < 0 ? 'mom-down' : 'mom-flat';
      alertEl.innerHTML = `<span class="${cls}">前月比 ${sign}${diff}人</span>`;
    }
  }

  // 業務負荷スコアアラートパネル更新
  renderScoreAlertPanel(avgBreakMin, prev ? prev.avgBreakMin : null);
}

// 業務負荷スコアアラートパネル
function renderScoreAlertPanel(avgBreakMin, prevBreakMin) {
  const members = getMembers();
  const scores = members.map(m => ({ ...m, ...calculateScores(m.empId) }));

  const lv4 = scores.filter(s => s.riskLevel >= 4).length;
  const lv3 = scores.filter(s => s.riskLevel === 3).length;
  const lv2 = scores.filter(s => s.riskLevel === 2).length;

  const saBreak = document.getElementById('sa-break-avg');
  const saMom   = document.getElementById('sa-break-mom');
  const saLv4   = document.getElementById('sa-lv4-count');
  const saLv3   = document.getElementById('sa-lv3-count');
  const saLv2   = document.getElementById('sa-lv2-count');
  const saTop5  = document.getElementById('sa-top5-body');

  if (saBreak) saBreak.textContent = `${avgBreakMin}分`;
  if (saMom && prevBreakMin != null) {
    const diff = avgBreakMin - prevBreakMin;
    const sign = diff >= 0 ? '+' : '';
    const cls = diff < 0 ? 'mom-down' : diff > 0 ? 'mom-up' : 'mom-flat';
    const arrow = diff >= 0 ? '▲' : '▼';
    saMom.innerHTML = `<span class="${cls}">前月比 ${sign}${diff}分 ${arrow}</span>`;
  }
  if (saLv4) saLv4.textContent = lv4;
  if (saLv3) saLv3.textContent = lv3;
  if (saLv2) saLv2.textContent = lv2;

  // TOP5
  if (saTop5) {
    const sorted = [...scores].sort((a, b) => b.risk - a.risk).slice(0, 5);
    const lvColor = { 4:'#e74c3c', 3:'#e67e22', 2:'#f1c40f', 1:'#2ecc71' };
    saTop5.innerHTML = sorted.map((s, i) => {
      const reason = buildRiskReason(s.empId);
      return `<tr>
        <td>${i+1}</td>
        <td>${s.name}</td>
        <td style="color:${lvColor[s.riskLevel]};font-weight:bold">${s.risk} <small>(Lv.${s.riskLevel})</small></td>
        <td style="font-size:0.75rem;color:var(--text-sub)">${reason}</td>
      </tr>`;
    }).join('');
  }
}

// リスク理由文生成
function buildRiskReason(empId) {
  const s = loadSettings();
  const st = getMemberStats(empId);
  const reasons = [];
  const vacDays = allRecords.filter(r => r.empId === empId && r.vacationMin > 0).length;
  if (vacDays > 0) reasons.push(`休暇中業務あり ${vacDays}日`);
  const zeroDays = Object.values(st.breakByDay).filter(v => v === 0).length;
  if (zeroDays > 0) reasons.push(`休憩${zeroDays}分 ${zeroDays}日`);
  const otDays = allRecords.filter(r => r.empId === empId && r.otMin >= 90).length;
  if (otDays > 0) reasons.push(`時間外90分超 ${otDays}日`);
  const shortDays = Object.values(st.breakByDay).filter(v => v > 0 && v < s.breakOk).length;
  if (shortDays > 0) reasons.push(`休憩${s.breakOk}分以下 ${shortDays}日`);
  return reasons.slice(0, 2).join('、') || 'なし';
}

// ============================================================
// 業務区分別ドーナツグラフ
// ============================================================
function renderWorktypeChart() {
  const ctx = document.getElementById('chart-worktype').getContext('2d');
  destroyChart('worktype');

  const byType = {};
  allRecords.forEach(r => {
    if (r.workType === '休憩') return;
    const min = r.normalMin + r.otMin + r.vacationMin;
    if (min <= 0) return;
    byType[r.workType] = (byType[r.workType] || 0) + min;
  });

  const sorted = Object.entries(byType).sort((a,b) => b[1]-a[1]);
  const labels = sorted.map(([k]) => k);
  const data   = sorted.map(([,v]) => Math.round(v/60*10)/10);
  const colors = labels.map(l => getWorkColor(l));

  chartInstances['worktype'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position:'right', labels:{ color:'#8b92b0', font:{size:11}, boxWidth:12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}h` } }
      }
    }
  });
}

// ============================================================
// 個人別積み上げ棒グラフ
// ============================================================
function renderPersonalBarChart() {
  const ctx = document.getElementById('chart-personal').getContext('2d');
  destroyChart('personal');

  const members = getMembers();
  if (members.length === 0) return;

  const s = loadSettings();
  const workTypes = s.workMaster.filter(m => m.importance > 0).map(m => m.name);
  if (workTypes.length === 0) return;

  const datasets = workTypes.map(wt => ({
    label: wt,
    data: members.map(m => {
      const recs = allRecords.filter(r => r.empId === m.empId && r.workType === wt);
      return Math.round(recs.reduce((s,r) => s + r.normalMin + r.otMin + r.vacationMin, 0) / 60 * 10) / 10;
    }),
    backgroundColor: getWorkColor(wt),
    borderWidth: 0,
  }));

  chartInstances['personal'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: members.map(m => m.name), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked:true, ticks:{ color:'#8b92b0', font:{size:11} }, grid:{ color:'#2e3350' } },
        y: { stacked:true, ticks:{ color:'#8b92b0' }, grid:{ color:'#2e3350' }, title:{ display:true, text:'時間', color:'#8b92b0' } }
      },
      plugins: { legend:{ display:false }, tooltip:{ mode:'index' } }
    }
  });
}

// ============================================================
// 休憩取得状況
// ============================================================
function renderBreakStatus() {
  const s = loadSettings();
  document.getElementById('break-rule-label').textContent = `ルール: ${s.breakOk}分以上 OK / ${s.breakWarn}〜${s.breakOk-1}分 不足 / 0分 要確認`;

  const members = getMembers();
  let ok = 0, warn = 0, danger = 0, total = 0;
  members.forEach(m => {
    const st = getMemberStats(m.empId);
    Object.values(st.breakByDay).forEach(min => {
      total++;
      if (min >= s.breakOk)   ok++;
      else if (min >= s.breakWarn) warn++;
      else danger++;
    });
  });

  const pct = v => total > 0 ? Math.round(v/total*100) : 0;
  document.getElementById('break-ok-count').textContent    = `${ok}人日`;
  document.getElementById('break-ok-pct').textContent      = `${pct(ok)}%`;
  document.getElementById('break-warn-count').textContent  = `${warn}人日`;
  document.getElementById('break-warn-pct').textContent    = `${pct(warn)}%`;
  document.getElementById('break-danger-count').textContent= `${danger}人日`;
  document.getElementById('break-danger-pct').textContent  = `${pct(danger)}%`;
}

// ============================================================
// 部門比較テーブル
// ============================================================
function renderDeptCompare() {
  const all     = getDeptStats('');
  const honsha  = getDeptStats('営業部本社');
  const fukuoka = getDeptStats('営業部福岡支社');
  const kyushu  = getDeptStats('営業部九州支社');

  const rows = [
    ['総業務時間',         fmtMin(all.totalMin),   fmtMin(honsha.totalMin),   fmtMin(fukuoka.totalMin),   fmtMin(kyushu.totalMin)],
    ['1人あたり平均',   all.count>0?fmtMin(Math.round(all.totalMin/all.count)):'--', honsha.count>0?fmtMin(Math.round(honsha.totalMin/honsha.count)):'--', fukuoka.count>0?fmtMin(Math.round(fukuoka.totalMin/fukuoka.count)):'--', kyushu.count>0?fmtMin(Math.round(kyushu.totalMin/kyushu.count)):'--'],
    ['時間外合計',         fmtMin(all.otMin),      fmtMin(honsha.otMin),      fmtMin(fukuoka.otMin),      fmtMin(kyushu.otMin)],
    ['休憩中業務時間合計', fmtMin(all.breakMin),   fmtMin(honsha.breakMin),   fmtMin(fukuoka.breakMin),   fmtMin(kyushu.breakMin)],
    ['休暇中業務合計', fmtMin(all.vacMin),     fmtMin(honsha.vacMin),     fmtMin(fukuoka.vacMin),     fmtMin(kyushu.vacMin)],
    ['在籍人数',         `${all.count}人`,        `${honsha.count}人`,        `${fukuoka.count}人`,        `${kyushu.count}人`],
  ];

  const tbody = document.getElementById('dept-compare-body');
  tbody.innerHTML = rows.map(r => `<tr>${r.map((c,i) => `<td${i===0?' style="color:var(--text-sub)"':''}>${c}</td>`).join('')}</tr>`).join('');
}

// ============================================================
// ダッシュボードアラートリスト
// ============================================================
function buildAlerts() {
  const s = loadSettings();
  const members = getMembers();
  const otAlerts = [], vacAlerts = [], breakAlerts = [];

  members.forEach(m => {
    const st = getMemberStats(m.empId);
    if (st.otMin  >= s.otAlert * 60)       otAlerts.push(m);
    if (st.vacMin >= s.vacationAlert * 60) vacAlerts.push(m);
    const hasBreakIssue = Object.values(st.breakByDay).some(v => v < s.breakWarn);
    if (hasBreakIssue) breakAlerts.push(m);
  });
  return { otAlerts, vacAlerts, breakAlerts };
}

function renderDashboardAlerts() {
  const s = loadSettings();
  const members = getMembers();
  const el = document.getElementById('dashboard-alert-list');

  // 4種類のスコアアラート集計
  const vacAlertMembers   = []; // 休暇中業務アラート
  const breakZeroMembers  = []; // 休憩０分アラート
  const otHeavyMembers    = []; // 時間外90分超アラート
  const complexMembers    = []; // 複合条件アラート

  members.forEach(m => {
    const st = getMemberStats(m.empId);
    const recs = allRecords.filter(r => r.empId === m.empId);
    const hasVac    = recs.some(r => r.vacationMin > 0);
    const hasZero   = Object.values(st.breakByDay).some(v => v === 0);
    const hasOtHeavy = recs.some(r => r.otMin >= 90);
    if (hasVac)     vacAlertMembers.push(m);
    if (hasZero)    breakZeroMembers.push(m);
    if (hasOtHeavy) otHeavyMembers.push(m);
    // 複合条件：2種以上該当
    const cnt = [hasVac, hasZero, hasOtHeavy].filter(Boolean).length;
    if (cnt >= 2) complexMembers.push(m);
  });

  const items = [
    { icon:'🏖️', title:'休暇中業務アラート', desc:'休暇中に業務が発生', list: vacAlertMembers },
    { icon:'☕', title:'休憩０分アラート', desc:'休憩０分の日がある', list: breakZeroMembers },
    { icon:'⏰', title:'時間外90分超アラート', desc:'時間外が90分を超過', list: otHeavyMembers },
    { icon:'⚠️', title:'複合条件アラート', desc:'複数条件が重複', list: complexMembers },
  ];

  el.innerHTML = items.map(item => {
    return `<div class="alert-item" onclick="switchTab('alert')">
      <div class="alert-item-icon">${item.icon}</div>
      <div class="alert-item-body">
        <div class="alert-item-title">${item.title}</div>
        <div class="alert-item-desc">${item.desc}</div>
      </div>
      <div class="alert-item-count alert-item-count-red">${item.list.length}人 ›</div>
    </div>`;
  }).join('');
}

function updateAlertBadge() {
  const { otAlerts, vacAlerts, breakAlerts } = buildAlerts();
  const total = otAlerts.length + vacAlerts.length + breakAlerts.length;
  const badge = document.getElementById('alert-badge');
  badge.textContent = total;
  badge.style.display = total > 0 ? 'inline' : 'none';
}

// ============================================================
// 時間外・休暇中業務一覧
// ============================================================
function renderOtList() {
  const filter = document.getElementById('ot-list-filter').value;
  const s = loadSettings();

  // フィルター選択肢更新
  const members = getMembers();
  const sel = document.getElementById('ot-list-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="all">全員</option>' + members.map(m => `<option value="${m.empId}">${m.name}</option>`).join('');
  sel.value = cur;

  const recs = allRecords.filter(r => {
    if (filter !== 'all' && r.empId !== filter) return false;
    return r.otMin > 0 || r.vacationMin > 0;
  }).sort((a,b) => b.date.localeCompare(a.date));

  const tbody = document.getElementById('ot-list-body');
  tbody.innerHTML = recs.slice(0,30).map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.date}（${r.dow}）</td>
      <td>${r.workType}</td>
      <td class="${r.otMin>0?'ot-red':''}">${r.otMin>0?fmtMin(r.otMin):'-'}</td>
      <td class="${r.vacationMin>0?'vac-red':''}">${r.vacationMin>0?fmtMin(r.vacationMin):'-'}</td>
      <td style="color:var(--text-sub);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.memo||''}</td>
    </tr>`).join('');
}

// ============================================================
// メンバー状況カード
// ============================================================
function renderMemberGrid() {
  const s = loadSettings();
  const members = getMembers();
  const el = document.getElementById('member-grid');
  if (members.length === 0) { el.innerHTML = '<p style="color:var(--text-sub);padding:16px">データがありません</p>'; return; }

  const lvColor = { 4:'#e74c3c', 3:'#e67e22', 2:'#f1c40f', 1:'#2ecc71' };
  const lvLabel = { 4:'重点確認', 3:'要確認', 2:'注意', 1:'OK' };

  el.innerHTML = members.map(m => {
    const st = getMemberStats(m.empId);
    const sc = calculateScores(m.empId);
    const hasOtAlert  = st.otMin  >= s.otAlert * 60;
    const hasVacAlert = st.vacMin >= s.vacationAlert * 60;
    const reason = buildRiskReason(m.empId);
    const lv = sc.riskLevel;
    const color = lvColor[lv];
    const label = lvLabel[lv];

    return `<div class="member-card">
      <div class="member-card-header">
        <div class="member-card-avatar">👤</div>
        <div class="member-card-info">
          <div class="member-card-name">${m.name}</div>
          <div class="member-card-dept">${m.dept} / ${m.role||''}</div>
        </div>
        <div class="member-card-score-block">
          <div class="member-card-score" style="color:${color}">${sc.risk}</div>
          <div class="member-card-lv-badge" style="background:${color}">${label}<br><small>Lv.${lv}</small></div>
        </div>
      </div>
      <div class="member-card-stats">
        <div class="member-stat-item">
          <div class="member-stat-icon">📊</div>
          <div class="member-stat-label">総業務</div>
          <div class="member-stat-value">${fmtMin(st.totalMin)}</div>
        </div>
        <div class="member-stat-item">
          <div class="member-stat-icon">⏰</div>
          <div class="member-stat-label">時間外</div>
          <div class="member-stat-value ${hasOtAlert?'red':''}">${fmtMin(st.otMin)}</div>
        </div>
        <div class="member-stat-item">
          <div class="member-stat-icon">☕</div>
          <div class="member-stat-label">休憩中業務時間</div>
          <div class="member-stat-value">${fmtMin(st.breakMin)}</div>
        </div>
        <div class="member-stat-item">
          <div class="member-stat-icon">🏖️</div>
          <div class="member-stat-label">休暇中業務</div>
          <div class="member-stat-value ${hasVacAlert?'orange':''}">${fmtMin(st.vacMin)}</div>
        </div>
      </div>
      <div class="member-card-reason">主な理由：${reason}</div>
    </div>`;
  }).join('');
}

// 業務負荷スコア算出要因リスト表示
function renderScoreFactorList() {
  const el = document.getElementById('score-factor-list');
  if (!el) return;
  const s = loadSettings();
  const factors = [
    { icon:'🏖️', label:'休暇中業務', weight:'40pt/件', cls:'factor-vac' },
    { icon:'☕', label:'休憩０分（非常に重）', weight:'30pt/日', cls:'factor-break0' },
    { icon:'⏰', label:'時間外90分以上（重）', weight:'20pt/日', cls:'factor-ot' },
    { icon:'☕', label:`休憩${s.breakOk}分以下（中）`, weight:'10pt/日', cls:'factor-break-short' },
    { icon:'⚠️', label:'複合条件（重複時）', weight:'+10～30pt', cls:'factor-complex' },
  ];
  el.innerHTML = factors.map(f => `
    <div class="score-factor-item ${f.cls}">
      <span class="score-factor-icon">${f.icon}</span>
      <span class="score-factor-label">${f.label}</span>
      <span class="score-factor-weight">${f.weight}</span>
    </div>`).join('');
}

// ============================================================
// CSV取込サマリー
// ============================================================
function renderCSVSummary() {
  const el = document.getElementById('csv-data-summary');
  const members = getMembers();
  if (members.length === 0) { el.innerHTML = '<p style="color:var(--text-sub)">取込済みデータはありません</p>'; return; }
  el.innerHTML = members.map(m => {
    const cnt = allRecords.filter(r => r.empId === m.empId).length;
    const dates = allRecords.filter(r => r.empId === m.empId).map(r => r.date).sort();
    const period = dates.length > 0 ? `${dates[0]} 〜 ${dates[dates.length-1]}` : '';
    return `<div class="csv-member-row">
      <span><strong>${m.name}</strong>（${m.dept} / ${m.role||''}）</span>
      <span style="color:var(--text-sub)">${period}　${cnt}件</span>
    </div>`;
  }).join('');
}

// ============================================================
// スコアリング計算ロジック
// 画像仕様に合わせて改修
// ============================================================
function calculateScores(empId) {
  const s = loadSettings();
  const st = getMemberStats(empId);
  const recs = allRecords.filter(r => r.empId === empId);

  // 1. 貢献スコア (0-100)
  let contributionScore = 0;
  const totalWorkMin = Object.values(st.byType).reduce((a, b) => a + b, 0);
  if (totalWorkMin > 0) {
    Object.entries(st.byType).forEach(([type, min]) => {
      const master = s.workMaster.find(m => m.name === type);
      if (master && master.importance > 0) {
        contributionScore += (min / totalWorkMin) * master.importance;
      }
    });
  }

  // 2. 業務負荷スコア（画像仕様）
  // - 休暇中業務: 40pt/件
  // - 休憩０分（非常に重）: 30pt/日
  // - 時間外90分以上（重）: 20pt/日
  // - 休憩設定分以下（中）: 10pt/日
  // - 複合条件（重複時）: +10〜30pt
  let riskScore = 0;

  // 休暇中業務件数
  const vacDays = recs.filter(r => r.vacationMin > 0).length;
  riskScore += vacDays * 40;

  // 休憩０分の日数
  const zeroDays = Object.values(st.breakByDay).filter(v => v === 0).length;
  riskScore += zeroDays * 30;

  // 時間外90分以上の日数
  const otHeavyDays = recs.filter(r => r.otMin >= 90).length;
  riskScore += otHeavyDays * 20;

  // 休憩不足（設定分以下、０分超）の日数
  const shortDays = Object.values(st.breakByDay).filter(v => v > 0 && v < s.breakOk).length;
  riskScore += shortDays * 10;

  // 複合条件（休暇中業務 + 休憩０分 or 時間外重複）
  const complexDays = recs.filter(r => {
    const hasVac = r.vacationMin > 0;
    const hasZero = st.breakByDay[r.date] === 0;
    const hasOtHeavy = r.otMin >= 90;
    return [hasVac, hasZero, hasOtHeavy].filter(Boolean).length >= 2;
  }).length;
  if (complexDays > 0) riskScore += Math.min(complexDays * 15, 30);

  // リスクレベル判定（スコアに応じて）
  let riskLevel = 1;
  if (riskScore >= 80) riskLevel = 4;
  else if (riskScore >= 40) riskLevel = 3;
  else if (riskScore >= 15) riskLevel = 2;

  return { 
    contribution: Math.round(contributionScore * 10) / 10, 
    risk: riskScore,
    riskLevel
  };
}

// ============================================================
// 全体サマリータブ
// ============================================================
function renderSummaryTab() {
  const members = getMembers();
  if (members.length === 0) return;

  const scores = members.map(m => ({
    ...m,
    ...calculateScores(m.empId)
  }));

  const avgCont = scores.reduce((s, v) => s + v.contribution, 0) / scores.length;
  const avgRisk = scores.reduce((s, v) => s + v.risk, 0) / scores.length;
  const alertCount = scores.filter(s => s.riskLevel >= 3).length;

  const elCont = document.getElementById('sum-avg-contribution');
  const elRisk = document.getElementById('sum-avg-risk');
  const elAlert = document.getElementById('sum-alert-count');
  
  if (elCont) elCont.textContent = avgCont.toFixed(1);
  if (elRisk) elRisk.textContent = avgRisk.toFixed(1);
  if (elAlert) elAlert.textContent = alertCount;

  renderSummaryBubbleChart(scores);
  renderRiskLevelPieChart(scores);
  renderSummaryHeatmap();
}

function renderSummaryBubbleChart(scores) {
  const canvas = document.getElementById('chart-summary-bubble');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  destroyChart('summary-bubble');

  chartInstances['summary-bubble'] = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: scores.map(s => ({
        label: s.name,
        data: [{ x: s.contribution, y: s.risk, r: 8 }],
        backgroundColor: s.riskLevel >= 3 ? 'rgba(231, 76, 60, 0.7)' : 'rgba(79, 142, 247, 0.7)',
        borderColor: s.riskLevel >= 3 ? '#e74c3c' : '#4f8ef7',
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: '貢献スコア', color: '#8b92b0' }, min: 0, max: 100, grid: { color: '#2e3350' }, ticks: { color: '#8b92b0' } },
        y: { title: { display: true, text: '負荷リスク', color: '#8b92b0' }, min: 0, grid: { color: '#2e3350' }, ticks: { color: '#8b92b0' } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: 貢献${ctx.raw.x} / リスク${ctx.raw.y}`
          }
        }
      }
    }
  });
}

function renderRiskLevelPieChart(scores) {
  const canvas = document.getElementById('chart-risk-level-pie');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  destroyChart('risk-level-pie');

  const levels = [0, 0, 0, 0];
  scores.forEach(s => levels[s.riskLevel - 1]++);

  chartInstances['risk-level-pie'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Lv.1 低', 'Lv.2 中', 'Lv.3 高', 'Lv.4 極めて高'],
      datasets: [{
        data: levels,
        backgroundColor: ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b92b0', font: { size: 11 } } }
      }
    }
  });
}

function renderSummaryHeatmap() {
  const el = document.getElementById('summary-heatmap-container');
  if (!el) return;
  const dates = [...new Set(allRecords.map(r => r.date))].sort();
  if (dates.length === 0) { el.innerHTML = '<p style="color:var(--text-sub)">データがありません</p>'; return; }

  const dayRisks = {};
  dates.forEach(d => {
    const dailyRecs = allRecords.filter(r => r.date === d);
    const emps = [...new Set(dailyRecs.map(r => r.empId))];
    let totalRisk = 0;
    emps.forEach(empId => {
      const r = dailyRecs.filter(rec => rec.empId === empId);
      const ot = r.reduce((s, v) => s + v.otMin, 0) / 60;
      const br = r.reduce((s, v) => s + v.breakMin, 0);
      const s = loadSettings();
      let risk = ot * s.riskWeights.ot;
      if (br < s.breakWarn) risk += s.riskWeights.break;
      totalRisk += risk;
    });
    dayRisks[d] = emps.length > 0 ? totalRisk / emps.length : 0;
  });

  const ym = dates[0].substring(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1).getDay();
  const lastDate = new Date(y, m, 0).getDate();

  let html = `<table class="heatmap-table"><thead><tr>${['日','月','火','水','木','金','土'].map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody><tr>`;
  for (let i = 0; i < firstDay; i++) html += '<td></td>';
  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${ym}-${String(day).padStart(2, '0')}`;
    const risk = dayRisks[dateStr] || 0;
    const ratio = Math.min(risk / 5, 1);
    const bg = risk > 0 ? `rgba(231, 76, 60, ${0.1 + ratio * 0.8})` : 'transparent';
    html += `<td><div class="heatmap-cell" style="background:${bg};color:#e8eaf0" title="${dateStr}: リスク${risk.toFixed(1)}">
      <div>${day}</div>
    </div></td>`;
    if (new Date(y, m - 1, day).getDay() === 6 && day < lastDate) html += '</tr><tr>';
  }
  html += '</tr></tbody></table>';
  el.innerHTML = html;
}

// ============================================================
// 部門別分析タブ
// ============================================================
function renderDeptTab() {
  renderDeptWorktypeChart();
  renderDeptPieChart('営業部本社', 'chart-dept-honsha');
  renderDeptPieChart('営業部福岡支社', 'chart-dept-fukuoka');
  renderDeptOtTrend();
}

function renderDeptWorktypeChart() {
  const ctx = document.getElementById('chart-dept-worktype').getContext('2d');
  destroyChart('dept-worktype');
  const depts = ['営業部本社', '営業部福岡支社'];
  const s = loadSettings();
  const workTypes = s.workMaster.filter(m => m.importance > 0).map(m => m.name);
  if (workTypes.length === 0) return;

  const datasets = workTypes.map(wt => ({
    label: wt,
    data: depts.map(dept => {
      const recs = allRecords.filter(r => r.dept === dept && r.workType === wt);
      return Math.round(recs.reduce((s,r) => s + r.normalMin + r.otMin + r.vacationMin, 0) / 60 * 10) / 10;
    }),
    backgroundColor: getWorkColor(wt),
    borderWidth: 0,
  }));
  chartInstances['dept-worktype'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: depts, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked:true, ticks:{ color:'#8b92b0' }, grid:{ color:'#2e3350' } },
        y: { stacked:true, ticks:{ color:'#8b92b0' }, grid:{ color:'#2e3350' }, title:{ display:true, text:'時間', color:'#8b92b0' } }
      },
      plugins: { legend:{ labels:{ color:'#8b92b0', font:{size:11}, boxWidth:12 } } }
    }
  });
}

function renderDeptPieChart(dept, canvasId) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const key = canvasId;
  destroyChart(key);
  const byType = {};
  allRecords.filter(r => r.dept === dept && r.workType !== '休憩').forEach(r => {
    const min = r.normalMin + r.otMin + r.vacationMin;
    if (min > 0) byType[r.workType] = (byType[r.workType]||0) + min;
  });
  const sorted = Object.entries(byType).sort((a,b)=>b[1]-a[1]);
  chartInstances[key] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>Math.round(v/60*10)/10), backgroundColor: sorted.map(([k])=>getWorkColor(k)), borderWidth:0 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ color:'#8b92b0', font:{size:10}, boxWidth:10 } } } }
  });
}

function renderDeptOtTrend() {
  const ctx = document.getElementById('chart-dept-ot-trend').getContext('2d');
  destroyChart('dept-ot-trend');
  const dates = [...new Set(allRecords.map(r=>r.date))].sort();
  const depts = ['営業部本社','営業部福岡支社'];
  const datasets = depts.map((dept,i) => ({
    label: dept,
    data: dates.map(d => {
      const min = allRecords.filter(r=>r.dept===dept&&r.date===d).reduce((s,r)=>s+r.otMin,0);
      return Math.round(min/60*10)/10;
    }),
    borderColor: i===0?'#4f8ef7':'#1abc9c',
    backgroundColor: i===0?'rgba(79,142,247,0.1)':'rgba(26,188,156,0.1)',
    fill: true, tension: 0.3, pointRadius: 3,
  }));
  chartInstances['dept-ot-trend'] = new Chart(ctx, {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { ticks:{ color:'#8b92b0', maxTicksLimit:15 }, grid:{ color:'#2e3350' } },
        y: { ticks:{ color:'#8b92b0' }, grid:{ color:'#2e3350' }, title:{ display:true, text:'時間外(h)', color:'#8b92b0' } }
      },
      plugins: { legend:{ labels:{ color:'#8b92b0' } } }
    }
  });
}

// ============================================================
// 個人別分析タブ
// ============================================================
function renderPersonalTab() {
  const deptFilter = document.getElementById('personal-dept-filter').value;
  const members = getMembers().filter(m => deptFilter==='all' || m.dept===deptFilter);

  // メンバー選択肢更新
  const sel = document.getElementById('personal-member-filter');
  sel.innerHTML = '<option value="">-- 選択 --</option>' + members.map(m=>`<option value="${m.empId}">${m.name}</option>`).join('');

  renderPersonalCompareChart(members);
  document.getElementById('personal-detail-row').style.display = 'none';
}

function renderPersonalCompareChart(members) {
  const ctx = document.getElementById('chart-personal-compare').getContext('2d');
  destroyChart('personal-compare');
  if (!members || members.length === 0) return;

  const datasets = [
    { label:'通常業務', data: members.map(m=>{ const s=getMemberStats(m.empId); return Math.round((s.totalMin-s.otMin)/60*10)/10; }), backgroundColor:'#4f8ef7', borderWidth:0 },
    { label:'時間外',   data: members.map(m=>{ const s=getMemberStats(m.empId); return Math.round(s.otMin/60*10)/10; }), backgroundColor:'#e74c3c', borderWidth:0 },
    { label:'休暇中業務',data: members.map(m=>{ const s=getMemberStats(m.empId); return Math.round(s.vacMin/60*10)/10; }), backgroundColor:'#f39c12', borderWidth:0 },
  ];
  chartInstances['personal-compare'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: members.map(m=>m.name), datasets },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { stacked:true, ticks:{ color:'#8b92b0' }, grid:{ color:'#2e3350' } },
        y: { stacked:true, ticks:{ color:'#8b92b0' }, grid:{ color:'#2e3350' }, title:{ display:true, text:'時間', color:'#8b92b0' } }
      },
      plugins: { legend:{ labels:{ color:'#8b92b0' } } }
    }
  });
}

function renderPersonalDetail() {
  const empId = document.getElementById('personal-member-filter').value;
  if (!empId) { document.getElementById('personal-detail-row').style.display='none'; return; }
  document.getElementById('personal-detail-row').style.display='flex';

  const member = getMembers().find(m=>m.empId===empId);
  if (!member) return;
  document.getElementById('personal-detail-name').textContent = `${member.name} 業務区分内訳`;

  const st = getMemberStats(empId);
  const sorted = Object.entries(st.byType).sort((a,b)=>b[1]-a[1]);

  // パイチャート
  const ctxPie = document.getElementById('chart-personal-pie').getContext('2d');
  destroyChart('personal-pie');
  chartInstances['personal-pie'] = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>Math.round(v/60*10)/10), backgroundColor: sorted.map(([k])=>getWorkColor(k)), borderWidth:0 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ color:'#8b92b0', font:{size:11}, boxWidth:12 } } } }
  });

  // 日別折れ線
  const recs = allRecords.filter(r=>r.empId===empId);
  const dates = [...new Set(recs.map(r=>r.date))].sort();
  const ctxLine = document.getElementById('chart-personal-daily').getContext('2d');
  destroyChart('personal-daily');
  chartInstances['personal-daily'] = new Chart(ctxLine, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: '総業務時間(h)',
        data: dates.map(d => {
          const min = recs.filter(r=>r.date===d).reduce((s,r)=>s+r.normalMin+r.otMin,0);
          return Math.round(min/60*10)/10;
        }),
        borderColor:'#4f8ef7', backgroundColor:'rgba(79,142,247,0.1)', fill:true, tension:0.3, pointRadius:3,
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { ticks:{ color:'#8b92b0', maxTicksLimit:12 }, grid:{ color:'#2e3350' } },
        y: { ticks:{ color:'#8b92b0' }, grid:{ color:'#2e3350' } }
      },
      plugins: { legend:{ labels:{ color:'#8b92b0' } } }
    }
  });
}

// ============================================================
// 日別分析タブ
// ============================================================
function renderDailyTab() {
  renderHeatmap();
  renderDailyTrendChart();
}

function renderHeatmap() {
  const dept = document.getElementById('heatmap-dept-filter').value;
  const el = document.getElementById('heatmap-container');

  const dates = [...new Set(allRecords.map(r=>r.date))].sort();
  if (dates.length === 0) { el.innerHTML = '<p style="color:var(--text-sub)">データがありません</p>'; return; }

  // 日別合計（分）
  const dayTotals = {};
  dates.forEach(d => {
    const recs = allRecords.filter(r => r.date===d && (dept==='all'||r.dept===dept));
    dayTotals[d] = recs.reduce((s,r)=>s+r.normalMin+r.otMin,0);
  });
  const maxMin = Math.max(...Object.values(dayTotals), 1);

  // カレンダー形式
  const ym = dates[0].substring(0,7);
  const [y,m] = ym.split('-').map(Number);
  const firstDay = new Date(y,m-1,1).getDay();
  const lastDate = new Date(y,m,0).getDate();

  const dowLabels = ['日','月','火','水','木','金','土'];
  let html = `<table class="heatmap-table"><thead><tr>${dowLabels.map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody><tr>`;
  for (let i=0; i<firstDay; i++) html += '<td></td>';
  for (let day=1; day<=lastDate; day++) {
    const dateStr = `${ym}-${String(day).padStart(2,'0')}`;
    const dow = new Date(y,m-1,day).getDay();
    const min = dayTotals[dateStr] || 0;
    const ratio = min / maxMin;
    const r = Math.round(79 + (231-79)*ratio);
    const g = Math.round(142 + (76-142)*ratio);
    const b = Math.round(247 + (60-247)*ratio);
    const bg = min > 0 ? `rgba(${r},${g},${b},${0.2+ratio*0.7})` : 'transparent';
    const textColor = min > 0 ? '#e8eaf0' : '#3d4466';
    html += `<td><div class="heatmap-cell" style="background:${bg};color:${textColor}" title="${dateStr}: ${fmtMin(min)}">
      <div>${day}</div>${min>0?`<div style="font-size:0.68rem">${Math.round(min/60*10)/10}h</div>`:''}
    </div></td>`;
    if (dow === 6 && day < lastDate) html += '</tr><tr>';
  }
  html += '</tr></tbody></table>';
  el.innerHTML = html;
}

function renderDailyTrendChart() {
  const ctx = document.getElementById('chart-daily-trend').getContext('2d');
  destroyChart('daily-trend');
  const dates = [...new Set(allRecords.map(r=>r.date))].sort();
  chartInstances['daily-trend'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        { label:'通常業務(h)', data: dates.map(d=>{ const min=allRecords.filter(r=>r.date===d).reduce((s,r)=>s+r.normalMin,0); return Math.round(min/60*10)/10; }), backgroundColor:'rgba(79,142,247,0.7)', borderWidth:0 },
        { label:'時間外(h)',   data: dates.map(d=>{ const min=allRecords.filter(r=>r.date===d).reduce((s,r)=>s+r.otMin,0); return Math.round(min/60*10)/10; }), backgroundColor:'rgba(231,76,60,0.7)', borderWidth:0 },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { stacked:true, ticks:{ color:'#8b92b0', maxTicksLimit:15 }, grid:{ color:'#2e3350' } },
        y: { stacked:true, ticks:{ color:'#8b92b0' }, grid:{ color:'#2e3350' } }
      },
      plugins: { legend:{ labels:{ color:'#8b92b0' } } }
    }
  });
}

// ============================================================
// アラートタブ
// ============================================================
function renderAlertTab() {
  const { otAlerts, vacAlerts, breakAlerts } = buildAlerts();
  const s = loadSettings();

  const summaryEl = document.getElementById('alert-summary-grid');
  summaryEl.innerHTML = [
    { icon:'⏰', title:'時間外アラート', count:otAlerts.length, desc:`月合計${s.otAlert}時間超` },
    { icon:'🏖️', title:'休暇中業務アラート', count:vacAlerts.length, desc:`月合計${s.vacationAlert}時間超` },
    { icon:'☕', title:'休憩不足アラート', count:breakAlerts.length, desc:`1日${s.breakWarn}分未満の日あり` },
  ].map(item => `
    <div class="alert-summary-card">
      <div class="alert-summary-title">${item.icon} ${item.title}</div>
      <div class="alert-summary-count" style="color:${item.count>0?'var(--red)':'var(--green)'}">${item.count}人</div>
      <div class="alert-summary-desc">${item.desc}</div>
    </div>`).join('');

  const detailEl = document.getElementById('alert-detail-list');
  const items = [
    ...otAlerts.map(m => ({ m, type:'時間外超過', val: fmtMin(getMemberStats(m.empId).otMin) })),
    ...vacAlerts.map(m => ({ m, type:'休暇中業務超過', val: fmtMin(getMemberStats(m.empId).vacMin) })),
    ...breakAlerts.map(m => ({ m, type:'休憩不足', val: '要確認' })),
  ];
  detailEl.innerHTML = items.length === 0
    ? '<p style="color:var(--text-sub);padding:16px">アラートはありません</p>'
    : items.map(item => `
      <div class="alert-detail-item">
        <span class="alert-detail-name">${item.m.name}</span>
        <span class="alert-detail-type">${item.m.dept}</span>
        <span class="alert-detail-type">${item.type}</span>
        <span class="alert-detail-value">${item.val}</span>
      </div>`).join('');
}

// ============================================================
// Chart.js インスタンス破棄
// ============================================================
function destroyChart(key) {
  if (chartInstances[key]) { chartInstances[key].destroy(); delete chartInstances[key]; }
}

// ============================================================
// トースト
// ============================================================
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ============================================================
// 初期化
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Enterキーでログイン
  document.getElementById('login-password').focus();
  
  // 既にログイン状態（リロード時など）の対応
  if (document.getElementById('main-screen').style.display !== 'none') {
    loadSettingsForm();
    loadStoredData();
    renderAll();
  }
});
