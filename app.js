'use strict';

// ============================================================
// 定数・グローバル
// ============================================================
const DEFAULT_PASSWORD = 'admin1234';
const SETTINGS_VERSION = '4.7.5'; // 設定のバージョン管理用

// デフォルトの業務区分マスター
const DEFAULT_WORK_MASTER = [
  { name: '社内対応',          importance: 25, color: '#4f8ef7' },
  { name: '直送商',            importance: 20, color: '#e74c3c' },
  { name: '外販製品（非電力）', importance: 15, color: '#2ecc71' },
  { name: '他電力等・点',      importance: 10, color: '#f1c40f' },
  { name: '在庫商',            importance: 10, color: '#9b59b6' },
  { name: '九電尋・点',        importance: 10, color: '#1abc9c' },
  { name: 'TKD',               importance:  5, color: '#e67e22' },
  { name: '九電管路',          importance:  5, color: '#e91e63' },
];

// ============================================================
// デフォルトスコア設定（仕様書準拠）
// デフォルトスコア設定（2026年6月版・設計書準拠）
const DEFAULT_SCORE_CONFIG = {
  // 休暇中業務
  vacDayPt:        8,    // 休暇中業務発生日数 × 8
  vacHourPt:        3,   // 休暇中業務時間 × 3
  // 休憩0分（実業務6時間超かつ休憩0分のみ）
  break0Pt:        7,    // 休憩0分日数 × 7
  // 時間外
  ot60Pt:           3,   // 残業60〜89分 × 3
  ot90Pt:           5,   // 残業90〜119分 × 5
  ot120Pt:         7,    // 残業120分以上 × 7
  otMonth20Pt:     5,    // 月間時間外20時間以上 +5
  otMonth30Pt:     10,   // 月間時間外30時間以上 +10
  // 休憩不足（実業務6時間超の日のみ）
  break36Pt:        1,   // 休憩36〜44分 × 1
  break21Pt:        2,   // 休憩21〜35分 × 2
  break1Pt:         4,   // 休憩1〜20分 × 4
  // 実業務8時間超かつ休憩60分未満
  ot8hBreak60Pt:    2,   // × 2
  // 複合条件
  comp3BreakPt:     4,   // 休憩35分以下3日連続 × 4
  comp3OtPt:        6,   // 残業90分以上3日連続 × 6
  compBreak0OtPt:   8,   // 休憩0分かつ残業90分以上の日 × 8
  compVacOtPt:      8,   // 休暇中業務かつ時間外ありの日 × 8
  compBreakOtPt:    5,   // 休憩35分以下かつ残業90分以上の日 × 5
};

// デフォルトアラートレベル閾値（2026年6月版）
const DEFAULT_LEVEL_CONFIG = {
  lv0Max: 5,    // 0〜5: Lv.0 通常
  lv1Max: 50,   // 6〜50: Lv.1 軽注意
  lv2Max: 100,  // 51〜100: Lv.2 面談確認
  lv3Max: 200,  // 101〜200: Lv.3 要確認
                // 201以上: Lv.4 重点確認
};

// デフォルト強制アラート条件（2026年6月版）
const DEFAULT_FORCE_CONFIG = {
  vacDay1Lv:   2,  // 休暇中業務1日以上 → Lv.2以上
  vacDay2Lv:   3,  // 休暇中業務2日以上 → Lv.3以上
  vacDay3Lv:   4,  // 休暇中業務3日以上 → Lv.4以上
  vacHour3Lv:  3,  // 休暇中業務3時間以上 → Lv.3以上
  vacHour6Lv:  4,  // 休暇中業務6時間以上 → Lv.4以上
  break0Day1Lv: 2, // 休憩0分1日以上 → Lv.2以上
  break0Day3Lv: 3, // 休憩0分3日以上 → Lv.3以上
  break0Day5Lv: 4, // 休憩0分5日以上 → Lv.4以上
  ot90Day5Lv:  3,  // 残業90分以上5日以上 → Lv.3以上
  ot120Day3Lv: 4,  // 残業120分以上3日以上 → Lv.4以上
  break35Day5Lv: 3,// 休憩35分以下5日以上 → Lv.3以上
  break35Day10Lv:4, // 休憩35分以下10日以上 → Lv.4以上
  compBreak0Ot90Lv: 3, // 休憩0分かつ残業90分以上同日 → Lv.3以上
  compVacOtLv:  3, // 休暇中業務かつ時間外同日 → Lv.3以上
};
let allRecords = [];
let chartInstances = {};

