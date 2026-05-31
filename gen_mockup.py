#!/usr/bin/env python3
"""ダッシュボード v3.1 改修後レイアウトモックアップ生成"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.gridspec as gridspec
import numpy as np

# ============================================================
# カラーパレット（ダークテーマ）
# ============================================================
BG_MAIN   = '#0f1117'
BG_CARD   = '#1a1d2e'
BG_CARD2  = '#1e2235'
BORDER    = '#2e3350'
TEXT_MAIN = '#e8eaf6'
TEXT_SUB  = '#8892b0'
ACCENT    = '#4f8ef7'
RED       = '#e74c3c'
ORANGE    = '#e67e22'
YELLOW    = '#f1c40f'
GREEN     = '#2ecc71'
TEAL      = '#1abc9c'

# 業務区分カラー
WORK_COLORS = ['#4f8ef7','#e74c3c','#2ecc71','#f1c40f','#9b59b6','#1abc9c','#e67e22','#e91e63']

fig = plt.figure(figsize=(22, 14), facecolor=BG_MAIN)
fig.subplots_adjust(left=0.065, right=0.99, top=0.96, bottom=0.02, hspace=0.35, wspace=0.25)

# ============================================================
# ヘルパー関数
# ============================================================
def card(ax, title=None, title_color=TEXT_MAIN, title_size=8):
    ax.set_facecolor(BG_CARD)
    for spine in ax.spines.values():
        spine.set_edgecolor(BORDER)
        spine.set_linewidth(0.8)
    ax.tick_params(colors=TEXT_SUB, labelsize=6.5)
    if title:
        ax.set_title(title, color=title_color, fontsize=title_size, fontweight='bold',
                     loc='left', pad=6)

def blank_card(ax, title=None, title_color=TEXT_MAIN):
    ax.set_facecolor(BG_CARD)
    for spine in ax.spines.values():
        spine.set_edgecolor(BORDER)
        spine.set_linewidth(0.8)
    ax.set_xticks([]); ax.set_yticks([])
    if title:
        ax.text(0.02, 0.93, title, transform=ax.transAxes,
                color=title_color, fontsize=8, fontweight='bold', va='top')

# ============================================================
# タイトルバー
# ============================================================
fig.text(0.075, 0.975, 'ダッシュボード', color=TEXT_MAIN, fontsize=13, fontweight='bold',
         fontfamily='sans-serif')
fig.text(0.075, 0.960, '2026年05月 データ', color=TEXT_SUB, fontsize=7.5)
fig.text(0.92, 0.975, '管理者', color=TEXT_MAIN, fontsize=8.5, fontweight='bold', ha='right')
fig.text(0.92, 0.962, 'システム管理者', color=TEXT_SUB, fontsize=7, ha='right')
fig.text(0.72, 0.975, '最終更新: 2026/05/31 09:51', color=TEXT_SUB, fontsize=7, ha='right')

# ============================================================
# サイドバー（左端）
# ============================================================
sidebar_ax = fig.add_axes([0.0, 0.0, 0.062, 1.0])
sidebar_ax.set_facecolor('#0d1020')
sidebar_ax.set_xticks([]); sidebar_ax.set_yticks([])
for spine in sidebar_ax.spines.values():
    spine.set_visible(False)

# ロゴ
sidebar_ax.text(0.5, 0.97, '📊', transform=sidebar_ax.transAxes,
                fontsize=14, ha='center', va='top')
sidebar_ax.text(0.5, 0.93, '業務\n管理', transform=sidebar_ax.transAxes,
                color=TEXT_MAIN, fontsize=6.5, ha='center', va='top', linespacing=1.3)

nav_items = [
    ('🏠', 'ダッシュ\nボード', ACCENT, True),
    ('📊', '部門別\n分析', TEXT_SUB, False),
    ('👤', '個人別\n分析', TEXT_SUB, False),
    ('📅', '日別\n分析', TEXT_SUB, False),
    ('⚠️', 'アラート', TEXT_SUB, False),
    ('📁', 'CSV取込', TEXT_SUB, False),
    ('⚙️', '設定', TEXT_SUB, False),
]
y_start = 0.83
for icon, label, color, active in nav_items:
    if active:
        rect = mpatches.FancyBboxPatch((0.05, y_start - 0.035), 0.9, 0.065,
                                        boxstyle="round,pad=0.01",
                                        facecolor=ACCENT+'33', edgecolor=ACCENT,
                                        linewidth=0.8, transform=sidebar_ax.transAxes)
        sidebar_ax.add_patch(rect)
    sidebar_ax.text(0.5, y_start + 0.015, icon, transform=sidebar_ax.transAxes,
                    fontsize=11, ha='center', va='center')
    sidebar_ax.text(0.5, y_start - 0.018, label, transform=sidebar_ax.transAxes,
                    color=color, fontsize=5.5, ha='center', va='top', linespacing=1.2)
    y_start -= 0.095

sidebar_ax.text(0.5, 0.04, '🚪', transform=sidebar_ax.transAxes,
                fontsize=11, ha='center', va='bottom')
sidebar_ax.text(0.5, 0.02, 'ログアウト', transform=sidebar_ax.transAxes,
                color=TEXT_SUB, fontsize=5.5, ha='center', va='bottom')

# ============================================================
# GridSpec: コンテンツエリア
# ============================================================
gs = gridspec.GridSpec(
    4, 1,
    left=0.075, right=0.99,
    top=0.945, bottom=0.02,
    hspace=0.38,
    height_ratios=[0.9, 3.2, 2.8, 2.8]
)

# ============================================================
# 行1: KPIカード × 6
# ============================================================
gs_kpi = gridspec.GridSpecFromSubplotSpec(1, 6, subplot_spec=gs[0], wspace=0.18)

kpi_data = [
    ('🕐', 'blue',   '総業務時間',     '185時間59分', '前月比 -2.3%', GREEN),
    ('⏰', 'orange', '時間外合計',     '37時間25分',  '前月比 +8.7%', RED),
    ('🏖️', 'teal',  '休暇中業務',     '22時間14分',  '前月比 +25.6%', RED),
    ('☕', 'yellow', '1日平均休憩時間', '43分',        '前月比 -6分', GREEN),
    ('👥', 'green',  '1人あたり平均',  '46時間30分',  '前月比 +1.2%', RED),
    ('❗', 'red',    '重点確認人数',   '6人',         '前月比 +2人', RED),
]

icon_colors = {'blue': ACCENT, 'orange': ORANGE, 'teal': TEAL,
               'yellow': YELLOW, 'green': GREEN, 'red': RED}

for i, (icon, color_key, label, value, mom, mom_color) in enumerate(kpi_data):
    ax = fig.add_subplot(gs_kpi[i])
    blank_card(ax)
    c = icon_colors[color_key]
    # アイコン背景
    circle = plt.Circle((0.13, 0.55), 0.22, color=c+'33', transform=ax.transAxes, zorder=2)
    ax.add_patch(circle)
    ax.text(0.13, 0.55, icon, transform=ax.transAxes, fontsize=14,
            ha='center', va='center', zorder=3)
    ax.text(0.42, 0.88, label, transform=ax.transAxes, color=TEXT_SUB,
            fontsize=6.5, va='top')
    ax.text(0.42, 0.60, value, transform=ax.transAxes, color=TEXT_MAIN,
            fontsize=9.5, fontweight='bold', va='center')
    arrow = '▲' if mom_color == RED else '▼'
    ax.text(0.42, 0.28, f'{arrow} {mom}', transform=ax.transAxes,
            color=mom_color, fontsize=6.5, va='center')

# ============================================================
# 行2: 業務区分円グラフ | 個人別棒グラフ（横棒・幅広） | スコアアラートパネル
# ============================================================
gs_row2 = gridspec.GridSpecFromSubplotSpec(1, 3, subplot_spec=gs[1],
                                            wspace=0.22, width_ratios=[1.1, 2.5, 1.4])

# --- 2-1: 業務区分別比率（円グラフ）
ax_pie = fig.add_subplot(gs_row2[0])
card(ax_pie, '業務区分別比率')
work_labels = ['社内対応', '直送商', '外販製品\n(非電力)', '他電力等・点', '在庫商', '九電尋・点', 'TKD', '九電管路']
work_values = [48.5, 18.2, 12.6, 8.4, 6.1, 3.5, 1.3, 1.4]
wedges, texts, autotexts = ax_pie.pie(
    work_values, colors=WORK_COLORS, startangle=90,
    autopct='%1.1f%%', pctdistance=0.75,
    wedgeprops=dict(width=0.55, edgecolor=BG_MAIN, linewidth=1.5)
)
for t in autotexts:
    t.set_fontsize(5.5)
    t.set_color(TEXT_MAIN)
ax_pie.set_aspect('equal')
# 凡例
legend_patches = [mpatches.Patch(color=WORK_COLORS[i], label=work_labels[i].replace('\n',' ') + f' {work_values[i]}%')
                  for i in range(len(work_labels))]
ax_pie.legend(handles=legend_patches, loc='lower center', bbox_to_anchor=(0.5, -0.28),
              ncol=2, fontsize=5.5, frameon=False,
              labelcolor=TEXT_SUB, handlelength=1.0, handleheight=0.8)
ax_pie.text(0, 0, '合計\n185時間', ha='center', va='center', color=TEXT_MAIN,
            fontsize=6, fontweight='bold')

# --- 2-2: 個人別業務時間（横棒グラフ・10名）
ax_bar = fig.add_subplot(gs_row2[1])
card(ax_bar, '個人別業務時間（時間）  ※横棒グラフで10名でも見やすく表示')

members = ['佐藤 拓郎', '大川 真有美', '村上 光敏', '川内 栄子', '山田 太郎',
           '田中 恵子', '鈴木 一郎', '中村 美咲', '高橋 健二', '伊藤 由美']
# 各業務区分の時間（積み上げ）
np.random.seed(42)
data = {
    '社内対応':      [45, 52, 38, 41, 35, 48, 42, 39, 44, 37],
    '直送商':        [18, 22, 15, 19, 12, 20, 16, 14, 17, 13],
    '外販製品(非電力)':[12, 8,  14, 10, 16, 9,  13, 11, 8,  15],
    '他電力等・点':  [8,  6,  9,  7,  10, 5,  8,  6,  7,  9],
    '在庫商':        [5,  7,  4,  6,  3,  8,  5,  4,  6,  3],
    'その他':        [4,  3,  5,  4,  6,  3,  4,  5,  3,  4],
}

y_pos = np.arange(len(members))
left = np.zeros(len(members))
for j, (wtype, vals) in enumerate(data.items()):
    bars = ax_bar.barh(y_pos, vals, left=left, color=WORK_COLORS[j % len(WORK_COLORS)],
                       height=0.62, label=wtype)
    left += np.array(vals)

ax_bar.set_yticks(y_pos)
ax_bar.set_yticklabels(members, fontsize=7.5, color=TEXT_MAIN)
ax_bar.set_xlabel('時間', color=TEXT_SUB, fontsize=7)
ax_bar.xaxis.label.set_color(TEXT_SUB)
ax_bar.tick_params(axis='x', colors=TEXT_SUB, labelsize=6.5)
ax_bar.tick_params(axis='y', colors=TEXT_MAIN, labelsize=7.5)
ax_bar.set_facecolor(BG_CARD)
for spine in ax_bar.spines.values():
    spine.set_edgecolor(BORDER)
ax_bar.grid(axis='x', color=BORDER, linewidth=0.5, alpha=0.5)
ax_bar.set_xlim(0, 120)
# 凡例
ax_bar.legend(list(data.keys()), loc='lower right', fontsize=5.5,
              frameon=False, labelcolor=TEXT_SUB, ncol=3,
              bbox_to_anchor=(1.0, -0.22))

# --- 2-3: 業務負荷スコアアラートパネル
ax_score = fig.add_subplot(gs_row2[2])
blank_card(ax_score, '業務負荷スコアアラート ℹ')

# 1日平均休憩時間
ax_score.text(0.05, 0.90, '1日平均休憩時間', transform=ax_score.transAxes,
              color=TEXT_SUB, fontsize=6.5, va='top')
ax_score.text(0.05, 0.80, '43分', transform=ax_score.transAxes,
              color=TEXT_MAIN, fontsize=14, fontweight='bold', va='top')
ax_score.text(0.05, 0.70, '▼ 前月比 -6分', transform=ax_score.transAxes,
              color=GREEN, fontsize=6.5, va='top')

# Lv.4/3/2 カード
lv_data = [('Lv.4', '重点確認', '6人', RED),
           ('Lv.3', '要確認',   '5人', ORANGE),
           ('Lv.2', '注意',     '7人', YELLOW)]
x_starts = [0.03, 0.36, 0.68]
for (lv, sublabel, count, color), xs in zip(lv_data, x_starts):
    rect = FancyBboxPatch((xs, 0.50), 0.28, 0.16,
                          boxstyle="round,pad=0.01",
                          facecolor=color+'22', edgecolor=color,
                          linewidth=0.8, transform=ax_score.transAxes)
    ax_score.add_patch(rect)
    ax_score.text(xs + 0.14, 0.67, lv, transform=ax_score.transAxes,
                  color=color, fontsize=6.5, fontweight='bold', ha='center', va='top')
    ax_score.text(xs + 0.14, 0.61, sublabel, transform=ax_score.transAxes,
                  color=TEXT_SUB, fontsize=5.5, ha='center', va='top')
    ax_score.text(xs + 0.14, 0.53, count, transform=ax_score.transAxes,
                  color=color, fontsize=11, fontweight='bold', ha='center', va='top')

# TOP5テーブル
ax_score.text(0.05, 0.48, 'ハイリスクメンバー TOP5', transform=ax_score.transAxes,
              color=TEXT_SUB, fontsize=6.5, fontweight='bold', va='top')
ax_score.axhline(y=0.46, xmin=0.03, xmax=0.97, color=BORDER, linewidth=0.6)

top5 = [
    ('1', '大川 真有美', '92 (Lv.4)', '休暇中業務あり'),
    ('2', '佐藤 拓郎',   '88 (Lv.4)', '休憩0分 3日'),
    ('3', '村上 光敏',   '71 (Lv.3)', '時間外90分超 3日'),
    ('4', '川内 栄子',   '58 (Lv.3)', '休憩0分 2日'),
    ('5', '山田 太郎',   '42 (Lv.2)', '時間外90分超 1日'),
]
y_t = 0.43
for rank, name, score, reason in top5:
    score_color = RED if 'Lv.4' in score else ORANGE if 'Lv.3' in score else YELLOW
    ax_score.text(0.03, y_t, rank, transform=ax_score.transAxes,
                  color=TEXT_SUB, fontsize=5.5, va='top')
    ax_score.text(0.12, y_t, name, transform=ax_score.transAxes,
                  color=TEXT_MAIN, fontsize=5.5, va='top')
    ax_score.text(0.55, y_t, score, transform=ax_score.transAxes,
                  color=score_color, fontsize=5.5, fontweight='bold', va='top')
    ax_score.text(0.03, y_t - 0.05, reason, transform=ax_score.transAxes,
                  color=TEXT_SUB, fontsize=5, va='top')
    y_t -= 0.10

# ============================================================
# 行3: 部門比較 | スコアアラート一覧 | 時間外・休暇中業務一覧
# ============================================================
gs_row3 = gridspec.GridSpecFromSubplotSpec(1, 3, subplot_spec=gs[2],
                                            wspace=0.22, width_ratios=[1.3, 1.1, 2.1])

# --- 3-1: 部門比較テーブル
ax_dept = fig.add_subplot(gs_row3[0])
blank_card(ax_dept, '部門比較（今月累計）')

col_labels = ['項目', '営業部全体', '本社', '福岡支社', '九州支社']
rows = [
    ['総務時間',       '185時間59分', '184時間56分', '96時間12分', '89時間47分'],
    ['1人あたり平均',  '61時間39分',  '61時間38分',  '48時間06分', '44時間14分'],
    ['時間外合計',     '37時間25分',  '36時間22分',  '18時間13分', '19時間12分'],
    ['休憩中業務合計', '14時間15分',  '13時間48分',  '7時間02分',  '7時間13分'],
    ['休暇中業務合計', '22時間14分',  '21時間36分',  '11時間12分', '10時間45分'],
    ['在籍人数',       '10人',        '3人',         '2人',        '2人'],
]

# ヘッダー
header_y = 0.85
col_x = [0.02, 0.28, 0.48, 0.64, 0.82]
for j, cl in enumerate(col_labels):
    ax_dept.text(col_x[j], header_y, cl, transform=ax_dept.transAxes,
                 color=TEXT_SUB, fontsize=5.5, fontweight='bold', va='top')
ax_dept.axhline(y=header_y - 0.03, xmin=0.01, xmax=0.99, color=BORDER,
                linewidth=0.6)

row_y = header_y - 0.07
for row in rows:
    for j, cell in enumerate(row):
        color = TEXT_MAIN if j == 0 else TEXT_SUB
        ax_dept.text(col_x[j], row_y, cell, transform=ax_dept.transAxes,
                     color=color, fontsize=5.2, va='top')
    row_y -= 0.115
    ax_dept.axhline(y=row_y + 0.01, xmin=0.01, xmax=0.99, color=BORDER,
                    linewidth=0.3, alpha=0.5)

# --- 3-2: スコアアラート一覧
ax_alert = fig.add_subplot(gs_row3[1])
blank_card(ax_alert, 'スコアアラート一覧')

alert_items = [
    ('🏖️', '休暇中業務アラート', '休暇中に業務が発生', '6人 ›', RED),
    ('☕', '休憩０分アラート',   '休憩０分の日がある', '5人 ›', ORANGE),
    ('⏰', '時間外90分超アラート', '時間外が90分を超過', '7人 ›', YELLOW),
    ('⚠️', '複合条件アラート',   '複数条件が重複',     '4人 ›', '#9b59b6'),
]
y_a = 0.82
for icon, title, desc, count, color in alert_items:
    rect = FancyBboxPatch((0.03, y_a - 0.13), 0.94, 0.15,
                          boxstyle="round,pad=0.01",
                          facecolor=BG_CARD2, edgecolor=BORDER,
                          linewidth=0.6, transform=ax_alert.transAxes)
    ax_alert.add_patch(rect)
    ax_alert.text(0.08, y_a - 0.01, icon, transform=ax_alert.transAxes,
                  fontsize=10, va='top')
    ax_alert.text(0.22, y_a - 0.01, title, transform=ax_alert.transAxes,
                  color=TEXT_MAIN, fontsize=6.5, fontweight='bold', va='top')
    ax_alert.text(0.22, y_a - 0.07, desc, transform=ax_alert.transAxes,
                  color=TEXT_SUB, fontsize=5.5, va='top')
    ax_alert.text(0.92, y_a - 0.04, count, transform=ax_alert.transAxes,
                  color=color, fontsize=9, fontweight='bold', va='top', ha='right')
    y_a -= 0.20

# --- 3-3: 時間外・休暇中業務一覧
ax_ot = fig.add_subplot(gs_row3[2])
blank_card(ax_ot, '時間外・休暇中業務一覧')

# フィルタードロップダウン風
ax_ot.text(0.95, 0.93, '▼ すべてのメンバー', transform=ax_ot.transAxes,
           color=TEXT_SUB, fontsize=6, ha='right', va='top',
           bbox=dict(boxstyle='round,pad=0.3', facecolor=BG_CARD2, edgecolor=BORDER, linewidth=0.6))

ot_headers = ['氏名', '日付', '業務区分', '時間外', '休暇中業務', 'メモ']
ot_col_x = [0.02, 0.18, 0.34, 0.52, 0.67, 0.82]
header_y = 0.85
for j, h in enumerate(ot_headers):
    ax_ot.text(ot_col_x[j], header_y, h, transform=ax_ot.transAxes,
               color=TEXT_SUB, fontsize=5.5, fontweight='bold', va='top')
ax_ot.axhline(y=header_y - 0.03, xmin=0.01, xmax=0.99, color=BORDER,
              linewidth=0.6)

ot_rows = [
    ('大川 真有美', '2026-05-26(火)', '外販製品(非電力)', '2時間15分', '1時間30分', '(休暇中業務)', RED, ORANGE),
    ('佐藤 拓郎',   '2026-05-26(火)', '直送商',           '1時間58分', '0時間45分', '',             RED, TEXT_MAIN),
    ('村上 光敏',   '2026-05-26(火)', '九電尋・点',       '2時間21分', '0時間00分', '時間外90分超',  RED, TEXT_MAIN),
    ('川内 栄子',   '2026-05-26(火)', '他電力等・点',     '1時間37分', '0時間50分', '休憩0分',       RED, ORANGE),
    ('大川 真有美', '2026-05-27(水)', '在庫商',           '1時間45分', '0時間40分', '休憩35分以下',  RED, ORANGE),
    ('山田 太郎',   '2026-05-27(水)', '社内対応',         '1時間12分', '0時間00分', '',             ORANGE, TEXT_MAIN),
]
row_y = header_y - 0.07
for row in ot_rows:
    name, date, wtype, ot, vac, memo, ot_color, vac_color = row
    ax_ot.text(ot_col_x[0], row_y, name, transform=ax_ot.transAxes,
               color=TEXT_MAIN, fontsize=5.5, va='top', fontweight='600')
    ax_ot.text(ot_col_x[1], row_y, date, transform=ax_ot.transAxes,
               color=TEXT_SUB, fontsize=5.2, va='top')
    ax_ot.text(ot_col_x[2], row_y, wtype, transform=ax_ot.transAxes,
               color=TEXT_SUB, fontsize=5.2, va='top')
    ax_ot.text(ot_col_x[3], row_y, ot, transform=ax_ot.transAxes,
               color=ot_color, fontsize=5.5, fontweight='bold', va='top')
    ax_ot.text(ot_col_x[4], row_y, vac, transform=ax_ot.transAxes,
               color=vac_color, fontsize=5.5, fontweight='bold', va='top')
    ax_ot.text(ot_col_x[5], row_y, memo, transform=ax_ot.transAxes,
               color=ORANGE, fontsize=5, va='top')
    row_y -= 0.115
    ax_ot.axhline(y=row_y + 0.01, xmin=0.01, xmax=0.99, color=BORDER,
                  linewidth=0.3, alpha=0.5)

# ============================================================
# 行4: メンバー状況（横スクロール想定・4名表示） | 算出要因パネル
# ============================================================
gs_row4 = gridspec.GridSpecFromSubplotSpec(1, 2, subplot_spec=gs[3],
                                            wspace=0.22, width_ratios=[3.5, 1.0])

# --- 4-1: メンバー状況（4名カード）
ax_members = fig.add_subplot(gs_row4[0])
blank_card(ax_members, 'メンバー状況（今月累計）')

member_cards = [
    ('佐藤 拓郎',   '営業部本社 / 課長', 88, 'Lv.4', '重点確認', RED,
     '40時間', '13時間25分', '0時間', '3時間',
     '主な要因: 休憩0分 3日、時間外90分超 4日、休暇中業務あり'),
    ('大川 真有美', '営業部本社 /',       92, 'Lv.4', '重点確認', RED,
     '51時間32分', '17時間30分', '1時間30分', '6時間',
     '主な要因: 休暇中業務あり、時間外90分超 6日、休憩35分以下 多発'),
    ('村上 光敏',   '営業部福岡支社/部長', 71, 'Lv.3', '要確認', ORANGE,
     '47時間18分', '14時間', '0時間', '3時間48分',
     '主な要因: 時間外90分超 3日、休憩35分以下 多発'),
    ('川内 栄子',   '営業部福岡支社 / 主任', 58, 'Lv.3', '要確認', ORANGE,
     '38時間', '8時間55分', '0時間50分', '3時間15分',
     '主な要因: 休憩0分 2日、休憩35分以下 多発'),
]

card_width = 0.235
card_gap   = 0.012
x_start    = 0.01

for i, (name, dept, score, lv, lv_label, lv_color,
        total, ot, vac, break_t, reason) in enumerate(member_cards):
    cx = x_start + i * (card_width + card_gap)
    # カード背景
    rect = FancyBboxPatch((cx, 0.04), card_width, 0.88,
                          boxstyle="round,pad=0.01",
                          facecolor=BG_CARD2, edgecolor=BORDER,
                          linewidth=0.8, transform=ax_members.transAxes, zorder=2)
    ax_members.add_patch(rect)

    # スコア（右上）
    ax_members.text(cx + card_width - 0.01, 0.88, str(score),
                    transform=ax_members.transAxes,
                    color=lv_color, fontsize=16, fontweight='bold',
                    ha='right', va='top', zorder=3)
    # レベルバッジ
    badge = FancyBboxPatch((cx + card_width - 0.085, 0.70), 0.08, 0.12,
                           boxstyle="round,pad=0.01",
                           facecolor=lv_color+'44', edgecolor=lv_color,
                           linewidth=0.7, transform=ax_members.transAxes, zorder=3)
    ax_members.add_patch(badge)
    ax_members.text(cx + card_width - 0.045, 0.79, lv,
                    transform=ax_members.transAxes,
                    color=lv_color, fontsize=5.5, fontweight='bold',
                    ha='center', va='center', zorder=4)
    ax_members.text(cx + card_width - 0.045, 0.72, lv_label,
                    transform=ax_members.transAxes,
                    color=lv_color, fontsize=4.5,
                    ha='center', va='center', zorder=4)

    # 名前・部署
    ax_members.text(cx + 0.01, 0.88, '👤', transform=ax_members.transAxes,
                    fontsize=10, va='top', zorder=3)
    ax_members.text(cx + 0.04, 0.88, name, transform=ax_members.transAxes,
                    color=TEXT_MAIN, fontsize=7.5, fontweight='bold', va='top', zorder=3)
    ax_members.text(cx + 0.04, 0.80, dept, transform=ax_members.transAxes,
                    color=TEXT_SUB, fontsize=5.5, va='top', zorder=3)

    # 4つの統計
    stats = [('総業務', total), ('時間外', ot), ('休暇中業務', vac), ('休憩', break_t)]
    sx_list = [cx + 0.01, cx + card_width/2 + 0.01]
    sy_list = [0.62, 0.44]
    for j, (slabel, sval) in enumerate(stats):
        sx = sx_list[j % 2]
        sy = sy_list[j // 2]
        mini_rect = FancyBboxPatch((sx, sy), card_width/2 - 0.02, 0.14,
                                   boxstyle="round,pad=0.005",
                                   facecolor=BG_MAIN, edgecolor=BORDER,
                                   linewidth=0.5, transform=ax_members.transAxes, zorder=3)
        ax_members.add_patch(mini_rect)
        ax_members.text(sx + 0.005, sy + 0.12, slabel,
                        transform=ax_members.transAxes,
                        color=TEXT_SUB, fontsize=5, va='top', zorder=4)
        val_color = RED if slabel in ('時間外', '休暇中業務') and sval != '0時間' else TEXT_MAIN
        ax_members.text(sx + 0.005, sy + 0.04, sval,
                        transform=ax_members.transAxes,
                        color=val_color, fontsize=6, fontweight='bold', va='bottom', zorder=4)

    # 主な要因
    ax_members.text(cx + 0.01, 0.26, reason, transform=ax_members.transAxes,
                    color=TEXT_SUB, fontsize=5, va='top',
                    wrap=True, zorder=3)

# 「他6名 →」ボタン風
ax_members.text(0.98, 0.50, '他6名 →', transform=ax_members.transAxes,
                color=ACCENT, fontsize=7, ha='right', va='center',
                bbox=dict(boxstyle='round,pad=0.3', facecolor=ACCENT+'22',
                          edgecolor=ACCENT, linewidth=0.6))

# --- 4-2: 業務負荷スコア算出要因パネル
ax_factor = fig.add_subplot(gs_row4[1])
blank_card(ax_factor, '業務負荷スコアの算出要因（重み）')

factors = [
    ('🏖️', '休暇中業務',          '40pt/件', '#e74c3c', '#e74c3c33'),
    ('☕', '休憩0分（非常に重）',  '30pt/日', '#e67e22', '#e67e2233'),
    ('⏰', '時間外90分以上（重）', '20pt/日', '#f1c40f', '#f1c40f33'),
    ('🍵', '休憩40分以下（中）',   '10pt/日', '#4f8ef7', '#4f8ef733'),
    ('⚠️', '複合条件（重複時）',   '+10〜30pt', '#9b59b6', '#9b59b633'),
]
y_f = 0.84
for icon, label, weight, color, bg in factors:
    rect = FancyBboxPatch((0.03, y_f - 0.11), 0.94, 0.13,
                          boxstyle="round,pad=0.01",
                          facecolor=bg, edgecolor=color,
                          linewidth=0.7, transform=ax_factor.transAxes)
    ax_factor.add_patch(rect)
    ax_factor.text(0.08, y_f - 0.04, icon, transform=ax_factor.transAxes,
                   fontsize=9, va='center')
    ax_factor.text(0.22, y_f - 0.02, label, transform=ax_factor.transAxes,
                   color=TEXT_MAIN, fontsize=6, va='top')
    ax_factor.text(0.95, y_f - 0.04, weight, transform=ax_factor.transAxes,
                   color=color, fontsize=7, fontweight='bold', va='center', ha='right')
    y_f -= 0.155

ax_factor.text(0.05, 0.06, '※合計スコアに応じてレベルを判定します',
               transform=ax_factor.transAxes, color=TEXT_SUB, fontsize=5.5, va='bottom')

# ============================================================
# 保存
# ============================================================
plt.savefig('/home/ubuntu/sales-dashboard/dashboard_v31_mockup.png',
            dpi=150, bbox_inches='tight', facecolor=BG_MAIN)
print("Saved: dashboard_v31_mockup.png")
