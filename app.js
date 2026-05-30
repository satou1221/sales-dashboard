'use strict';

// ============================================================
// 定数・グローバル
// ============================================================
const DEFAULT_PASSWORD = 'admin1234';
const WORK_COLORS = {
  '九電碍・点':       '#0066FF',  // 鮮青
  '九電管路':         '#9900CC',  // 鮮紫
  '他電力碍・点':     '#00CCCC',  // シアン
  '直送商':           '#FF3300',  // 鮮赤
  '在庫商':           '#FF9900',  // 鮮オレンジ
  '外販製品（非電力）':'#00CC44',  // 鮮緑
  'TKD':              '#FF66CC',  // ピンク
  '社内対応':         '#AAAAAA',  // 明るい灰（大面積展展対策）
  '休憩':             '#FFFF00',  // 黄
  '懇親会':           '#00FFCC',  // ミントグリーン
  '時間外':           '#FF0066',  // ピンク赤
  '休暇中業務':       '#66FF00',  // 黄緑
};

let allRecords = [];    // 全CSV行データ
let chartInstances = {}; // Chart.jsインスタンス管理

// ============================================================
// 設定（LocalStorage）
// ============================================================
function loadSettings() {
  const def = { otAlert: 45, vacationAlert: 10, breakOk: 40, breakWarn: 1 };
  try { return Object.assign(def, JSON.parse(localStorage.getItem('dash_settings') || '{}')); }
  catch { return def; }
}
function saveSettings() {
  const s = {
    otAlert:       parseInt(document.getElementById('set-ot-alert').value) || 45,
    vacationAlert: parseInt(document.getElementById('set-vacation-alert').value) || 10,
    breakOk:       parseInt(document.getElementById('set-break-ok').value) || 40,
    breakWarn:     parseInt(document.getElementById('set-break-warn').value) || 1,
  };
  localStorage.setItem('dash_settings', JSON.stringify(s));
  showToast('設定を保存しました');
  renderAll();
}
function loadSettingsForm() {
  const s = loadSettings();
  document.getElementById('set-ot-alert').value       = s.otAlert;
  document.getElementById('set-vacation-alert').value = s.vacationAlert;
  document.getElementById('set-break-ok').value       = s.breakOk;
  document.getElementById('set-break-warn').value     = s.breakWarn;
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
const TAB_TITLES = { dashboard:'ダッシュボード', dept:'部門別分析', personal:'個人別分析', daily:'日別分析', alert:'アラート', csv:'CSV取込', settings:'設定' };
function switchTab(name) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  document.getElementById('page-title').textContent = TAB_TITLES[name] || name;
  if (name === 'dept')     renderDeptTab();
  if (name === 'personal') renderPersonalTab();
  if (name === 'daily')    renderDailyTab();
  if (name === 'alert')    renderAlertTab();
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
  renderKPI();
  renderWorktypeChart();
  renderPersonalBarChart();
  renderBreakStatus();
  renderDeptCompare();
  renderDashboardAlerts();
  renderOtList();
  renderMemberGrid();
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
  if (members.length === 0) {
    ['kpi-total','kpi-ot','kpi-vacation','kpi-break-short','kpi-avg','kpi-alert-count'].forEach(id => {
      document.getElementById(id).textContent = '--';
    });
    return;
  }

  let totalMin = 0, otMin = 0, vacMin = 0;
  let breakShort = 0, alertCount = 0;
  members.forEach(m => {
    const st = getMemberStats(m.empId);
    totalMin += st.totalMin; otMin += st.otMin; vacMin += st.vacMin;
    // 休憩不足（1日でも不足があれば）
    const hasShort = Object.values(st.breakByDay).some(v => v < s.breakOk && v > 0);
    if (hasShort) breakShort++;
    // 要確認（時間外 or 休暇中業務アラート）
    if (st.otMin >= s.otAlert * 60 || st.vacMin >= s.vacationAlert * 60) alertCount++;
  });

  document.getElementById('kpi-total').textContent       = fmtMin(totalMin);
  document.getElementById('kpi-ot').textContent          = fmtMin(otMin);
  document.getElementById('kpi-vacation').textContent    = fmtMin(vacMin);
  document.getElementById('kpi-break-short').textContent = `${breakShort}人`;
  document.getElementById('kpi-avg').textContent         = members.length > 0 ? fmtMin(Math.round(totalMin / members.length)) : '--';
  document.getElementById('kpi-alert-count').textContent = `${alertCount}人`;
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
  const colors = labels.map(l => WORK_COLORS[l] || '#666');

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

  const workTypes = ['九電碍・点','九電管路','他電力碍・点','直送商','在庫商','外販製品（非電力）','TKD','社内対応'];
  const datasets = workTypes.map(wt => ({
    label: wt,
    data: members.map(m => {
      const recs = allRecords.filter(r => r.empId === m.empId && r.workType === wt);
      return Math.round(recs.reduce((s,r) => s + r.normalMin + r.otMin + r.vacationMin, 0) / 60 * 10) / 10;
    }),
    backgroundColor: WORK_COLORS[wt] || '#666',
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

  const rows = [
    ['総業務時間',   fmtMin(all.totalMin),   fmtMin(honsha.totalMin),   fmtMin(fukuoka.totalMin)],
    ['1人あたり平均', all.count>0?fmtMin(Math.round(all.totalMin/all.count)):'--', honsha.count>0?fmtMin(Math.round(honsha.totalMin/honsha.count)):'--', fukuoka.count>0?fmtMin(Math.round(fukuoka.totalMin/fukuoka.count)):'--'],
    ['時間外',       fmtMin(all.otMin),      fmtMin(honsha.otMin),      fmtMin(fukuoka.otMin)],
    ['休暇中業務',   fmtMin(all.vacMin),     fmtMin(honsha.vacMin),     fmtMin(fukuoka.vacMin)],
    ['在籍人数',     `${all.count}人`,        `${honsha.count}人`,        `${fukuoka.count}人`],
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
  const { otAlerts, vacAlerts, breakAlerts } = buildAlerts();
  const s = loadSettings();
  const el = document.getElementById('dashboard-alert-list');

  const items = [
    { icon:'⏰', title:`時間外アラート（${s.otAlert}時間超）`, list: otAlerts },
    { icon:'🏖️', title:`休暇中業務アラート（${s.vacationAlert}時間超）`, list: vacAlerts },
    { icon:'☕', title:'休憩不足アラート（0〜' + (s.breakWarn-1) + '分）', list: breakAlerts },
  ];

  el.innerHTML = items.map(item => {
    const desc = item.list.length > 0
      ? item.list.slice(0,2).map(m=>m.name).join('、') + (item.list.length > 2 ? ` 他${item.list.length-2}名` : '')
      : 'なし';
    return `<div class="alert-item" onclick="switchTab('alert')">
      <div class="alert-item-icon">${item.icon}</div>
      <div class="alert-item-body">
        <div class="alert-item-title">${item.title}</div>
        <div class="alert-item-desc">${desc}</div>
      </div>
      <div class="alert-item-count">${item.list.length}人 ›</div>
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

  el.innerHTML = members.map(m => {
    const st = getMemberStats(m.empId);
    const hasOtAlert  = st.otMin  >= s.otAlert * 60;
    const hasVacAlert = st.vacMin >= s.vacationAlert * 60;
    const hasBreakIssue = Object.values(st.breakByDay).some(v => v < s.breakWarn && v >= 0);
    const statusClass = (hasOtAlert || hasVacAlert) ? 'status-danger' : hasBreakIssue ? 'status-warn' : 'status-ok';
    const statusLabel = (hasOtAlert || hasVacAlert) ? '要確認' : hasBreakIssue ? '注意' : 'OK';

    return `<div class="member-card">
      <div class="member-card-name">${m.name}</div>
      <div class="member-card-dept">${m.dept} / ${m.role||''}</div>
      <div class="member-card-row"><span class="label">総業務</span><span class="value">${fmtMin(st.totalMin)}</span></div>
      <div class="member-card-row"><span class="label">時間外</span><span class="value ${hasOtAlert?'red':''}">${fmtMin(st.otMin)}</span></div>
      <div class="member-card-row"><span class="label">休憩</span><span class="value">${fmtMin(st.breakMin)}</span></div>
      <div class="member-card-row"><span class="label">休暇中業務</span><span class="value ${hasVacAlert?'orange':''}">${fmtMin(st.vacMin)}</span></div>
      <div class="member-card-status ${statusClass}">${statusLabel}</div>
    </div>`;
  }).join('');
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
  const workTypes = ['九電碍・点','九電管路','他電力碍・点','直送商','在庫商','外販製品（非電力）','TKD','社内対応'];
  const datasets = workTypes.map(wt => ({
    label: wt,
    data: depts.map(dept => {
      const recs = allRecords.filter(r => r.dept === dept && r.workType === wt);
      return Math.round(recs.reduce((s,r) => s + r.normalMin + r.otMin + r.vacationMin, 0) / 60 * 10) / 10;
    }),
    backgroundColor: WORK_COLORS[wt] || '#666',
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
      datasets: [{ data: sorted.map(([,v])=>Math.round(v/60*10)/10), backgroundColor: sorted.map(([k])=>WORK_COLORS[k]||'#666'), borderWidth:0 }]
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
      datasets: [{ data: sorted.map(([,v])=>Math.round(v/60*10)/10), backgroundColor: sorted.map(([k])=>WORK_COLORS[k]||'#666'), borderWidth:0 }]
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
});