// ============================================================
// 設定（LocalStorage）
// ============================================================
function loadSettings() {
  const def = {
    workMaster:   DEFAULT_WORK_MASTER,
    scoreConfig:  DEFAULT_SCORE_CONFIG,
    levelConfig:  DEFAULT_LEVEL_CONFIG,
    forceConfig:  DEFAULT_FORCE_CONFIG,
    // 後方互換
    otAlert:      45,
    vacationAlert: 10,
    breakOk:      40,
    breakWarn:     1,
  };
  try {
    let stored = JSON.parse(localStorage.getItem(\'dash_settings\') || \'{}\');

    // 設定のバージョン管理とマイグレーション
    if (stored.version !== SETTINGS_VERSION) {
      console.log(`Settings migration: from ${stored.version || 'old'} to ${SETTINGS_VERSION}`);
      // 古い設定を破棄し、最新のデフォルト設定を適用（パスワードは保持）
      const currentPassword = localStorage.getItem('dash_password'); // 現在のパスワードを一時的に保持
      stored = {}; 
      localStorage.removeItem('dash_settings'); // 古い設定を完全に削除
      if (currentPassword) {
        localStorage.setItem('dash_password', currentPassword); // 保持したパスワードを復元
      }
    }

    // ネストされたオブジェクトはマージ
    const merged = Object.assign({}, def, stored);
    merged.scoreConfig  = Object.assign({}, DEFAULT_SCORE_CONFIG,  stored.scoreConfig  || {});
    merged.levelConfig  = Object.assign({}, DEFAULT_LEVEL_CONFIG,  stored.levelConfig  || {});
    merged.forceConfig  = Object.assign({}, DEFAULT_FORCE_CONFIG,  stored.forceConfig  || {});
    if (!merged.workMaster || merged.workMaster.length === 0) merged.workMaster = DEFAULT_WORK_MASTER;
    merged.version = SETTINGS_VERSION; // 最新バージョンを保存
    saveSettingsObj(merged); // マイグレーション後の設定を保存
    return merged;
  } catch (e) {
    console.error(\'Error loading settings:\', e);
    const newSettings = { ...def, version: SETTINGS_VERSION };
    saveSettingsObj(newSettings); // エラー時はデフォルト設定を保存
    return newSettings;
  }
}

function saveSettingsObj(s) {
  localStorage.setItem('dash_settings', JSON.stringify(s));
}

function getWorkColor(name) {
  const s = loadSettings();
  const found = s.workMaster.find(m => m.name === name);
  return found ? found.color : '#666666';
}

// ============================================================
// パスワード
// ============================================================
function getPassword() { return localStorage.getItem('dash_password') || DEFAULT_PASSWORD; }

function doLogin() {
  try {
    const pw = document.getElementById(\'login-password\').value;
    if (pw === getPassword()) {
      document.getElementById(\'login-screen\').style.display = \'none\';
      document.getElementById(\'main-screen\').style.display  = \'flex\';
      loadSettingsForm();
      loadStoredData();
      renderAll();
    } else {
      document.getElementById(\'login-error\').style.display = \'block\';
    }
  } catch (e) {
    console.error(\'Login error:\', e);
    alert(\'ログイン中にエラーが発生しました。コンソールを確認してください。\');
  }
}
document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('login-button').addEventListener('click', doLogin); // ログインボタンのイベントリスナーを追加

function doLogout() {
  document.getElementById('main-screen').style.display  = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display  = 'none';
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
  document.getElementById('set-pw-new').value     = '';
  document.getElementById('set-pw-confirm').value = '';
}

// ============================================================
// タブ切替
// ============================================================
const TAB_TITLES = {
  summary:'全体サマリー', dashboard:'ダッシュボード', dept:'部門別分析',
  personal:'個人別分析', daily:'日別分析', alert:'アラート',
  csv:'CSV取込', settings:'設定'
};

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
        const rows = parseCSV(e.target.result);
        if (rows.length > 0) {
          const empId = rows[0].empId;
          const ym    = rows[0].date.substring(0, 7);
          allRecords  = allRecords.filter(r => !(r.empId === empId && r.date.startsWith(ym)));
          allRecords  = allRecords.concat(rows);
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
  text = text.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 9) continue;
    rows.push({
      empId:       cols[0].trim(),
      name:        cols[1].trim(),
      dept:        cols[2].trim(),
      role:        cols[3].trim(),
      date:        cols[4].trim(),
      dow:         cols[5].trim(),
      workType:    cols[6].trim(),
      startTime:   cols[7].trim(),
      endTime:     cols[8].trim(),
      normalMin:   parseInt(cols[9])  || 0,
      otMin:       parseInt(cols[10]) || 0,
      breakMin:    parseInt(cols[11]) || 0,
      partyMin:    parseInt(cols[12]) || 0,
      vacationMin: parseInt(cols[13]) || 0,
      memo:        (cols[14] || '').trim(),
    });
  }
  return rows;
}

const dropArea = document.getElementById('csv-drop-area');
dropArea.addEventListener('dragover',  e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
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
  const recs     = allRecords.filter(r => r.empId === empId);
  const totalMin = recs.reduce((s,r) => s + r.normalMin + r.otMin, 0);
  const otMin    = recs.reduce((s,r) => s + r.otMin, 0);
  const breakMin = recs.reduce((s,r) => s + r.breakMin, 0);
  const vacMin   = recs.reduce((s,r) => s + r.vacationMin, 0);
  const partyMin = recs.reduce((s,r) => s + r.partyMin, 0);

  // 業務区分別
  const byType = {};
  recs.forEach(r => {
    if (r.workType === '休憩') return;
    byType[r.workType] = (byType[r.workType] || 0) + r.normalMin + r.otMin + r.vacationMin;
  });

  // 日別集計（1日 = 1エントリ）
  const dayMap = {};
  recs.forEach(r => {
    if (!dayMap[r.date]) dayMap[r.date] = { breakMin:0, otMin:0, vacMin:0, hasVac:false };
    dayMap[r.date].breakMin   += r.breakMin;
    dayMap[r.date].otMin      += r.otMin;
    dayMap[r.date].vacMin     += r.vacationMin;
    if (r.vacationMin > 0) dayMap[r.date].hasVac = true;
  });

  return { totalMin, otMin, breakMin, vacMin, partyMin, byType, dayMap };
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
// 業務負荷スコア計算（仕様書準拠）
// ============================================================
function calculateScores(empId) {
  const cfg = loadSettings().scoreConfig;
  const lvc = loadSettings().levelConfig;
  const frc = loadSettings().forceConfig;
  const st  = getMemberStats(empId);
  const days = Object.entries(st.dayMap); // [[date, {breakMin,otMin,vacMin,hasVac}]]

  // --- 1. 休暇中業務スコア ---
  const vacDays  = days.filter(([,d]) => d.hasVac).length;
  const vacHours = st.vacMin / 60;
  const vacScore = vacDays * cfg.vacDayPt + vacHours * cfg.vacHourPt;

  // --- 2. 休憩0分スコア（実業務6時間超かつ休憩0分のみ） ---
  // 実業務時間 = 速報時間 + 残業時間 - 休憩時間
  const break0DaysActual = days.filter(([,d]) => {
    const workHours = (st.totalMin - d.breakMin) / 60; // 実業務時間を粗い推定
    return d.breakMin === 0 && workHours >= 6; // 実業6時間超かつ休憩0分
  }).length;
  const break0Score = break0DaysActual * cfg.break0Pt;

  // --- 3. 時間外スコア ---
  const ot60Days  = days.filter(([,d]) => d.otMin >= 60  && d.otMin < 90).length;
  const ot90Days  = days.filter(([,d]) => d.otMin >= 90  && d.otMin < 120).length;
  const ot120Days = days.filter(([,d]) => d.otMin >= 120).length;
  const otMonthMin = st.otMin;
  let otScore = ot60Days * cfg.ot60Pt + ot90Days * cfg.ot90Pt + ot120Days * cfg.ot120Pt;
  if (otMonthMin >= 30 * 60) otScore += cfg.otMonth30Pt;
  else if (otMonthMin >= 20 * 60) otScore += cfg.otMonth20Pt;

  // --- 4. 休憩不足スコア（実業務6時間超の日のみ） ---
  const break36Days = days.filter(([,d]) => {
    const workHours = (st.totalMin - d.breakMin) / 60;
    return d.breakMin >= 36 && d.breakMin <= 44 && workHours >= 6;
  }).length;
  const break21Days = days.filter(([,d]) => {
    const workHours = (st.totalMin - d.breakMin) / 60;
    return d.breakMin >= 21 && d.breakMin <= 35 && workHours >= 6;
  }).length;
  const break1Days  = days.filter(([,d]) => {
    const workHours = (st.totalMin - d.breakMin) / 60;
    return d.breakMin >= 1  && d.breakMin <= 20 && workHours >= 6;
  }).length;
  const breakShortScore = break36Days * cfg.break36Pt + break21Days * cfg.break21Pt + break1Days * cfg.break1Pt;

  // --- 5. 複合条件スコア ---
  // 休憩35分以下が3営業日連続した回数
  const break35Dates = days.filter(([,d]) => d.breakMin <= 35).map(([date]) => date).sort();
  const comp3BreakCount = countConsecutive(break35Dates, 3);

  // 残業90分以上が3営業日連続した回数
  const ot90Dates = days.filter(([,d]) => d.otMin >= 90).map(([date]) => date).sort();
  const comp3OtCount = countConsecutive(ot90Dates, 3);

  // 休憩0分かつ残業90分以上の日数
  const compBreak0OtDays = days.filter(([,d]) => d.breakMin === 0 && d.otMin >= 90).length;

  // 休暇中業務かつ時間外ありの日数
  const compVacOtDays = days.filter(([,d]) => d.hasVac && d.otMin > 0).length;

  // 休憩35分以下かつ残業90分以上の日数
  const compBreakOtDays = days.filter(([,d]) => d.breakMin > 0 && d.breakMin <= 35 && d.otMin >= 90).length;

  const compScore = comp3BreakCount * cfg.comp3BreakPt
    + comp3OtCount * cfg.comp3OtPt
    + compBreak0OtDays * cfg.compBreak0OtPt
    + compVacOtDays * cfg.compVacOtPt
    + compBreakOtDays * cfg.compBreakOtPt;

  // --- 合計スコア ---
  const totalScore = Math.round(vacScore + break0Score + otScore + breakShortScore + compScore);

  // --- スコアによるレベル判定 ---
  let scoreLevel = 0;
  if (totalScore > lvc.lv3Max)      scoreLevel = 4;
  else if (totalScore > lvc.lv2Max) scoreLevel = 3;
  else if (totalScore > lvc.lv1Max) scoreLevel = 2;
  else if (totalScore > lvc.lv0Max) scoreLevel = 1;
  else                              scoreLevel = 0;

  // --- 強制アラート ---
  let forceLevel = 0;
  if (vacDays >= 1)                          forceLevel = Math.max(forceLevel, frc.vacDay1Lv);
  if (vacDays >= 2)                          forceLevel = Math.max(forceLevel, frc.vacDay2Lv);
  if (vacDays >= 3)                          forceLevel = Math.max(forceLevel, frc.vacDay3Lv);
  if (vacHours >= 3)                         forceLevel = Math.max(forceLevel, frc.vacHour3Lv);
  if (vacHours >= 6)                         forceLevel = Math.max(forceLevel, frc.vacHour6Lv);
  if (break0DaysActual >= 1)                 forceLevel = Math.max(forceLevel, frc.break0Day1Lv);
  if (break0DaysActual >= 3)                 forceLevel = Math.max(forceLevel, frc.break0Day3Lv);
  if (break0DaysActual >= 5)                 forceLevel = Math.max(forceLevel, frc.break0Day5Lv);
  if (ot90Days + ot120Days >= 5)             forceLevel = Math.max(forceLevel, frc.ot90Day5Lv);
  if (ot120Days >= 3)                        forceLevel = Math.max(forceLevel, frc.ot120Day3Lv);
  const break35TotalDays = break21Days + break1Days + break0DaysActual;
  if (break35TotalDays >= 5)                 forceLevel = Math.max(forceLevel, frc.break35Day5Lv);
  if (break35TotalDays >= 10)                forceLevel = Math.max(forceLevel, frc.break35Day10Lv);
  if (compBreak0OtDays >= 1)                 forceLevel = Math.max(forceLevel, frc.compBreak0Ot90Lv);
  if (compVacOtDays >= 1)                    forceLevel = Math.max(forceLevel, frc.compVacOtLv);

  const riskLevel = Math.max(scoreLevel, forceLevel);

  // --- スコア内訳 ---
  const breakdown = {
    vac:   { days: vacDays,         hours: Math.round(vacHours*10)/10, pt: Math.round(vacScore) },
    break0:{ days: break0DaysActual, pt: Math.round(break0Score) },
    ot:    { d60: ot60Days, d90: ot90Days, d120: ot120Days, monthMin: otMonthMin, pt: Math.round(otScore) },
    breakShort: { d36: break36Days, d21: break21Days, d1: break1Days, pt: Math.round(breakShortScore) },
    comp:  { c3Break: comp3BreakCount, c3Ot: comp3OtCount, cB0Ot: compBreak0OtDays, cVacOt: compVacOtDays, cBOt: compBreakOtDays, pt: Math.round(compScore) },
  };

  return { score: totalScore, riskLevel, breakdown };
}

// 連続N日のカウント
function countConsecutive(sortedDates, n) {
  if (sortedDates.length < n) return 0;
  let count = 0, streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i-1]);
    const curr = new Date(sortedDates[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diff === 1) { streak++; if (streak >= n) count++; }
    else streak = 1;
  }
  return count;
}

// ============================================================
// 主な要因テキスト生成（仕様書準拠）
// ============================================================
function buildRiskReason(empId) {
  const sc = calculateScores(empId);
  const bd = sc.breakdown;
  const reasons = [];

  // 強制アラート理由を優先的に表示
  if (sc.riskLevel > sc.scoreLevel) {
    const frc = loadSettings().forceConfig;
    if (bd.vac.days >= 3 && sc.riskLevel === frc.vacDay3Lv) reasons.push(`休暇中業務${bd.vac.days}日`);
    else if (bd.vac.days >= 2 && sc.riskLevel === frc.vacDay2Lv) reasons.push(`休暇中業務${bd.vac.days}日`);
    else if (bd.vac.days >= 1 && sc.riskLevel === frc.vacDay1Lv) reasons.push(`休暇中業務${bd.vac.days}日`);
    else if (bd.vac.hours >= 6 && sc.riskLevel === frc.vacHour6Lv) reasons.push(`休暇中業務${bd.vac.hours}時間`);
    else if (bd.vac.hours >= 3 && sc.riskLevel === frc.vacHour3Lv) reasons.push(`休暇中業務${bd.vac.hours}時間`);
    else if (bd.break0.days >= 5 && sc.riskLevel === frc.break0Day5Lv) reasons.push(`休憩0分${bd.break0.days}日`);
    else if (bd.break0.days >= 3 && sc.riskLevel === frc.break0Day3Lv) reasons.push(`休憩0分${bd.break0.days}日`);
    else if (bd.break0.days >= 1 && sc.riskLevel === frc.break0Day1Lv) reasons.push(`休憩0分${bd.break0.days}日`);
    else if ((bd.ot.d90 + bd.ot.d120) >= 5 && sc.riskLevel === frc.ot90Day5Lv) reasons.push(`残業90分以上${(bd.ot.d90 + bd.ot.d120)}日`);
    else if (bd.ot.d120 >= 3 && sc.riskLevel === frc.ot120Day3Lv) reasons.push(`残業120分以上${bd.ot.d120}日`);
    else if ((bd.breakShort.d1 + bd.breakShort.d21 + bd.breakShort.d36) >= 10 && sc.riskLevel === frc.break35Day10Lv) reasons.push(`休憩35分以下${(bd.breakShort.d1 + bd.breakShort.d21 + bd.breakShort.d36)}日`);
    else if ((bd.breakShort.d1 + bd.breakShort.d21 + bd.breakShort.d36) >= 5 && sc.riskLevel === frc.break35Day5Lv) reasons.push(`休憩35分以下${(bd.breakShort.d1 + bd.breakShort.d21 + bd.breakShort.d36)}日`);
    else if (bd.comp.cB0Ot >= 1 && sc.riskLevel === frc.compBreak0Ot90Lv) reasons.push(`休憩0分+残業90分超`);
    else if (bd.comp.cVacOt >= 1 && sc.riskLevel === frc.compVacOtLv) reasons.push(`休暇中業務+時間外`);
  }

  // 優先度順に表示（スコア要因）
  if (reasons.length === 0) {
    if (bd.comp.cVacOt >= 1)           reasons.push(`休暇中業務かつ時間外 ${bd.comp.cVacOt}日`);
    else if (bd.vac.days >= 2)         reasons.push(`休暇中業務 ${bd.vac.days}日`);
    else if (bd.vac.days >= 1)         reasons.push(`休暇中業務あり`);

    if (bd.break0.days >= 2)           reasons.push(`休憩0分 ${bd.break0.days}日`);
    else if (bd.break0.days === 1)     reasons.push(`休憩0分 1日`);

    if (bd.ot.d120 >= 1)               reasons.push(`残業120分以上 ${bd.ot.d120}日`);
    else if (bd.ot.d90 >= 3)           reasons.push(`残業90分超 ${bd.ot.d90}日`);
    else if (bd.ot.d90 >= 1)           reasons.push(`残業90分超 ${bd.ot.d90}日`);

    if (bd.breakShort.d1 >= 1)         reasons.push(`休憩1〜20分 ${bd.breakShort.d1}日`);
    else if (bd.breakShort.d21 >= 2)   reasons.push(`休憩21〜35分 ${bd.breakShort.d21}日`);
    else if (bd.breakShort.d36 >= 1)   reasons.push(`休憩36〜44分 ${bd.breakShort.d36}日`);

    if (bd.comp.c3Break >= 1)          reasons.push(`休憩不足3日連続 ${bd.comp.c3Break}回`);
    if (bd.comp.c3Ot >= 1)             reasons.push(`残業90分超3日連続 ${bd.comp.c3Ot}回`);
    if (bd.comp.cB0Ot >= 1)            reasons.push(`休憩0分+残業90分超 ${bd.comp.cB0Ot}日`);

    if (bd.ot.monthMin >= 30 * 60)     reasons.push(\'月間時間外30時間超\');
    else if (bd.ot.monthMin >= 20 * 60) reasons.push(\'月間時間外20時間超\');

    if (reasons.length === 0 && bd.ot.d60 >= 2) reasons.push(`残業60〜89分が多い（${bd.ot.d60}日）`);
  }

  return reasons.slice(0, 3).join(\'、\') || \'なし\';
}

// ============================================================
// レベル表示ユーティリティ
// ============================================================
const LV_COLOR = { 4:'#e74c3c', 3:'#e67e22', 2:'#f1c40f', 1:'#4f8ef7', 0:'#2ecc71' };
const LV_LABEL = { 4:'重点確認', 3:'要確認', 2:'面談確認', 1:'軽注意', 0:'通常' };


function lvColor(lv) { return LV_COLOR[lv] || '#2ecc71'; }
function lvLabel(lv) { return LV_LABEL[lv] || '通常'; }

// ============================================================
// 全体レンダリング
// ============================================================
function renderAll() {
  updateHeaderPeriod();
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
  const ym = dates[0].substring(0, 7);
  document.getElementById('header-period').textContent = `${ym.replace('-', '年')}月 データ`;
  document.getElementById('header-update').textContent =
    `最終更新: ${new Date().toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`;
}

// ============================================================
// KPIカード
// ============================================================
function renderKPI() {
  const members = getMembers();

  function setMom(elId, val, prevVal, unit) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (prevVal == null) { el.textContent = ''; return; }
    const diff = val - prevVal;
    const sign = diff >= 0 ? '+' : '';
    const arrow = diff >= 0 ? '▲' : '▼';
    const cls = diff > 0 ? 'mom-up' : diff < 0 ? 'mom-down' : 'mom-flat';
    if (unit === 'min') {
      const h = Math.floor(Math.abs(diff)/60), m = Math.abs(diff)%60;
      const ds = h > 0 ? `${sign}${h}時間${m}分` : `${sign}${m}分`;
      el.innerHTML = `<span class="${cls}">前月比 ${ds} ${arrow}</span>`;
    } else {
      const pct = prevVal !== 0 ? Math.round(diff / prevVal * 1000) / 10 : 0;
      el.innerHTML = `<span class="${cls}">前月比 ${sign}${pct}% ${arrow}</span>`;
    }
  }

  if (members.length === 0) {
    ['kpi-total','kpi-ot','kpi-vacation','kpi-break-avg','kpi-avg','kpi-alert-count'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '--';
    });
    ['kpi-total-mom','kpi-ot-mom','kpi-vacation-mom','kpi-break-mom','kpi-avg-mom','kpi-alert-mom'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '';
    });
    return;
  }

  let totalMin = 0, otMin = 0, vacMin = 0, breakMin = 0, breakDays = 0;
  let lv2Plus = 0;
  members.forEach(m => {
    const st = getMemberStats(m.empId);
    totalMin  += st.totalMin; otMin += st.otMin; vacMin += st.vacMin; breakMin += st.breakMin;
    breakDays += Object.keys(st.dayMap).length;
    const sc = calculateScores(m.empId);
    if (sc.riskLevel >= 2) lv2Plus++;
  });

  const avgBreakMin = breakDays > 0 ? Math.round(breakMin / breakDays) : 0;
  const avgTotalMin = members.length > 0 ? Math.round(totalMin / members.length) : 0;
  const prev = JSON.parse(localStorage.getItem('dash_prev_kpi') || 'null');

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kpi-total',       fmtMin(totalMin));
  set('kpi-ot',          fmtMin(otMin));
  set('kpi-vacation',    fmtMin(vacMin));
  set('kpi-break-avg',   `${avgBreakMin}分`);
  set('kpi-avg',         fmtMin(avgTotalMin));
  set('kpi-alert-count', `${lv2Plus}人`);

  if (prev) {
    setMom('kpi-total-mom',    totalMin,    prev.totalMin,    'pct');
    setMom('kpi-ot-mom',       otMin,       prev.otMin,       'pct');
    setMom('kpi-vacation-mom', vacMin,      prev.vacMin,      'pct');
    setMom('kpi-break-mom',    avgBreakMin, prev.avgBreakMin, 'min');
    setMom('kpi-avg-mom',      avgTotalMin, prev.avgTotalMin, 'pct');
    const alertEl = document.getElementById('kpi-alert-mom');
    if (alertEl) {
      const diff = lv2Plus - prev.lv2Plus;
      const sign = diff >= 0 ? '+' : '';
      const cls  = diff > 0 ? 'mom-up' : diff < 0 ? 'mom-down' : 'mom-flat';
      alertEl.innerHTML = `<span class="${cls}">前月比 ${sign}${diff}人</span>`;
    }
  }

  renderScoreAlertPanel(avgBreakMin, prev ? prev.avgBreakMin : null);
}

// ============================================================
// 業務負荷スコアアラートパネル
// ============================================================
function renderScoreAlertPanel(avgBreakMin, prevBreakMin) {
  const members = getMembers();
  const scores  = members.map(m => ({ ...m, ...calculateScores(m.empId) }));

  const lv4 = scores.filter(s => s.riskLevel >= 4).length;
  const lv3 = scores.filter(s => s.riskLevel === 3).length;
  const lv2 = scores.filter(s => s.riskLevel === 2).length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sa-break-avg', `${avgBreakMin}分`);
  set('sa-lv4-count', lv4);
  set('sa-lv3-count', lv3);
  set('sa-lv2-count', lv2);

  const saMom = document.getElementById('sa-break-mom');
  if (saMom && prevBreakMin != null) {
    const diff = avgBreakMin - prevBreakMin;
    const sign = diff >= 0 ? '+' : '';
    const cls  = diff < 0 ? 'mom-down' : diff > 0 ? 'mom-up' : 'mom-flat';
    const arrow = diff >= 0 ? '▲' : '▼';
    saMom.innerHTML = `<span class="${cls}">前月比 ${sign}${diff}分 ${arrow}</span>`;
  }

  // TOP5（Lv.2以上、スコア降順）
  const saTop5 = document.getElementById('sa-top5-body');
  if (saTop5) {
    const sorted = [...scores]
      .filter(s => s.riskLevel >= 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    saTop5.innerHTML = sorted.length === 0
      ? '<tr><td colspan="4" style="color:var(--text-sub);text-align:center">該当者なし</td></tr>'
      : sorted.map((s, i) => {
          const reason = buildRiskReason(s.empId);
          const col = lvColor(s.riskLevel);
          return `<tr>
            <td style="color:var(--text-sub)">${i+1}</td>
            <td style="font-weight:600">${s.name}</td>
            <td style="color:${col};font-weight:bold">${s.score} <small style="font-size:0.8em">(Lv.${s.riskLevel})</small></td>
            <td style="font-size:0.82rem;color:var(--text-sub)">${reason}</td>
          </tr>`;
        }).join('');
  }
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
  const total  = data.reduce((s,v) => s+v, 0);

  chartInstances['worktype'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#1a1d2e' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position:'right', labels:{ color:'#c0c8e0', font:{size:12}, boxWidth:14, padding:8 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}h (${Math.round(ctx.parsed/total*100)}%)` } }
      }
    }
  });

  // 合計表示
  const el = document.getElementById('worktype-total');
  if (el) el.textContent = `合計：${fmtMin(allRecords.reduce((s,r)=>s+r.normalMin+r.otMin,0))}`;
}

// ============================================================
// 個人別業務時間（横棒グラフ）
// ============================================================
function renderPersonalBarChart() {
  const ctx = document.getElementById('chart-personal').getContext('2d');
  destroyChart('personal');

  const members = getMembers();
  if (members.length === 0) return;

  const s = loadSettings();
  const workTypes = s.workMaster.filter(m => m.importance > 0).map(m => m.name);
  if (workTypes.length === 0) return;

  // 横棒グラフ：人数に応じて高さを動的に設定（1人あたり32px、最低320px）
  const barHeight = Math.max(320, members.length * 32);
  const container = document.querySelector('.chart-body-personal');
  if (container) container.style.minHeight = barHeight + 'px';

  const datasets = workTypes.map(wt => ({
    label: wt,
    data: members.map(m => {
      const recs = allRecords.filter(r => r.empId === m.empId && r.workType === wt);
      return Math.round(recs.reduce((s,r) => s + r.normalMin + r.otMin + r.vacationMin, 0) / 60 * 10) / 10;
    }),
    backgroundColor: getWorkColor(wt),
    borderWidth: 0,
  }));

  // 各メンバーの合計
  const totals = members.map(m => {
    const st = getMemberStats(m.empId);
    return Math.round(st.totalMin / 60 * 10) / 10;
  });

  chartInstances['personal'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: members.map(m => m.name), datasets },
    options: {
      indexAxis: 'y',  // 横棒
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked:true, ticks:{ color:'#c0c8e0', font:{size:12} }, grid:{ color:'#2e3350' },
             title:{ display:true, text:'時間', color:'#8b92b0', font:{size:12} } },
        y: { stacked:true, ticks:{ color:'#e8eaf6', font:{size:13} }, grid:{ color:'#2e3350' } }
      },
      plugins: {
        legend: { position:'bottom', labels:{ color:'#c0c8e0', font:{size:11}, boxWidth:12, padding:8 } },
        tooltip: {
          mode: 'index',
          callbacks: {
            afterBody: (items) => {
              const idx = items[0].dataIndex;
              return [`合計: ${totals[idx]}h`];
            }
          }
        }
      }
    }
  });
}

// ============================================================
// 部門比較テーブル
// ============================================================
function renderDeptCompare() {
  const all     = getDeptStats('');
  const honsha  = getDeptStats('営業部本社');
  const fukuoka = getDeptStats('営業部福岡支社');
  const kyushu  = getDeptStats('営業部九州支社');

  const avg = (s) => s.count > 0 ? fmtMin(Math.round(s.totalMin / s.count)) : '--';
  const rows = [
    ['総業務時間',     fmtMin(all.totalMin),  fmtMin(honsha.totalMin),  fmtMin(fukuoka.totalMin),  fmtMin(kyushu.totalMin)],
    ['1人あたり平均',  avg(all),              avg(honsha),              avg(fukuoka),              avg(kyushu)],
    ['時間外合計',     fmtMin(all.otMin),     fmtMin(honsha.otMin),     fmtMin(fukuoka.otMin),     fmtMin(kyushu.otMin)],
    ['休暇中業務合計', fmtMin(all.vacMin),    fmtMin(honsha.vacMin),    fmtMin(fukuoka.vacMin),    fmtMin(kyushu.vacMin)],
    ['在籍人数',       `${all.count}人`,      `${honsha.count}人`,      `${fukuoka.count}人`,      `${kyushu.count}人`],
  ];

  const tbody = document.getElementById('dept-compare-body');
  tbody.innerHTML = rows.map(r =>
    `<tr>${r.map((c,i) => `<td${i===0?' style="color:var(--text-sub)"':''}>${c}</td>`).join('')}</tr>`
  ).join('');
}

// ============================================================
// ダッシュボードアラートリスト（4種スコアアラート）
// ============================================================
function renderDashboardAlerts() {
  const members = getMembers();
  const el = document.getElementById('dashboard-alert-list');
  if (!el) return;

  const vacAlert   = [];  // 休暇中業務アラート
  const break0Alert = []; // 休憩0分アラート
  const ot90Alert  = [];  // 時間外90分超アラート
  const compAlert  = [];  // 複合条件アラート

  members.forEach(m => {
    const sc = calculateScores(m.empId);
    const bd = sc.breakdown;
    if (bd.vac.days >= 1)                        vacAlert.push(m);
    if (bd.break0.days >= 1)                     break0Alert.push(m);
    if (bd.ot.d90 + bd.ot.d120 >= 1)             ot90Alert.push(m);
    if (bd.comp.cB0Ot + bd.comp.cVacOt + bd.comp.c3Break + bd.comp.c3Ot >= 1) compAlert.push(m);
  });

  const items = [
    { icon:'[休暇]', title:'休暇中業務アラート',  desc:'休暇中に業務が発生',    list:vacAlert,    cls:'alert-vac'   },
    { icon:'[休憩]', title:'休憩0分アラート',      desc:'休憩0分の日がある',     list:break0Alert, cls:'alert-break0'},
    { icon:'[残業]', title:'時間外90分超アラート', desc:'時間外が90分を超過',    list:ot90Alert,   cls:'alert-ot'    },
    { icon:'[複合]', title:'複合条件アラート',     desc:'複数条件が重複',        list:compAlert,   cls:'alert-comp'  },
  ];

  el.innerHTML = items.map(item => `
    <div class="alert-score-item ${item.cls}">
      <div class="alert-score-icon">${item.icon}</div>
      <div class="alert-score-body">
        <div class="alert-score-title">${item.title}</div>
        <div class="alert-score-desc">${item.desc}</div>
      </div>
      <div class="alert-score-count">${item.list.length}人 &gt;</div>
    </div>`).join('');
}

// ============================================================
// 時間外・休暇中業務一覧
// ============================================================
function renderOtList() {
  const el = document.getElementById('ot-list-body');
  if (!el) return;

  const filterEl = document.getElementById('ot-member-filter');
  const filterVal = filterEl ? filterEl.value : 'all';

  // 全メンバーの日別データを収集
  const rows = [];
  allRecords.forEach(r => {
    if (filterVal !== 'all' && r.empId !== filterVal) return;
    if (r.otMin > 0 || r.vacationMin > 0) {
      const st = getMemberStats(r.empId);
      const dayData = st.dayMap[r.date];
      const breakM  = dayData ? dayData.breakMin : 0;
      let memo = r.memo || '';
      if (r.vacationMin > 0) memo = memo || '(休暇中業務)';
      else if (r.otMin >= 90) memo = memo || '時間外90分超';
      if (breakM === 0 && r.otMin > 0) memo = (memo ? memo + '、' : '') + '休憩0分';
      else if (breakM > 0 && breakM <= 35) memo = (memo ? memo + '、' : '') + `休憩${breakM}分以下`;
      rows.push({ name:r.name, date:r.date, dow:r.dow, workType:r.workType,
                  otMin:r.otMin, vacMin:r.vacationMin, memo, empId:r.empId });
    }
  });

  rows.sort((a,b) => b.date.localeCompare(a.date) || b.otMin - a.otMin);
  const display = rows.slice(0, 20);

  el.innerHTML = display.length === 0
    ? '<tr><td colspan="6" style="color:var(--text-sub);text-align:center;padding:16px">該当データなし</td></tr>'
    : display.map(r => `<tr>
        <td style="font-weight:600">${r.name}</td>
        <td style="color:var(--text-sub)">${r.date}(${r.dow})</td>
        <td style="color:var(--text-sub)">${r.workType}</td>
        <td style="color:${r.otMin>=90?'var(--red)':'var(--orange)'}; font-weight:bold">${fmtMin(r.otMin)}</td>
        <td style="color:${r.vacMin>0?'var(--orange)':'var(--text-sub)'}; font-weight:${r.vacMin>0?'bold':'normal'}">${fmtMin(r.vacMin)}</td>
        <td style="color:var(--orange);font-size:0.85rem">${r.memo}</td>
      </tr>`).join('');

  // フィルター更新
  if (filterEl && filterEl.options.length <= 1) {
    const members = getMembers();
    filterEl.innerHTML = '<option value="all">すべてのメンバー</option>'
      + members.map(m => `<option value="${m.empId}">${m.name}</option>`).join('');
  }
}

// ============================================================
// メンバーグリッド
// ============================================================
function renderMemberGrid() {
  const members = getMembers();
  const el = document.getElementById('member-grid');
  if (!el) return;
  if (members.length === 0) {
    el.innerHTML = '<p style="color:var(--text-sub);padding:16px">データがありません</p>';
    return;
  }

  el.innerHTML = members.map(m => {
    const st  = getMemberStats(m.empId);
    const sc  = calculateScores(m.empId);
    const lv  = sc.riskLevel;
    const col = lvColor(lv);
    const lbl = lvLabel(lv);
    const reason = buildRiskReason(m.empId);
    const bd  = sc.breakdown;

    const otColor  = bd.ot.d90 + bd.ot.d120 > 0 ? 'var(--red)' : 'var(--text-main)';
    const vacColor = bd.vac.days > 0 ? 'var(--orange)' : 'var(--text-main)';

    return `<div class="member-card">
      <div class="member-card-header">
        <div class="member-card-avatar">[人]</div>
        <div class="member-card-info">
          <div class="member-card-name">${m.name}</div>
          <div class="member-card-dept">${m.dept} / ${m.role||''}</div>
        </div>
        <div class="member-card-score-block">
          <div class="member-card-score" style="color:${col}">${sc.score}</div>
          <div class="member-card-lv-badge" style="background:${col}22;border:1px solid ${col};color:${col}">
            Lv.${lv} ${lbl}
          </div>
        </div>
      </div>
      <div class="member-card-stats">
        <div class="member-stat-item">
          <div class="member-stat-label">総業務</div>
          <div class="member-stat-value">${fmtMin(st.totalMin)}</div>
        </div>
        <div class="member-stat-item">
          <div class="member-stat-label">時間外</div>
          <div class="member-stat-value" style="color:${otColor}">${fmtMin(st.otMin)}</div>
        </div>
        <div class="member-stat-item">
          <div class="member-stat-label">休暇中業務</div>
          <div class="member-stat-value" style="color:${vacColor}">${fmtMin(st.vacMin)}</div>
        </div>
        <div class="member-stat-item">
          <div class="member-stat-label">休憩</div>
          <div class="member-stat-value">${fmtMin(st.breakMin)}</div>
        </div>
      </div>
      <div class="member-card-breakdown">
        <span class="bd-item" title="休暇中業務スコア">休暇 ${bd.vac.pt}pt</span>
        <span class="bd-item" title="休憩0分スコア">休憩0分 ${bd.break0.pt}pt</span>
        <span class="bd-item" title="時間外スコア">時間外 ${bd.ot.pt}pt</span>
        <span class="bd-item" title="休憩不足スコア">休憩不足 ${bd.breakShort.pt}pt</span>
        <span class="bd-item" title="複合条件スコア">複合 ${bd.comp.pt}pt</span>
      </div>
      <div class="member-card-reason">主な要因：${reason}</div>
    </div>`;
  }).join('');
}

// ============================================================
// 業務負荷スコア算出要因リスト
// ============================================================
function renderScoreFactorList() {
  const el = document.getElementById('score-factor-list');
  if (!el) return;
  const cfg = loadSettings().scoreConfig;
  const factors = [
    { cls:'factor-vac',    label:'休暇中業務発生日数',    weight:`${cfg.vacDayPt}pt/日` },
    { cls:'factor-vac',    label:'休暇中業務時間',        weight:`${cfg.vacHourPt}pt/時間` },
    { cls:'factor-break0',  label:'休憩0分日数',           weight:`${cfg.break0Pt}pt/日` },
    { cls:'factor-ot',     label:'残業60~89分',              weight:`${cfg.ot60Pt}pt/日` },
    { cls:'factor-ot',     label:'残業90~119分',             weight:`${cfg.ot90Pt}pt/日` },
    { cls:'factor-ot',     label:'残業120分以上',              weight:`${cfg.ot120Pt}pt/日` },
    { cls:'factor-ot',     label:'月間時間外20時間以上',  weight:`+${cfg.otMonth20Pt}pt` },
    { cls:'factor-ot',     label:'月間時間外30時間以上',  weight:`+${cfg.otMonth30Pt}pt` },
    { cls:'factor-break',  label:'休憩36~44分',          weight:`${cfg.break36Pt}pt/日` },
    { cls:'factor-break',  label:'休憩21~35分',          weight:`${cfg.break21Pt}pt/日` },
    { cls:'factor-break',  label:'休憩1~20分',           weight:`${cfg.break1Pt}pt/日` },
    { cls:'factor-comp',   label:'休憩35分以下3日連続',   weight:`${cfg.comp3BreakPt}pt/回` },
    { cls:'factor-comp',   label:'残業90分以上3日連続',   weight:`${cfg.comp3OtPt}pt/回` },
    { cls:'factor-comp',   label:'休憩0分+残業90分超同日', weight:`${cfg.compBreak0OtPt}pt/日` },
    { cls:'factor-comp',   label:'休暇中業務+時間外同日', weight:`${cfg.compVacOtPt}pt/日` },
    { cls:'factor-comp',   label:'休憩35分以下+残業90分超同日', weight:`${cfg.compBreakOtPt}pt/日` },
  ];
  el.innerHTML = factors.map(f => `
    <div class="score-factor-item ${f.cls}">
      <span class="score-factor-label">${f.label}</span>
      <span class="score-factor-weight">${f.weight}</span>
    </div>`).join('');
}

// ============================================================
// アラートバッジ
// ============================================================
function updateAlertBadge() {
  const members = getMembers();
  let count = 0;
  members.forEach(m => { if (calculateScores(m.empId).riskLevel >= 3) count++; });
  const badge = document.getElementById('alert-badge');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

// ============================================================
// CSV取込サマリー
// ============================================================
function renderCSVSummary() {
  const el = document.getElementById('csv-data-summary');
  const members = getMembers();
  if (members.length === 0) { el.innerHTML = '<p style="color:var(--text-sub)">取込済みデータはありません</p>'; return; }
  el.innerHTML = members.map(m => {
    const cnt   = allRecords.filter(r => r.empId === m.empId).length;
    const dates = allRecords.filter(r => r.empId === m.empId).map(r => r.date).sort();
    const period = dates.length > 0 ? `${dates[0]} 〜 ${dates[dates.length-1]}` : '';
    return `<div class="csv-member-row">
      <span><strong>${m.name}</strong>（${m.dept} / ${m.role||''}）</span>
      <span style="color:var(--text-sub)">${period}　${cnt}件</span>
    </div>`;
  }).join('');
}

// ============================================================
// 全体サマリータブ
// ============================================================
function renderSummaryTab() {
  const members = getMembers();
  if (members.length === 0) return;

  const scores = members.map(m => ({ ...m, ...calculateScores(m.empId) }));
  const avgScore  = Math.round(scores.reduce((s,v) => s + v.score, 0) / scores.length);
  const alertCount = scores.filter(s => s.riskLevel >= 3).length;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sum-avg-contribution', avgScore);
  set('sum-avg-risk',         avgScore);
  set('sum-alert-count',      alertCount);

  renderSummaryBubbleChart(scores);
  renderRiskLevelPieChart(scores);
  renderSummaryHeatmap();
}

function renderSummaryBubbleChart(scores) {
  const canvas = document.getElementById('chart-summary-bubble');
  if (!canvas) return;
  destroyChart('summary-bubble');
  chartInstances['summary-bubble'] = new Chart(canvas.getContext('2d'), {
    type: 'bubble',
    data: {
      datasets: scores.map(s => ({
        label: s.name,
        data: [{ x: s.score, y: s.riskLevel, r: 10 }],
        backgroundColor: lvColor(s.riskLevel) + 'aa',
        borderColor:     lvColor(s.riskLevel),
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { title:{ display:true, text:'業務負荷スコア', color:'#8b92b0' }, min:0, grid:{ color:'#2e3350' }, ticks:{ color:'#c0c8e0' } },
        y: { title:{ display:true, text:'リスクレベル', color:'#8b92b0' }, min:0, max:5, ticks:{ color:'#c0c8e0', stepSize:1 }, grid:{ color:'#2e3350' } }
      },
      plugins: {
        legend: { display:false },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: スコア${ctx.raw.x} Lv.${ctx.raw.y}` } }
      }
    }
  });
}

function renderRiskLevelPieChart(scores) {
  const canvas = document.getElementById('chart-risk-level-pie');
  if (!canvas) return;
  destroyChart('risk-level-pie');
  const levels = [0, 0, 0, 0, 0];
  scores.forEach(s => { if (s.riskLevel >= 0 && s.riskLevel <= 4) levels[s.riskLevel]++; });
  chartInstances['risk-level-pie'] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Lv.0 通常', 'Lv.1 軽注意', 'Lv.2 注意', 'Lv.3 要確認', 'Lv.4 重点確認'],
      datasets: [{ data: levels, backgroundColor: ['#2ecc71','#4f8ef7','#f1c40f','#e67e22','#e74c3c'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position:'bottom', labels:{ color:'#c0c8e0', font:{size:12} } } }
    }
  });
}

function renderSummaryHeatmap() {
  const el = document.getElementById('summary-heatmap-container');
  if (!el) return;
  const dates = [...new Set(allRecords.map(r => r.date))].sort();
  if (dates.length === 0) { el.innerHTML = '<p style="color:var(--text-sub)">データがありません</p>'; return; }

  const dayScores = {};
  dates.forEach(d => {
    const emps = [...new Set(allRecords.filter(r => r.date === d).map(r => r.empId))];
    let total = 0;
    emps.forEach(empId => {
      const sc = calculateScores(empId);
      total += sc.score;
    });
    dayScores[d] = emps.length > 0 ? total / emps.length : 0;
  });

  const ym = dates[0].substring(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const firstDay = new Date(y, m-1, 1).getDay();
  const lastDate = new Date(y, m, 0).getDate();

  let html = `<table class="heatmap-table"><thead><tr>${['日','月','火','水','木','金','土'].map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody><tr>`;
  for (let i = 0; i < firstDay; i++) html += '<td></td>';
  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${ym}-${String(day).padStart(2,'0')}`;
    const score   = dayScores[dateStr] || 0;
    const ratio   = Math.min(score / 100, 1);
    const bg      = score > 0 ? `rgba(231, 76, 60, ${0.1 + ratio * 0.8})` : 'transparent';
    html += `<td><div class="heatmap-cell" style="background:${bg};color:#e8eaf0" title="${dateStr}: スコア${score.toFixed(0)}">
      <div>${day}</div>
    </div></td>`;
    if (new Date(y, m-1, day).getDay() === 6 && day < lastDate) html += '</tr><tr>';
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
  renderDeptScoreTable();
}

function renderDeptWorktypeChart() {
  const ctx = document.getElementById('chart-dept-worktype').getContext('2d');
  destroyChart('dept-worktype');
  const depts = ['営業部本社', '営業部福岡支社', '営業部九州支社'];
  const s = loadSettings();
  const workTypes = s.workMaster.filter(m => m.importance > 0).map(m => m.name);
  if (workTypes.length === 0) return;

  const datasets = workTypes.map(wt => ({
    label: wt,
    data: depts.map(dept => {
      const recs = allRecords.filter(r => r.dept === dept && r.workType === wt);
      return Math.round(recs.reduce((s,r) => s + r.normalMin + r.otMin + r.vacationMin, 0) / 60 * 10) / 10;
    }),
    backgroundColor: getWorkColor(wt), borderWidth: 0,
  }));
  chartInstances['dept-worktype'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: depts, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked:true, ticks:{ color:'#c0c8e0', font:{size:12} }, grid:{ color:'#2e3350' } },
        y: { stacked:true, ticks:{ color:'#c0c8e0', font:{size:12} }, grid:{ color:'#2e3350' }, title:{ display:true, text:'時間', color:'#8b92b0' } }
      },
      plugins: { legend:{ labels:{ color:'#c0c8e0', font:{size:12}, boxWidth:12 } } }
    }
  });
}

function renderDeptPieChart(dept, canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  destroyChart(canvasId);
  const byType = {};
  allRecords.filter(r => r.dept === dept && r.workType !== '休憩').forEach(r => {
    const min = r.normalMin + r.otMin + r.vacationMin;
    if (min > 0) byType[r.workType] = (byType[r.workType]||0) + min;
  });
  const sorted = Object.entries(byType).sort((a,b)=>b[1]-a[1]);
  chartInstances[canvasId] = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>Math.round(v/60*10)/10), backgroundColor: sorted.map(([k])=>getWorkColor(k)), borderWidth:0 }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'right', labels:{ color:'#c0c8e0', font:{size:11}, boxWidth:10 } } } }
  });
}

function renderDeptOtTrend() {
  const ctx = document.getElementById('chart-dept-ot-trend').getContext('2d');
  destroyChart('dept-ot-trend');
  const dates = [...new Set(allRecords.map(r=>r.date))].sort();
  const depts = ['営業部本社','営業部福岡支社','営業部九州支社'];
  const colors = ['#4f8ef7','#1abc9c','#e67e22'];
  const datasets = depts.map((dept,i) => ({
    label: dept,
    data: dates.map(d => Math.round(allRecords.filter(r=>r.dept===dept&&r.date===d).reduce((s,r)=>s+r.otMin,0)/60*10)/10),
    borderColor: colors[i], backgroundColor: colors[i]+'22', fill:true, tension:0.3, pointRadius:3,
  }));
  chartInstances['dept-ot-trend'] = new Chart(ctx, {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { ticks:{ color:'#c0c8e0', maxTicksLimit:15, font:{size:11} }, grid:{ color:'#2e3350' } },
        y: { ticks:{ color:'#c0c8e0', font:{size:12} }, grid:{ color:'#2e3350' }, title:{ display:true, text:'時間外(h)', color:'#8b92b0' } }
      },
      plugins: { legend:{ labels:{ color:'#c0c8e0', font:{size:12} } } }
    }
  });
}

function renderDeptScoreTable() {
  const el = document.getElementById('dept-score-table-body');
  if (!el) return;
  const depts = ['営業部本社','営業部福岡支社','営業部九州支社'];
  el.innerHTML = depts.map(dept => {
    const members = getMembers().filter(m => m.dept === dept);
    if (members.length === 0) return '';
    const scores = members.map(m => calculateScores(m.empId));
    const avg  = Math.round(scores.reduce((s,v)=>s+v.score,0)/scores.length);
    const maxS = Math.max(...scores.map(s=>s.score));
    const lv3p = scores.filter(s=>s.riskLevel>=3).length;
    const lv2p = scores.filter(s=>s.riskLevel>=2).length;
    const vacM = members.filter(m=>{ const bd=calculateScores(m.empId).breakdown; return bd.vac.days>=1; }).length;
    const b0M  = members.filter(m=>{ const bd=calculateScores(m.empId).breakdown; return bd.break0.days>=1; }).length;
    const ot90M= members.filter(m=>{ const bd=calculateScores(m.empId).breakdown; return bd.ot.d90+bd.ot.d120>=1; }).length;
    return `<tr>
      <td style="font-weight:600">${dept}</td>
      <td>${members.length}人</td>
      <td style="color:${avg>=70?'var(--red)':avg>=40?'var(--orange)':'var(--text-main)'}">${avg}</td>
      <td>${maxS}</td>
      <td style="color:${lv3p>0?'var(--red)':'var(--text-main)'}">${lv3p}人</td>
      <td style="color:${lv2p>0?'var(--orange)':'var(--text-main)'}">${lv2p}人</td>
      <td>${vacM}人</td>
      <td>${b0M}人</td>
      <td>${ot90M}人</td>
    </tr>`;
  }).join('');
}

// ============================================================
// 個人別分析タブ
// ============================================================
// 個人別分析タブ
// ============================================================
function renderPersonalTab() {
  const deptFilter = document.getElementById('personal-dept-filter').value;
  const members = getMembers().filter(m => deptFilter==='all' || m.dept===deptFilter);

  const sel = document.getElementById('personal-member-filter');
  const prev = sel.value;
  sel.innerHTML = '<option value="">-- 選択 --</option>'
    + members.map(m=>`<option value="${m.empId}">${m.name}</option>`).join('');
  if (prev) sel.value = prev;

  renderPersonalCompareChart(members);

  if (sel.value) {
    renderPersonalDetail();
  } else {
    document.getElementById('personal-compare-section').style.display = 'block';
    document.getElementById('personal-detail-section').style.display  = 'none';
  }
}

function renderPersonalCompareChart(members) {
  const ctx = document.getElementById('chart-personal-compare').getContext('2d');
  destroyChart('personal-compare');
  if (!members || members.length === 0) return;

  const barH = Math.max(40, Math.min(60, Math.floor(400 / (members.length || 1))));
  const canvasEl = document.getElementById('chart-personal-compare');
  canvasEl.parentElement.style.height = (members.length * barH + 80) + 'px';

  const wm = loadSettings().workMaster;
  const datasets = wm.map(wt => ({
    label: wt.name,
    data: members.map(m => {
      const s = getMemberStats(m.empId);
      return Math.round((s.byType[wt.name] || 0) / 60 * 10) / 10;
    }),
    backgroundColor: wt.color,
    borderWidth: 0,
  }));
  // 時間外を追加
  datasets.push({
    label: '時間外',
    data: members.map(m => { const s = getMemberStats(m.empId); return Math.round(s.otMin/60*10)/10; }),
    backgroundColor: '#e74c3c',
    borderWidth: 0,
  });

  chartInstances['personal-compare'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: members.map(m=>m.name), datasets },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked:true, ticks:{ color:'#c0c8e0', font:{size:12} }, grid:{ color:'#2e3350' }, title:{ display:true, text:'時間', color:'#8892b0' } },
        y: { stacked:true, ticks:{ color:'#e8eaf6', font:{size:13} }, grid:{ color:'#2e3350' } }
      },
      plugins: { legend:{ labels:{ color:'#c0c8e0', font:{size:11}, boxWidth:12 } } }
    }
  });
}

function renderPersonalDetail() {
  const empId = document.getElementById('personal-member-filter').value;
  if (!empId) {
    document.getElementById('personal-compare-section').style.display = 'block';
    document.getElementById('personal-detail-section').style.display  = 'none';
    return;
  }
  document.getElementById('personal-compare-section').style.display = 'none';
  document.getElementById('personal-detail-section').style.display  = 'block';

  const member = getMembers().find(m=>m.empId===empId);
  if (!member) return;

  const sc  = calculateScores(empId);
  const bd  = sc.breakdown;
  const st  = getMemberStats(empId);
  const cfg = loadSettings().scoreConfig;
  const col = lvColor(sc.riskLevel);
  const recs = allRecords.filter(r=>r.empId===empId);
  const dates = [...new Set(recs.map(r=>r.date))].sort();
  const workDayCount = Math.max(dates.length, 1);

  // ---- 行1: スコアカード + KPI ----
  // スコアカード
  document.getElementById('pc-score-val').textContent  = sc.score;
  document.getElementById('pc-score-val').style.color  = col;
  const lvBadge = document.getElementById('pc-lv-badge');
  lvBadge.textContent = `Lv.${sc.riskLevel} ${lvLabel(sc.riskLevel)}`;
  lvBadge.style.background = col;
  document.getElementById('pc-score-sub').textContent = '前月比 --（データなし）';
  document.getElementById('pc-score-total-label').textContent = `合計 ${sc.score}点`;

  // KPI: 総業務時間/営業日
  const totalH = Math.round(st.totalMin / workDayCount / 60 * 10) / 10;
  document.getElementById('pc-kpi-total').textContent = `${totalH}h`;
  document.getElementById('pc-kpi-total-sub').textContent = '前月比 --';

  // KPI: 時間外/営業日
  const otH = Math.round(st.otMin / workDayCount / 60 * 10) / 10;
  document.getElementById('pc-kpi-ot').textContent = `${otH}h`;
  document.getElementById('pc-kpi-ot-sub').textContent = '前月比 --';

  // KPI: 休暇中業務時間/月
  const vacH = Math.round(st.vacMin / 60 * 10) / 10;
  document.getElementById('pc-kpi-vac').textContent = `${vacH}h`;
  document.getElementById('pc-kpi-vac-sub').textContent = '前月比 --';

  // KPI: 1日平均休憩時間
  const breakAvgMin = Math.round(st.breakMin / workDayCount);
  document.getElementById('pc-kpi-break').textContent = `${breakAvgMin}分`;
  document.getElementById('pc-kpi-break-sub').textContent = '前月比 --';

  // KPI: 休憩中業務時間/月
  const partyH = Math.round(st.partyMin / 60 * 10) / 10;
  document.getElementById('pc-kpi-party').textContent = `${partyH}h`;
  document.getElementById('pc-kpi-party-sub').textContent = '前月比 --';

  // ---- 行2: スコア内訳横棒グラフ ----
  renderPcScoreBar(bd, cfg, sc.score);

  // ---- 行2: 主な負荷要因 ----
  renderPcFactorList(bd, cfg);

  // ---- 行2: 面談用サマリー ----
  renderPcSummary(empId, member, sc, bd, st);

  // ---- 行3: 業務区分別分析 ----
  renderPcWorktypePie(st);
  renderPcWorktypeTable(empId, st);

  // ---- 行3: 日別負荷推移 ----
  renderPcDailyChart(empId, recs, dates);

  // ---- 行4: 異常日一覧 ----
  renderPcAnomalyTable(empId, recs);

  // ---- 行4: 業務区分×貢献度バブルチャート ----
  renderPcBubbleChart(st);

  // ---- 行4: 個人面談アドバイス ----
  renderPcAdvice(empId, sc, bd, st);
}

// ---- スコア内訳横棒グラフ ----
function renderPcScoreBar(bd, cfg, totalScore) {
  const ctx = document.getElementById('chart-pc-score-bar').getContext('2d');
  destroyChart('pc-score-bar');
  const labels = ['休暇中業務', '時間外90分超', '休憩0分率', '休憩35分以下', '複合条件', '月間時間外累計'];
  const data   = [
    bd.vac.pt,
    Math.round(bd.ot.d90 * cfg.ot90Pt + bd.ot.d120 * cfg.ot120Pt),
    bd.break0.pt,
    bd.breakShort.pt,
    bd.comp.pt,
    Math.round(bd.ot.monthMin >= 30*60 ? cfg.otMonth30Pt : bd.ot.monthMin >= 20*60 ? cfg.otMonth20Pt : 0),
  ];
  const colors = ['#e74c3c','#e67e22','#f1c40f','#3498db','#9b59b6','#1abc9c'];
  chartInstances['pc-score-bar'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks:{ color:'#c0c8e0', font:{size:11} }, grid:{ color:'#2e3350' } },
        y: { ticks:{ color:'#e8eaf6', font:{size:12} }, grid:{ color:'#2e3350' } }
      },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw}点` } }
      }
    }
  });
}

// ---- 主な負荷要因リスト ----
function renderPcFactorList(bd, cfg) {
  const ul = document.getElementById('pc-factor-list');
  const items = [];
  const COLORS = { red:'#e74c3c', orange:'#e67e22', yellow:'#f1c40f', blue:'#4f8ef7', purple:'#9b59b6' };

  if (bd.vac.days >= 1) items.push({ color: COLORS.red,    text: `休日対応が${bd.vac.days}日発生` });
  if (bd.ot.d90 >= 1)  items.push({ color: COLORS.orange,  text: `時間外90分超が${bd.ot.d90 + bd.ot.d120}日` });
  if (bd.break0.days >= 1) items.push({ color: COLORS.yellow, text: `休憩0分が${bd.break0.days}日` });
  if (bd.breakShort.d21 + bd.breakShort.d1 >= 1) items.push({ color: COLORS.blue, text: `休憩35分以下が${bd.breakShort.d21 + bd.breakShort.d1}日` });
  if (bd.comp.c3Break >= 1) items.push({ color: COLORS.purple, text: `休憩不足3日連続 ${bd.comp.c3Break}回` });
  if (bd.comp.c3Ot >= 1)    items.push({ color: COLORS.purple, text: `残業90分超3日連続 ${bd.comp.c3Ot}回` });
  if (bd.ot.monthMin >= 30*60) items.push({ color: COLORS.orange, text: '月間時間外が基準値を超過' });
  else if (bd.ot.monthMin >= 20*60) items.push({ color: COLORS.yellow, text: '月間時間外が20時間超' });

  if (items.length === 0) items.push({ color: '#2ecc71', text: '特記事項なし' });

  ul.innerHTML = items.map(it =>
    `<li class="pc-factor-item"><span class="pc-factor-dot" style="background:${it.color}"></span>${it.text}</li>`
  ).join('');
}

// ---- 面談用サマリー ----
function renderPcSummary(empId, member, sc, bd, st) {
  const el = document.getElementById('pc-summary-list');
  const wm = loadSettings().workMaster;
  const sorted = Object.entries(st.byType).sort((a,b)=>b[1]-a[1]);
  const topWork = sorted[0] ? sorted[0][0] : '—';
  const topWorkH = sorted[0] ? Math.round(sorted[0][1]/60*10)/10 : 0;

  const items = [
    { icon:'★', label:'今月の特徴',         text: `${topWork}が最多（${topWorkH}h）。${bd.vac.days>0?'休日対応あり。':''}${bd.ot.d90+bd.ot.d120>0?'時間外90分超が'+( bd.ot.d90+bd.ot.d120)+'日。':''}` },
    { icon:'↑', label:'前月から増えた業務',   text: '前月データがないため比較不可' },
    { icon:'↻', label:'繰り返し発生している問題', text: [
        bd.break0.days >= 2 ? `休憩0分が${bd.break0.days}日` : null,
        bd.comp.c3Ot >= 1   ? `残業90分超3日連続 ${bd.comp.c3Ot}回` : null,
        bd.comp.c3Break >= 1 ? `休憩不足3日連続 ${bd.comp.c3Break}回` : null,
      ].filter(Boolean).join('、') || '特記なし' },
    { icon:'📋', label:'来月の確認事項',      text: [
        bd.vac.days >= 1   ? '休日対応ルールの確認' : null,
        bd.break0.days >= 1 ? '休憩確保の徹底' : null,
        bd.ot.d90 + bd.ot.d120 >= 3 ? '業務量・分担の見直し' : null,
      ].filter(Boolean).join('、') || '特記なし' },
  ];

  el.innerHTML = items.map(it =>
    `<div class="pc-summary-item">
       <span class="pc-summary-icon">${it.icon}</span>
       <div class="pc-summary-body">
         <span class="pc-summary-label">${it.label}</span>
         <span class="pc-summary-text">${it.text}</span>
       </div>
     </div>`
  ).join('');
}

// ---- 業務区分別ドーナツグラフ ----
function renderPcWorktypePie(st) {
  const sorted = Object.entries(st.byType).sort((a,b)=>b[1]-a[1]);
  const totalH = Math.round(st.totalMin/60*10)/10;
  const ctx = document.getElementById('chart-pc-worktype-pie').getContext('2d');
  destroyChart('pc-worktype-pie');
  if (sorted.length === 0) return;

  document.getElementById('pc-worktype-center').innerHTML =
    `<div class="pc-pie-center-label">今月合計</div><div class="pc-pie-center-val">${totalH}h</div>`;

  chartInstances['pc-worktype-pie'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{ data: sorted.map(([,v])=>Math.round(v/60*10)/10), backgroundColor: sorted.map(([k])=>getWorkColor(k)), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}h (${Math.round(ctx.raw/totalH*100)}%)` } }
      }
    }
  });
}

// ---- 業務区分別テーブル ----
function renderPcWorktypeTable(empId, st) {
  const tbody = document.getElementById('pc-worktype-tbody');
  const wm = loadSettings().workMaster;
  const totalMin = st.totalMin || 1;
  const sorted = Object.entries(st.byType).sort((a,b)=>b[1]-a[1]);

  // 部門平均計算
  const member = getMembers().find(m=>m.empId===empId);
  const deptMembers = member ? getMembers().filter(m=>m.dept===member.dept && m.empId!==empId) : [];
  const deptAvgByType = {};
  if (deptMembers.length > 0) {
    deptMembers.forEach(m => {
      const s = getMemberStats(m.empId);
      Object.entries(s.byType).forEach(([k,v]) => { deptAvgByType[k] = (deptAvgByType[k]||0) + v; });
    });
    Object.keys(deptAvgByType).forEach(k => { deptAvgByType[k] = deptAvgByType[k] / deptMembers.length; });
  }

  tbody.innerHTML = sorted.map(([name, min]) => {
    const h = Math.round(min/60*10)/10;
    const pct = Math.round(min/totalMin*100*10)/10;
    const deptAvgH = deptAvgByType[name] ? Math.round(deptAvgByType[name]/60*10)/10 : null;
    const diffH = deptAvgH !== null ? Math.round((h - deptAvgH)*10)/10 : null;
    const diffStr = diffH !== null ? (diffH >= 0 ? `<span class="pc-diff-up">+${diffH}h</span>` : `<span class="pc-diff-dn">${diffH}h</span>`) : '—';
    const color = getWorkColor(name);
    // 負荷要因判定
    const wt = wm.find(w=>w.name===name);
    const importance = wt ? wt.importance : 0;
    let factor = '—';
    if (diffH !== null && diffH > 2) factor = `<span style="color:#e74c3c">負荷高・集中</span>`;
    else if (importance >= 15 && pct >= 30) factor = `<span style="color:#e67e22">主力業務</span>`;
    return `<tr>
      <td><span class="pc-wt-dot" style="background:${color}"></span>${name}</td>
      <td>${h}h</td>
      <td>${pct}%</td>
      <td>—</td>
      <td>${diffStr}</td>
      <td>${factor}</td>
    </tr>`;
  }).join('');
}

// ---- 日別負荷推移グラフ ----
function renderPcDailyChart(empId, recs, dates) {
  const ctx = document.getElementById('chart-pc-daily').getContext('2d');
  destroyChart('pc-daily');
  if (dates.length === 0) return;

  const totalData = dates.map(d => Math.round(recs.filter(r=>r.date===d).reduce((s,r)=>s+r.normalMin+r.otMin,0)/60*10)/10);
  const otData    = dates.map(d => Math.round(recs.filter(r=>r.date===d).reduce((s,r)=>s+r.otMin,0)/60*10)/10);

  // アノテーション点（アイコン代わりにポイント色変更）
  const pointColors = dates.map(d => {
    const dayRecs = recs.filter(r=>r.date===d);
    const dayBreak = dayRecs.reduce((s,r)=>s+r.breakMin,0);
    const dayOt    = dayRecs.reduce((s,r)=>s+r.otMin,0);
    const dayVac   = dayRecs.reduce((s,r)=>s+r.vacationMin,0);
    if (dayVac > 0)    return '#f39c12';
    if (dayBreak === 0) return '#e74c3c';
    if (dayOt >= 90)   return '#e67e22';
    if (dayBreak <= 35) return '#f1c40f';
    return '#4f8ef7';
  });

  const shortDates = dates.map(d => { const [,m,day] = d.split('-'); return `${parseInt(m)}/${parseInt(day)}`; });

  chartInstances['pc-daily'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: shortDates,
      datasets: [
        { type:'bar',  label:'総業務時間(h)', data: totalData, backgroundColor:'rgba(79,142,247,0.6)', yAxisID:'y', order:2 },
        { type:'line', label:'時間外(h)',     data: otData, borderColor:'#e74c3c', backgroundColor:'rgba(231,76,60,0.1)', fill:false, tension:0.3, pointRadius:5, pointBackgroundColor: pointColors, yAxisID:'y2', order:1 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x:  { ticks:{ color:'#c0c8e0', font:{size:10}, maxRotation:45 }, grid:{ color:'#2e3350' } },
        y:  { position:'left',  ticks:{ color:'#c0c8e0', font:{size:11} }, grid:{ color:'#2e3350' }, title:{ display:true, text:'総業務(h)', color:'#8892b0', font:{size:10} } },
        y2: { position:'right', ticks:{ color:'#e74c3c', font:{size:11} }, grid:{ display:false }, title:{ display:true, text:'時間外(h)', color:'#e74c3c', font:{size:10} } },
      },
      plugins: {
        legend: { labels:{ color:'#c0c8e0', font:{size:11}, boxWidth:12 } },
        tooltip: { mode:'index', intersect:false }
      }
    }
  });
}

// ---- 異常日一覧 ----
function renderPcAnomalyTable(empId, recs) {
  const tbody = document.getElementById('pc-anomaly-tbody');
  const dayMap = {};
  recs.forEach(r => {
    if (!dayMap[r.date]) dayMap[r.date] = { totalMin:0, otMin:0, vacMin:0, breakMin:0, workTypes:[], memos:[], dow:r.dow };
    dayMap[r.date].totalMin  += r.normalMin + r.otMin;
    dayMap[r.date].otMin     += r.otMin;
    dayMap[r.date].vacMin    += r.vacationMin;
    dayMap[r.date].breakMin  += r.breakMin;
    if (r.workType && !dayMap[r.date].workTypes.includes(r.workType)) dayMap[r.date].workTypes.push(r.workType);
    if (r.memo) dayMap[r.date].memos.push(r.memo);
  });

  const anomalies = Object.entries(dayMap)
    .filter(([,d]) => d.otMin >= 90 || d.vacMin > 0 || d.breakMin === 0 || d.breakMin <= 35)
    .sort((a,b) => a[0] < b[0] ? 1 : -1)
    .slice(0, 8);

  if (anomalies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#8892b0">異常日なし</td></tr>';
    return;
  }

  const DOW_JA = { Mon:'月', Tue:'火', Wed:'水', Thu:'木', Fri:'金', Sat:'土', Sun:'日' };
  tbody.innerHTML = anomalies.map(([date, d]) => {
    const [,m,day] = date.split('-');
    const dow = DOW_JA[d.dow] || d.dow || '';
    const totalH = Math.round(d.totalMin/60*10)/10;
    const otH    = Math.round(d.otMin/60*10)/10;
    const vacH   = Math.round(d.vacMin/60*10)/10;
    const breakM = d.breakMin;
    const otClass  = d.otMin >= 90 ? 'pc-anomaly-red' : '';
    const vacClass = d.vacMin > 0  ? 'pc-anomaly-orange' : '';
    const brClass  = d.breakMin === 0 ? 'pc-anomaly-red' : d.breakMin <= 35 ? 'pc-anomaly-yellow' : '';
    const memo = d.memos.join(' / ') || '—';
    return `<tr>
      <td>${parseInt(m)}/${parseInt(day)}（${dow}）</td>
      <td>${totalH}h</td>
      <td class="${otClass}">${otH}h</td>
      <td class="${vacClass}">${vacH > 0 ? vacH+'h' : '0h'}</td>
      <td class="${brClass}">${breakM}分</td>
      <td>${d.workTypes.join('/')}</td>
      <td class="pc-anomaly-memo">${memo}</td>
    </tr>`;
  }).join('');
}

// ---- 業務区分×貢献度バブルチャート ----
function renderPcBubbleChart(st) {
  const ctx = document.getElementById('chart-pc-bubble').getContext('2d');
  destroyChart('pc-bubble');
  const wm = loadSettings().workMaster;
  const totalMin = st.totalMin || 1;

  // 表示対象の業務区分を絞り込む
  const activeTypes = wm.filter(wt => st.byType[wt.name] && st.byType[wt.name] > 0);

  // 縦軸最大値：最高重要度 × 1.2（切り上げ）
  const maxImportance = activeTypes.length > 0 ? Math.max(...activeTypes.map(wt => wt.importance)) : 30;
  const yMax = Math.ceil(maxImportance * 1.2);

  const bubbleData = activeTypes.map(wt => {
    const min = st.byType[wt.name] || 0;
    const h   = Math.round(min / 60 * 10) / 10;          // 実業務時間（h）
    const pct = Math.round(min / totalMin * 1000) / 10;  // 構成比（%）
    // バブルサイズ：実業務時間に比例（最小6、最大32）
    const r = Math.max(6, Math.min(32, Math.sqrt(h) * 5));
    return {
      label: wt.name,
      data: [{ x: pct, y: wt.importance, r, _h: h, _pct: pct }],
      backgroundColor: wt.color + 'bb',
      borderColor: wt.color,
      borderWidth: 2,
    };
  });

  // 横軸最大値：最大構成比 × 1.3（余白確保）
  const maxPct = bubbleData.length > 0
    ? Math.max(...bubbleData.map(d => d.data[0].x))
    : 100;
  const xMax = Math.min(100, Math.ceil(maxPct * 1.3 / 10) * 10);

  // バブル上に業務区分名を描画するカスタムプラグイン
  const labelPlugin = {
    id: 'bubbleLabel',
    afterDatasetsDraw(chart) {
      const c = chart.ctx;
      chart.data.datasets.forEach((ds, i) => {
        const meta = chart.getDatasetMeta(i);
        if (!meta.visible) return;
        meta.data.forEach((el, j) => {
          const raw = ds.data[j];
          const r = el.options ? el.options.radius : (raw.r || 8);
          c.save();
          c.font = `bold ${Math.max(9, Math.min(12, r * 0.7))}px sans-serif`;
          c.fillStyle = '#ffffff';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          // 長いラベルは省略
          const label = ds.label.length > 5 ? ds.label.slice(0, 5) + '…' : ds.label;
          c.fillText(label, el.x, el.y);
          c.restore();
        });
      });
    }
  };

  chartInstances['pc-bubble'] = new Chart(ctx, {
    type: 'bubble',
    data: { datasets: bubbleData },
    plugins: [labelPlugin],
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: '業務時間構成比（%）', color: '#8892b0', font: { size: 11 } },
          ticks: { color: '#c0c8e0', font: { size: 10 }, callback: v => v + '%' },
          grid:  { color: '#2e3350' },
          min: 0, max: xMax
        },
        y: {
          title: { display: true, text: '重要度（点）', color: '#8892b0', font: { size: 11 } },
          ticks: { color: '#c0c8e0', font: { size: 10 } },
          grid:  { color: '#2e3350' },
          min: 0, max: yMax
        },
      },
      plugins: {
        legend: { labels: { color: '#c0c8e0', font: { size: 10 }, boxWidth: 10 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const raw = ctx.raw;
              return `${ctx.dataset.label}: 構成比${raw._pct}% / 実時間${raw._h}h / 重要度${raw.y}点`;
            }
          }
        }
      }
    }
  });

  // 4象限ラベルをcanvas上に直接描画
  const chart = chartInstances['pc-bubble'];
  if (chart) {
    const origDraw = chart.draw.bind(chart);
    chart.draw = function() {
      origDraw();
      const c = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const xMid = xScale.getPixelForValue((xScale.max + xScale.min) / 2);
      const yMid = yScale.getPixelForValue((yScale.max + yScale.min) / 2);
      c.save();
      c.font = '10px sans-serif';
      c.fillStyle = 'rgba(200,200,200,0.35)';
      c.fillText('高重要・低比率', xScale.left + 4, yScale.top + 14);
      c.fillText('高重要・高比率', xMid + 4,        yScale.top + 14);
      c.fillText('低重要・低比率', xScale.left + 4, yMid + 14);
      c.fillText('低重要・高比率', xMid + 4,        yMid + 14);
      c.restore();
    };
  }
}

// ---- 個人面談アドバイス ----
function renderPcAdvice(empId, sc, bd, st) {
  const adviceEl = document.getElementById('pc-advice-list');
  const nextEl   = document.getElementById('pc-next-action-items');
  const advices  = [];
  const nextActions = [];

  // アドバイス生成ロジック（新仕様対応）
  const riskLevel = sc.riskLevel;
  
  // リスクレベル別の総括アドバイス
  if (riskLevel === 4) {
    advices.push({ icon:'🚨', color:'#e74c3c', title:'緊急対応が必要です', text:'複数の危険因子が重複しています。直ちに業務の見直しと休息の確保を検討してください。' });
    nextActions.push('経営層への報告・対応方針の決定');
  } else if (riskLevel === 3) {
    advices.push({ icon:'⚠️', color:'#e67e22', title:'早急な改善が必要', text:'業務負荷が高い状態が続いています。業務の分散・優先順位の見直しを進めましょう。' });
    nextActions.push('業務分担の見直し・優先順位の再設定');
  } else if (riskLevel === 2) {
    advices.push({ icon:'📋', color:'#f1c40f', title:'面談で状況確認が必要', text:'複数の負荷要因が検出されています。詳細な状況をお聞かせください。' });
    nextActions.push('本人との面談実施・具体的改善策の検討');
  }
  
  // 具体的な負荷要因別アドバイス
  if (bd.vac.days >= 2) {
    advices.push({ icon:'👥', color:'#e74c3c', title:'休日対応ルールの見直し', text:`休日対応が${bd.vac.days}日発生。対応基準と代替体制を明確化しましょう。` });
    nextActions.push('休日対応ルールをチームで再確認');
  }
  if (bd.ot.d120 >= 2) {
    advices.push({ icon:'📊', color:'#e67e22', title:'長時間残業の改善', text:`120分以上の残業が${bd.ot.d120}日。業務の分担・効率化を見直しましょう。` });
    nextActions.push('月次計画に前倒しタスクを設定');
  }
  if (bd.break0.days >= 2) {
    advices.push({ icon:'☕', color:'#f1c40f', title:'休憩確保の徹底', text:`休憩0分が${bd.break0.days}日。業務過多のサインです。計画的な休憩を確保しましょう。` });
    nextActions.push('休憩0分日の業務内容を確認・改善');
  }
  if (bd.breakShort.d1 >= 2) {
    advices.push({ icon:'⏱️', color:'#3498db', title:'短時間休憩の改善', text:`休憩1~20分の日が${bd.breakShort.d1}日。疲労蓄積のリスクがあります。` });
    nextActions.push('休憩時間の確保・業務スケジュール見直し');
  }

  if (advices.length === 0) {
    advices.push({ icon:'✅', color:'#2ecc71', title:'良好な状態です', text:'今月は特記すべき負荷要因がありません。引き続き現在のペースを維持しましょう。' });
  }
  if (nextActions.length === 0) {
    nextActions.push('現状維持・引き続き状況を観察');
  }

  adviceEl.innerHTML = advices.map(a =>
    `<div class="pc-advice-item" style="border-left:3px solid ${a.color}">
       <div class="pc-advice-title">${a.icon} ${a.title}</div>
       <div class="pc-advice-text">${a.text}</div>
     </div>`
  ).join('');

  nextEl.innerHTML = nextActions.map(a =>
    `<label class="pc-next-item"><input type="checkbox"> ${a}</label>`
  ).join('');
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
  const metric = document.getElementById('heatmap-metric-filter') ? document.getElementById('heatmap-metric-filter').value : 'total';
  const el = document.getElementById('heatmap-container');

  const dates = [...new Set(allRecords.map(r=>r.date))].sort();
  if (dates.length === 0) { el.innerHTML = '<p style="color:var(--text-sub)">データがありません</p>'; return; }

  const dayVals = {};
  dates.forEach(d => {
    const recs = allRecords.filter(r => r.date===d && (dept==='all'||r.dept===dept));
    const emps = [...new Set(recs.map(r=>r.empId))];
    let val = 0;
    if (metric === 'score') {
      emps.forEach(empId => { val += calculateScores(empId).score; });
      val = emps.length > 0 ? val / emps.length : 0;
    } else if (metric === 'ot') {
      val = recs.reduce((s,r)=>s+r.otMin,0);
    } else if (metric === 'vac') {
      val = recs.reduce((s,r)=>s+r.vacationMin,0);
    } else {
      val = recs.reduce((s,r)=>s+r.normalMin+r.otMin,0);
    }
    dayVals[d] = val;
  });

  const maxVal = Math.max(...Object.values(dayVals), 1);
  const ym = dates[0].substring(0,7);
  const [y,m] = ym.split('-').map(Number);
  const firstDay = new Date(y,m-1,1).getDay();
  const lastDate = new Date(y,m,0).getDate();

  let html = `<table class="heatmap-table"><thead><tr>${['日','月','火','水','木','金','土'].map(d=>`<th>${d}</th>`).join('')}</tr></thead><tbody><tr>`;
  for (let i=0; i<firstDay; i++) html += '<td></td>';
  for (let day=1; day<=lastDate; day++) {
    const dateStr = `${ym}-${String(day).padStart(2,'0')}`;
    const dow = new Date(y,m-1,day).getDay();
    const val = dayVals[dateStr] || 0;
    const ratio = val / maxVal;
    const bg = val > 0 ? `rgba(231, 76, 60, ${0.1 + ratio * 0.8})` : 'transparent';
    const label = metric === 'score' ? val.toFixed(0) : `${Math.round(val/60*10)/10}h`;
    html += `<td><div class="heatmap-cell" style="background:${bg};color:#e8eaf0" title="${dateStr}: ${label}">
      <div>${day}</div>${val>0?`<div style="font-size:0.68rem">${label}</div>`:''}
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
        { label:'通常業務(h)', data: dates.map(d=>Math.round(allRecords.filter(r=>r.date===d).reduce((s,r)=>s+r.normalMin,0)/60*10)/10), backgroundColor:'rgba(79,142,247,0.7)', borderWidth:0 },
        { label:'時間外(h)',   data: dates.map(d=>Math.round(allRecords.filter(r=>r.date===d).reduce((s,r)=>s+r.otMin,0)/60*10)/10), backgroundColor:'rgba(231,76,60,0.7)', borderWidth:0 },
        { label:'休暇中業務(h)',data: dates.map(d=>Math.round(allRecords.filter(r=>r.date===d).reduce((s,r)=>s+r.vacationMin,0)/60*10)/10), backgroundColor:'rgba(243,156,18,0.7)', borderWidth:0 },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      scales: {
        x: { stacked:true, ticks:{ color:'#c0c8e0', maxTicksLimit:15, font:{size:11} }, grid:{ color:'#2e3350' } },
        y: { stacked:true, ticks:{ color:'#c0c8e0', font:{size:12} }, grid:{ color:'#2e3350' } }
      },
      plugins: { legend:{ labels:{ color:'#c0c8e0', font:{size:12} } } }
    }
  });
}

// ============================================================
// アラートタブ
// ============================================================
function renderAlertTab() {
  const members = getMembers();
  const summaryEl = document.getElementById('alert-summary-grid');
  const detailEl  = document.getElementById('alert-detail-list');

  const groups = {
    vac:    { title:'休暇中業務アラート',  desc:'休暇中に業務が発生', members:[] },
    break0: { title:'休憩0分アラート',     desc:'休憩0分の日がある',  members:[] },
    ot90:   { title:'時間外90分超アラート',desc:'時間外が90分を超過', members:[] },
    comp:   { title:'複合条件アラート',    desc:'複数条件が重複',     members:[] },
    lv3:    { title:'Lv.3以上（要確認）',  desc:'業務負荷スコアLv.3以上', members:[] },
    lv4:    { title:'Lv.4（重点確認）',    desc:'業務負荷スコアLv.4', members:[] },
  };

  members.forEach(m => {
    const sc = calculateScores(m.empId);
    const bd = sc.breakdown;
    if (bd.vac.days >= 1)                                               groups.vac.members.push(m);
    if (bd.break0.days >= 1)                                            groups.break0.members.push(m);
    if (bd.ot.d90 + bd.ot.d120 >= 1)                                   groups.ot90.members.push(m);
    if (bd.comp.cB0Ot + bd.comp.cVacOt + bd.comp.c3Break + bd.comp.c3Ot >= 1) groups.comp.members.push(m);
    if (sc.riskLevel >= 3)                                              groups.lv3.members.push(m);
    if (sc.riskLevel >= 4)                                              groups.lv4.members.push(m);
  });

  if (summaryEl) {
    summaryEl.innerHTML = Object.values(groups).map(g => `
      <div class="alert-summary-card">
        <div class="alert-summary-title">${g.title}</div>
        <div class="alert-summary-count" style="color:${g.members.length>0?'var(--red)':'var(--green)'}">${g.members.length}人</div>
        <div class="alert-summary-desc">${g.desc}</div>
      </div>`).join('');
  }

  if (detailEl) {
    const items = members
      .map(m => ({ m, sc: calculateScores(m.empId), reason: buildRiskReason(m.empId) }))
      .filter(x => x.sc.riskLevel >= 2)
      .sort((a,b) => b.sc.score - a.sc.score);

    detailEl.innerHTML = items.length === 0
      ? '<p style="color:var(--text-sub);padding:16px">Lv.2以上の対象者はいません</p>'
      : items.map(x => `
        <div class="alert-detail-item">
          <span class="alert-detail-name">${x.m.name}</span>
          <span class="alert-detail-type">${x.m.dept}</span>
          <span class="alert-detail-lv" style="color:${lvColor(x.sc.riskLevel)};font-weight:bold">Lv.${x.sc.riskLevel} ${lvLabel(x.sc.riskLevel)}</span>
          <span class="alert-detail-score" style="color:${lvColor(x.sc.riskLevel)}">${x.sc.score}pt</span>
          <span class="alert-detail-reason">${x.reason}</span>
        </div>`).join('');
  }
}

// ============================================================
// 設定画面
// ============================================================
function loadSettingsForm() {
  const s = loadSettings();

  // 業務区分マスター
  renderWorkTypeMasterTable(s.workMaster);

  // スコア配点
  const sc = s.scoreConfig;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal('sc-vac-day',       sc.vacDayPt);
  setVal('sc-vac-hour',      sc.vacHourPt);
  setVal('sc-break0',        sc.break0Pt);
  setVal('sc-ot60',          sc.ot60Pt);
  setVal('sc-ot90',          sc.ot90Pt);
  setVal('sc-ot120',         sc.ot120Pt);
  setVal('sc-ot-month20',    sc.otMonth20Pt);
  setVal('sc-ot-month30',    sc.otMonth30Pt);
  setVal('sc-break36',       sc.break36Pt);
  setVal('sc-break21',       sc.break21Pt);
  setVal('sc-break1',        sc.break1Pt);
  setVal('sc-comp-3break',   sc.comp3BreakPt);
  setVal('sc-comp-3ot',      sc.comp3OtPt);
  setVal('sc-comp-b0ot',     sc.compBreak0OtPt);
  setVal('sc-comp-vacot',    sc.compVacOtPt);
  setVal('sc-comp-brot',     sc.compBreakOtPt);

  // アラートレベル閾値
  const lvc = s.levelConfig;
  setVal('lv-0-max', lvc.lv0Max);
  setVal('lv-1-max', lvc.lv1Max);
  setVal('lv-2-max', lvc.lv2Max);
  setVal('lv-3-max', lvc.lv3Max);
  // 強制アラート
  const fc = s.forceConfig;
  setVal('fc-vac-day1',      fc.vacDay1Lv);
  setVal('fc-vac-day2',      fc.vacDay2Lv);
  setVal('fc-vac-hour3',     fc.vacHour3Lv);
  setVal('fc-break0-day1',   fc.break0Day1Lv);
  setVal('fc-break0-day3',   fc.break0Day3Lv);
  setVal('fc-break0-day5',   fc.break0Day5Lv);
  setVal('fc-ot90-day5',     fc.ot90Day5Lv);
  setVal('fc-ot120-day3',    fc.ot120Day3Lv);
  setVal('fc-break35-day5',  fc.break35Day5Lv);
  setVal('fc-break35-day10', fc.break35Day10Lv);
  setVal('fc-comp-b0ot90',   fc.compBreak0Ot90Lv);
  setVal('fc-comp-vacot',    fc.compVacOtLv);
}

function saveScoreConfig() {
  const s = loadSettings();
  const getNum = id => parseFloat(document.getElementById(id)?.value) || 0;
  s.scoreConfig = {
    vacDayPt:       getNum('sc-vac-day'),
    vacHourPt:      getNum('sc-vac-hour'),
    break0Pt:       getNum('sc-break0'),
    ot60Pt:         getNum('sc-ot60'),
    ot90Pt:         getNum('sc-ot90'),
    ot120Pt:        getNum('sc-ot120'),
    otMonth20Pt:    getNum('sc-ot-month20'),
    otMonth30Pt:    getNum('sc-ot-month30'),
    break36Pt:      getNum('sc-break36'),
    break21Pt:      getNum('sc-break21'),
    break1Pt:       getNum('sc-break1'),
    comp3BreakPt:   getNum('sc-comp-3break'),
    comp3OtPt:      getNum('sc-comp-3ot'),
    compBreak0OtPt: getNum('sc-comp-b0ot'),
    compVacOtPt:    getNum('sc-comp-vacot'),
    compBreakOtPt:  getNum('sc-comp-brot'),
  };
  saveSettingsObj(s);
  showToast('スコア配点を保存しました');
  renderAll();
}

function saveLevelConfig() {
  const s = loadSettings();
  const getNum = id => parseInt(document.getElementById(id)?.value) || 0;
  s.levelConfig = {
    lv0Max: getNum('lv-0-max'),
    lv1Max: getNum('lv-1-max'),
    lv2Max: getNum('lv-2-max'),
    lv3Max: getNum('lv-3-max'),
  };
  // 強制アラート条件を追加読み込み（旧データとの互換性維持）
  s.forceConfig = Object.assign({}, DEFAULT_FORCE_CONFIG, s.forceConfig || {});
  saveSettingsObj(s);
  showToast('アラートレベル閾値を保存しました');
  renderAll();
}

function saveForceConfig() {
  const s = loadSettings();
  const getNum = id => parseInt(document.getElementById(id)?.value) || 0;
  s.forceConfig = {
    vacDay1Lv:        getNum('fc-vac-day1'),
    vacDay2Lv:        getNum('fc-vac-day2'),
    vacHour3Lv:       getNum('fc-vac-hour3'),
    break0Day1Lv:     getNum('fc-break0-day1'),
    break0Day3Lv:     getNum('fc-break0-day3'),
    break0Day5Lv:     getNum('fc-break0-day5'),
    ot90Day5Lv:       getNum('fc-ot90-day5'),
    ot120Day3Lv:      getNum('fc-ot120-day3'),
    break35Day5Lv:    getNum('fc-break35-day5'),
    break35Day10Lv:   getNum('fc-break35-day10'),
    compBreak0Ot90Lv: getNum('fc-comp-b0ot90'),
    compVacOtLv:      getNum('fc-comp-vacot'),
  };
  saveSettingsObj(s);
  showToast('強制アラート条件を保存しました');
  renderAll();
}

function resetScoreConfig() {
  if (!confirm('スコア配点をデフォルト値にリセットしますか？')) return;
  const s = loadSettings();
  s.scoreConfig = { ...DEFAULT_SCORE_CONFIG };
  saveSettingsObj(s);
  loadSettingsForm();
  renderAll();
  showToast('スコア配点をリセットしました');
}

function resetLevelConfig() {
  if (!confirm('アラートレベル閾値をデフォルト値にリセットしますか？')) return;
  const s = loadSettings();
  s.levelConfig = { ...DEFAULT_LEVEL_CONFIG };
  saveSettingsObj(s);
  loadSettingsForm();
  renderAll();
  showToast('アラートレベル閾値をリセットしました');
}

function resetForceConfig() {
  if (!confirm('強制アラート条件をデフォルト値にリセットしますか？')) return;
  const s = loadSettings();
  s.forceConfig = { ...DEFAULT_FORCE_CONFIG };
  saveSettingsObj(s);
  loadSettingsForm();
  renderAll();
  showToast('強制アラート条件をリセットしました');
}

// 業務区分マスター
function renderWorkTypeMasterTable(master) {
  const body = document.getElementById('worktype-master-body');
  if (!body) return;
  body.innerHTML = master.map((m) => `
    <tr>
      <td><input type="text" class="wm-name" value="${m.name}"></td>
      <td><input type="number" class="wm-importance" value="${m.importance}" min="0" max="100" oninput="updateWorkTypeTotal()"></td>
      <td><input type="color" class="wm-color" value="${m.color}"></td>
      <td><button class="btn-delete-row" onclick="deleteWorkTypeRow(this)">削除</button></td>
    </tr>`).join('');
  updateWorkTypeTotal();
}

function addWorkTypeRow() {
  const body = document.getElementById('worktype-master-body');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="wm-name" value="新業務"></td>
    <td><input type="number" class="wm-importance" value="0" min="0" max="100" oninput="updateWorkTypeTotal()"></td>
    <td><input type="color" class="wm-color" value="#666666"></td>
    <td><button class="btn-delete-row" onclick="deleteWorkTypeRow(this)">削除</button></td>`;
  body.appendChild(tr);
  updateWorkTypeTotal();
}

function deleteWorkTypeRow(btn) { btn.closest('tr').remove(); updateWorkTypeTotal(); }

function updateWorkTypeTotal() {
  const total = Array.from(document.querySelectorAll('.wm-importance')).reduce((s,el)=>s+(parseInt(el.value)||0),0);
  const el  = document.getElementById('worktype-total-importance');
  const msg = document.getElementById('worktype-total-msg');
  if (el) { el.textContent = total; el.style.color = total===100 ? 'var(--green)' : 'var(--red)'; }
  if (msg) { msg.textContent = total===100 ? '合計100%です' : `合計を100にしてください（現在:${total}）`; msg.style.color = total===100 ? 'var(--green)' : 'var(--red)'; }
}

function saveWorkTypeMaster() {
  const rows = Array.from(document.querySelectorAll('#worktype-master-body tr'));
  const master = rows.map(row => ({
    name:       row.querySelector('.wm-name').value.trim(),
    importance: parseInt(row.querySelector('.wm-importance').value) || 0,
    color:      row.querySelector('.wm-color').value
  })).filter(m => m.name);
  const total = master.reduce((s,m) => s+m.importance, 0);
  if (total !== 100 && !confirm(`重要度の合計が${total}です。100でなくても保存しますか？`)) return;
  const s = loadSettings();
  s.workMaster = master;
  saveSettingsObj(s);
  showToast('業務区分マスターを保存しました');
  renderAll();
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
  document.getElementById('login-password').focus();
  if (document.getElementById('main-screen').style.display !== 'none') {
    loadSettingsForm();
    loadStoredData();
    renderAll();
  }
});
