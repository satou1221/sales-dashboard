#!/usr/bin/env python3
"""ダッシュボード v3.1 改修後レイアウトモックアップ（絵文字なし版）"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import matplotlib.gridspec as gridspec
import numpy as np

# ============================================================
# フォント設定（日本語対応）
# ============================================================
plt.rcParams['font.family'] = ['Noto Sans CJK JP', 'Noto Sans', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# ============================================================
# カラーパレット
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
PURPLE    = '#9b59b6'

WORK_COLORS = [ACCENT, RED, GREEN, YELLOW, PURPLE, TEAL, ORANGE, '#e91e63']

# ============================================================
# ヘルパー
# ============================================================
def blank_card(ax, title=None, title_color=TEXT_MAIN, title_size=8):
    ax.set_facecolor(BG_CARD)
    for sp in ax.spines.values():
        sp.set_edgecolor(BORDER); sp.set_linewidth(0.8)
    ax.set_xticks([]); ax.set_yticks([])
    if title:
        ax.text(0.015, 0.965, title, transform=ax.transAxes,
                color=title_color, fontsize=title_size, fontweight='bold', va='top')

def hline(ax, y, alpha=1.0):
    ax.axhline(y=y, color=BORDER, linewidth=0.5, alpha=alpha)

# ============================================================
# Figure
# ============================================================
fig = plt.figure(figsize=(24, 15), facecolor=BG_MAIN)

# ============================================================
# サイドバー
# ============================================================
sb = fig.add_axes([0.0, 0.0, 0.055, 1.0])
sb.set_facecolor('#0d1020')
for sp in sb.spines.values(): sp.set_visible(False)
sb.set_xticks([]); sb.set_yticks([])

sb.text(0.5, 0.975, '[DB]', transform=sb.transAxes, color=ACCENT,
        fontsize=11, ha='center', va='top', fontweight='bold')
sb.text(0.5, 0.945, '業務管理', transform=sb.transAxes, color=TEXT_MAIN,
        fontsize=6.5, ha='center', va='top')

nav = [('ダッシュボード', True), ('部門別分析', False), ('個人別分析', False),
       ('日別分析', False), ('アラート', False), ('CSV取込', False), ('設定', False)]
y0 = 0.895
for label, active in nav:
    if active:
        r = FancyBboxPatch((0.05, y0 - 0.025), 0.9, 0.045,
                           boxstyle='round,pad=0.01',
                           facecolor=ACCENT+'33', edgecolor=ACCENT,
                           linewidth=0.8, transform=sb.transAxes)
        sb.add_patch(r)
    sb.text(0.5, y0, label, transform=sb.transAxes,
            color=ACCENT if active else TEXT_SUB,
            fontsize=6, ha='center', va='center',
            fontweight='bold' if active else 'normal')
    y0 -= 0.075

sb.text(0.5, 0.03, 'ログアウト', transform=sb.transAxes,
        color=TEXT_SUB, fontsize=6, ha='center', va='bottom')

# ============================================================
# ヘッダー
# ============================================================
fig.text(0.062, 0.978, 'ダッシュボード', color=TEXT_MAIN, fontsize=13, fontweight='bold')
fig.text(0.062, 0.963, '2026年05月 データ', color=TEXT_SUB, fontsize=7.5)
fig.text(0.72, 0.978, '最終更新: 2026/05/31 09:51', color=TEXT_SUB, fontsize=7.5, ha='left')
fig.text(0.97, 0.978, '管理者', color=TEXT_MAIN, fontsize=8.5, fontweight='bold', ha='right')
fig.text(0.97, 0.963, 'システム管理者', color=TEXT_SUB, fontsize=7, ha='right')

# ============================================================
# GridSpec
# ============================================================
gs = gridspec.GridSpec(4, 1,
    left=0.060, right=0.99, top=0.952, bottom=0.015,
    hspace=0.32,
    height_ratios=[0.85, 3.4, 2.6, 2.8])

# ============================================================
# 行1: KPIカード × 6
# ============================================================
gs1 = gridspec.GridSpecFromSubplotSpec(1, 6, subplot_spec=gs[0], wspace=0.15)

kpis = [
    ('総業務時間',      '185時間59分', '前月比 -2.3%', GREEN,  ACCENT),
    ('時間外合計',      '37時間25分',  '前月比 +8.7%', RED,    ORANGE),
    ('休暇中業務',      '22時間14分',  '前月比 +25.6%',RED,    TEAL),
    ('1日平均休憩時間', '43分',        '前月比 -6分',  GREEN,  YELLOW),
    ('1人あたり平均',   '46時間30分',  '前月比 +1.2%', RED,    GREEN),
    ('重点確認人数',    '6人',         '前月比 +2人',  RED,    RED),
]
for i, (label, val, mom, mom_c, icon_c) in enumerate(kpis):
    ax = fig.add_subplot(gs1[i])
    blank_card(ax)
    # アイコン円
    c = plt.Circle((0.14, 0.52), 0.22, color=icon_c+'33', transform=ax.transAxes, zorder=2)
    ax.add_patch(c)
    ax.text(0.14, 0.52, '●', transform=ax.transAxes, color=icon_c,
            fontsize=14, ha='center', va='center', zorder=3)
    ax.text(0.40, 0.88, label, transform=ax.transAxes, color=TEXT_SUB, fontsize=6.5, va='top')
    ax.text(0.40, 0.60, val,   transform=ax.transAxes, color=TEXT_MAIN,
            fontsize=9.5, fontweight='bold', va='center')
    arrow = '▲' if mom_c == RED else '▼'
    ax.text(0.40, 0.25, f'{arrow} {mom}', transform=ax.transAxes,
            color=mom_c, fontsize=6.5, va='center')

# ============================================================
# 行2: 業務区分円グラフ | 個人別横棒グラフ | スコアアラートパネル
# ============================================================
gs2 = gridspec.GridSpecFromSubplotSpec(1, 3, subplot_spec=gs[1],
                                        wspace=0.20, width_ratios=[1.05, 2.6, 1.35])

# --- 2-1: 業務区分別比率
ax_pie = fig.add_subplot(gs2[0])
blank_card(ax_pie, '業務区分別比率')

wlabels = ['社内対応', '直送商', '外販製品(非電力)', '他電力等・点',
           '在庫商', '九電尋・点', 'TKD', '九電管路']
wvals   = [48.5, 18.2, 12.6, 8.4, 6.1, 3.5, 1.3, 1.4]
wedges, texts, autotexts = ax_pie.pie(
    wvals, colors=WORK_COLORS, startangle=90,
    autopct='%1.1f%%', pctdistance=0.78,
    wedgeprops=dict(width=0.52, edgecolor=BG_MAIN, linewidth=1.5))
for t in autotexts:
    t.set_fontsize(5.5); t.set_color(TEXT_MAIN)
ax_pie.set_aspect('equal')
ax_pie.text(0, 0, '合計\n185時間', ha='center', va='center',
            color=TEXT_MAIN, fontsize=6.5, fontweight='bold')
patches = [mpatches.Patch(color=WORK_COLORS[i], label=f'{wlabels[i]} {wvals[i]}%')
           for i in range(len(wlabels))]
ax_pie.legend(handles=patches, loc='lower center', bbox_to_anchor=(0.5, -0.30),
              ncol=2, fontsize=5.5, frameon=False, labelcolor=TEXT_SUB,
              handlelength=1.0, handleheight=0.8)

# --- 2-2: 個人別業務時間（横棒グラフ）
ax_bar = fig.add_subplot(gs2[1])
blank_card(ax_bar, '個人別業務時間（時間）')

members = ['佐藤 拓郎', '大川 真有美', '村上 光敏', '川内 栄子', '山田 太郎',
           '田中 恵子', '鈴木 一郎', '中村 美咲', '高橋 健二', '伊藤 由美']
np.random.seed(42)
work_data = {
    '社内対応':        [45, 52, 38, 41, 35, 48, 42, 39, 44, 37],
    '直送商':          [18, 22, 15, 19, 12, 20, 16, 14, 17, 13],
    '外販製品(非電力)': [12,  8, 14, 10, 16,  9, 13, 11,  8, 15],
    '他電力等・点':    [ 8,  6,  9,  7, 10,  5,  8,  6,  7,  9],
    '在庫商':          [ 5,  7,  4,  6,  3,  8,  5,  4,  6,  3],
    'その他':          [ 4,  3,  5,  4,  6,  3,  4,  5,  3,  4],
}
y_pos = np.arange(len(members))
left  = np.zeros(len(members))
for j, (wtype, vals) in enumerate(work_data.items()):
    ax_bar.barh(y_pos, vals, left=left,
                color=WORK_COLORS[j % len(WORK_COLORS)],
                height=0.60, label=wtype)
    left += np.array(vals)

ax_bar.set_yticks(y_pos)
ax_bar.set_yticklabels(members, fontsize=8, color=TEXT_MAIN)
ax_bar.set_xlabel('時間', color=TEXT_SUB, fontsize=7.5)
ax_bar.tick_params(axis='x', colors=TEXT_SUB, labelsize=7)
ax_bar.tick_params(axis='y', colors=TEXT_MAIN, labelsize=8, pad=4)
ax_bar.set_facecolor(BG_CARD)
for sp in ax_bar.spines.values():
    sp.set_edgecolor(BORDER)
ax_bar.grid(axis='x', color=BORDER, linewidth=0.5, alpha=0.5)
ax_bar.set_xlim(0, 125)
ax_bar.legend(list(work_data.keys()), loc='lower right',
              fontsize=5.5, frameon=False, labelcolor=TEXT_SUB,
              ncol=3, bbox_to_anchor=(1.0, -0.22))
# 合計値ラベル
for i, total in enumerate(left):
    ax_bar.text(total + 1, i, f'{int(total)}h', va='center',
                color=TEXT_SUB, fontsize=6.5)

# --- 2-3: 業務負荷スコアアラートパネル
ax_sc = fig.add_subplot(gs2[2])
blank_card(ax_sc, '業務負荷スコアアラート [i]')

ax_sc.text(0.05, 0.90, '1日平均休憩時間', transform=ax_sc.transAxes,
           color=TEXT_SUB, fontsize=6.5, va='top')
ax_sc.text(0.05, 0.80, '43分', transform=ax_sc.transAxes,
           color=TEXT_MAIN, fontsize=15, fontweight='bold', va='top')
ax_sc.text(0.05, 0.70, '▼ 前月比 -6分', transform=ax_sc.transAxes,
           color=GREEN, fontsize=6.5, va='top')

lv_data = [('Lv.4', '重点確認', '6人', RED),
           ('Lv.3', '要確認',   '5人', ORANGE),
           ('Lv.2', '注意',     '7人', YELLOW)]
for k, (lv, sub, cnt, col) in enumerate(lv_data):
    xs = 0.03 + k * 0.325
    r = FancyBboxPatch((xs, 0.50), 0.30, 0.17,
                       boxstyle='round,pad=0.01',
                       facecolor=col+'22', edgecolor=col,
                       linewidth=0.8, transform=ax_sc.transAxes)
    ax_sc.add_patch(r)
    ax_sc.text(xs+0.15, 0.67, lv,  transform=ax_sc.transAxes,
               color=col, fontsize=6.5, fontweight='bold', ha='center', va='top')
    ax_sc.text(xs+0.15, 0.61, sub, transform=ax_sc.transAxes,
               color=TEXT_SUB, fontsize=5.5, ha='center', va='top')
    ax_sc.text(xs+0.15, 0.53, cnt, transform=ax_sc.transAxes,
               color=col, fontsize=12, fontweight='bold', ha='center', va='top')

ax_sc.text(0.05, 0.47, 'ハイリスクメンバー TOP5', transform=ax_sc.transAxes,
           color=TEXT_SUB, fontsize=6.5, fontweight='bold', va='top')
hline(ax_sc, 0.45)

top5 = [('1','大川 真有美','92 (Lv.4)','休暇中業務あり'),
        ('2','佐藤 拓郎',  '88 (Lv.4)','休憩0分 3日'),
        ('3','村上 光敏',  '71 (Lv.3)','時間外90分超 3日'),
        ('4','川内 栄子',  '58 (Lv.3)','休憩0分 2日'),
        ('5','山田 太郎',  '42 (Lv.2)','時間外90分超 1日')]
yt = 0.42
for rank, name, score, reason in top5:
    sc = RED if 'Lv.4' in score else ORANGE if 'Lv.3' in score else YELLOW
    ax_sc.text(0.03, yt, rank,   transform=ax_sc.transAxes, color=TEXT_SUB, fontsize=5.5, va='top')
    ax_sc.text(0.12, yt, name,   transform=ax_sc.transAxes, color=TEXT_MAIN, fontsize=5.5, va='top')
    ax_sc.text(0.58, yt, score,  transform=ax_sc.transAxes, color=sc, fontsize=5.5, fontweight='bold', va='top')
    ax_sc.text(0.03, yt-0.045, reason, transform=ax_sc.transAxes, color=TEXT_SUB, fontsize=4.8, va='top')
    yt -= 0.09

# ============================================================
# 行3: 部門比較 | スコアアラート一覧 | 時間外・休暇中業務一覧
# ============================================================
gs3 = gridspec.GridSpecFromSubplotSpec(1, 3, subplot_spec=gs[2],
                                        wspace=0.20, width_ratios=[1.3, 1.05, 2.1])

# --- 3-1: 部門比較
ax_dept = fig.add_subplot(gs3[0])
blank_card(ax_dept, '部門比較（今月累計）')

cols_h = ['項目', '営業部全体', '本社', '福岡支社', '九州支社']
rows_d = [
    ['総務時間',       '185時間59分','184時間56分','96時間12分','89時間47分'],
    ['1人あたり平均',  '61時間39分', '61時間38分', '48時間06分','44時間14分'],
    ['時間外合計',     '37時間25分', '36時間22分', '18時間13分','19時間12分'],
    ['休憩中業務合計', '14時間15分', '13時間48分', '7時間02分', '7時間13分'],
    ['休暇中業務合計', '22時間14分', '21時間36分', '11時間12分','10時間45分'],
    ['在籍人数',       '10人',       '3人',        '2人',       '2人'],
]
cx = [0.02, 0.28, 0.48, 0.65, 0.83]
hy = 0.87
for j, h in enumerate(cols_h):
    ax_dept.text(cx[j], hy, h, transform=ax_dept.transAxes,
                 color=TEXT_SUB, fontsize=5.5, fontweight='bold', va='top')
hline(ax_dept, hy - 0.03)
ry = hy - 0.09
for row in rows_d:
    for j, cell in enumerate(row):
        ax_dept.text(cx[j], ry, cell, transform=ax_dept.transAxes,
                     color=TEXT_MAIN if j == 0 else TEXT_SUB,
                     fontsize=5.2, va='top')
    ry -= 0.125
    hline(ax_dept, ry + 0.01, alpha=0.4)

# --- 3-2: スコアアラート一覧
ax_al = fig.add_subplot(gs3[1])
blank_card(ax_al, 'スコアアラート一覧')

alerts = [
    ('[休暇]', '休暇中業務アラート', '休暇中に業務が発生', '6人 >', RED),
    ('[休憩]', '休憩0分アラート',    '休憩0分の日がある',  '5人 >', ORANGE),
    ('[残業]', '時間外90分超アラート','時間外が90分を超過', '7人 >', YELLOW),
    ('[複合]', '複合条件アラート',   '複数条件が重複',     '4人 >', PURPLE),
]
ya = 0.84
for icon, title, desc, cnt, col in alerts:
    r = FancyBboxPatch((0.03, ya-0.14), 0.94, 0.155,
                       boxstyle='round,pad=0.01',
                       facecolor=BG_CARD2, edgecolor=BORDER,
                       linewidth=0.6, transform=ax_al.transAxes)
    ax_al.add_patch(r)
    ax_al.text(0.07, ya-0.01, icon,  transform=ax_al.transAxes,
               color=col, fontsize=8, fontweight='bold', va='top')
    ax_al.text(0.22, ya-0.01, title, transform=ax_al.transAxes,
               color=TEXT_MAIN, fontsize=6.5, fontweight='bold', va='top')
    ax_al.text(0.22, ya-0.07, desc,  transform=ax_al.transAxes,
               color=TEXT_SUB, fontsize=5.5, va='top')
    ax_al.text(0.93, ya-0.05, cnt,   transform=ax_al.transAxes,
               color=col, fontsize=9, fontweight='bold', va='top', ha='right')
    ya -= 0.205

# --- 3-3: 時間外・休暇中業務一覧
ax_ot = fig.add_subplot(gs3[2])
blank_card(ax_ot, '時間外・休暇中業務一覧')

ax_ot.text(0.96, 0.93, '▼ すべてのメンバー', transform=ax_ot.transAxes,
           color=TEXT_SUB, fontsize=6, ha='right', va='top',
           bbox=dict(boxstyle='round,pad=0.3', facecolor=BG_CARD2,
                     edgecolor=BORDER, linewidth=0.6))

ot_h = ['氏名', '日付', '業務区分', '時間外', '休暇中業務', 'メモ']
otx  = [0.02, 0.18, 0.34, 0.54, 0.69, 0.84]
ohy  = 0.87
for j, h in enumerate(ot_h):
    ax_ot.text(otx[j], ohy, h, transform=ax_ot.transAxes,
               color=TEXT_SUB, fontsize=5.5, fontweight='bold', va='top')
hline(ax_ot, ohy - 0.03)

ot_rows = [
    ('大川 真有美','2026-05-26(火)','外販製品(非電力)','2時間15分','1時間30分','(休暇中業務)',RED,ORANGE),
    ('佐藤 拓郎',  '2026-05-26(火)','直送商',          '1時間58分','0時間45分','',            RED,TEXT_MAIN),
    ('村上 光敏',  '2026-05-26(火)','九電尋・点',      '2時間21分','0時間00分','時間外90分超', RED,TEXT_MAIN),
    ('川内 栄子',  '2026-05-26(火)','他電力等・点',    '1時間37分','0時間50分','休憩0分',      RED,ORANGE),
    ('大川 真有美','2026-05-27(水)','在庫商',           '1時間45分','0時間40分','休憩35分以下', RED,ORANGE),
    ('山田 太郎',  '2026-05-27(水)','社内対応',         '1時間12分','0時間00分','',            ORANGE,TEXT_MAIN),
]
ory = ohy - 0.08
for row in ot_rows:
    name,date,wtype,ot,vac,memo,otc,vacc = row
    ax_ot.text(otx[0], ory, name,  transform=ax_ot.transAxes, color=TEXT_MAIN, fontsize=5.5, fontweight='600', va='top')
    ax_ot.text(otx[1], ory, date,  transform=ax_ot.transAxes, color=TEXT_SUB,  fontsize=5.2, va='top')
    ax_ot.text(otx[2], ory, wtype, transform=ax_ot.transAxes, color=TEXT_SUB,  fontsize=5.2, va='top')
    ax_ot.text(otx[3], ory, ot,    transform=ax_ot.transAxes, color=otc,  fontsize=5.5, fontweight='bold', va='top')
    ax_ot.text(otx[4], ory, vac,   transform=ax_ot.transAxes, color=vacc, fontsize=5.5, fontweight='bold', va='top')
    ax_ot.text(otx[5], ory, memo,  transform=ax_ot.transAxes, color=ORANGE, fontsize=5, va='top')
    ory -= 0.118
    hline(ax_ot, ory + 0.01, alpha=0.4)

# ============================================================
# 行4: メンバー状況（4名カード） | 算出要因パネル
# ============================================================
gs4 = gridspec.GridSpecFromSubplotSpec(1, 2, subplot_spec=gs[3],
                                        wspace=0.20, width_ratios=[3.5, 1.0])

# --- 4-1: メンバー状況
ax_mem = fig.add_subplot(gs4[0])
blank_card(ax_mem, 'メンバー状況（今月累計）')

mcards = [
    ('佐藤 拓郎',   '営業部本社 / 課長',    88, 'Lv.4','重点確認', RED,
     '40時間','13時間25分','0時間','3時間',
     '主な要因: 休憩0分 3日、時間外90分超 4日、休暇中業務あり'),
    ('大川 真有美', '営業部本社',            92, 'Lv.4','重点確認', RED,
     '51時間32分','17時間30分','1時間30分','6時間',
     '主な要因: 休暇中業務あり、時間外90分超 6日、休憩35分以下 多発'),
    ('村上 光敏',   '営業部福岡支社 / 部長', 71, 'Lv.3','要確認',  ORANGE,
     '47時間18分','14時間','0時間','3時間48分',
     '主な要因: 時間外90分超 3日、休憩35分以下 多発'),
    ('川内 栄子',   '営業部福岡支社 / 主任', 58, 'Lv.3','要確認',  ORANGE,
     '38時間','8時間55分','0時間50分','3時間15分',
     '主な要因: 休憩0分 2日、休憩35分以下 多発'),
]

cw   = 0.232
cgap = 0.010
x0   = 0.012

for i, (name,dept,score,lv,lvl,lvc,total,ot,vac,brk,reason) in enumerate(mcards):
    cx = x0 + i*(cw+cgap)
    # カード背景
    r = FancyBboxPatch((cx, 0.04), cw, 0.90,
                       boxstyle='round,pad=0.01',
                       facecolor=BG_CARD2, edgecolor=BORDER,
                       linewidth=0.8, transform=ax_mem.transAxes, zorder=2)
    ax_mem.add_patch(r)
    # スコア
    ax_mem.text(cx+cw-0.008, 0.91, str(score), transform=ax_mem.transAxes,
                color=lvc, fontsize=18, fontweight='bold', ha='right', va='top', zorder=3)
    # バッジ
    bw, bh = 0.075, 0.115
    br = FancyBboxPatch((cx+cw-bw-0.005, 0.72), bw, bh,
                        boxstyle='round,pad=0.01',
                        facecolor=lvc+'44', edgecolor=lvc,
                        linewidth=0.7, transform=ax_mem.transAxes, zorder=3)
    ax_mem.add_patch(br)
    ax_mem.text(cx+cw-bw/2-0.005, 0.79, lv,  transform=ax_mem.transAxes,
                color=lvc, fontsize=5.5, fontweight='bold', ha='center', va='center', zorder=4)
    ax_mem.text(cx+cw-bw/2-0.005, 0.73, lvl, transform=ax_mem.transAxes,
                color=lvc, fontsize=4.5, ha='center', va='center', zorder=4)
    # 名前・部署
    ax_mem.text(cx+0.010, 0.91, '[人]', transform=ax_mem.transAxes,
                color=TEXT_SUB, fontsize=8, va='top', zorder=3)
    ax_mem.text(cx+0.042, 0.91, name, transform=ax_mem.transAxes,
                color=TEXT_MAIN, fontsize=8, fontweight='bold', va='top', zorder=3)
    ax_mem.text(cx+0.042, 0.83, dept, transform=ax_mem.transAxes,
                color=TEXT_SUB, fontsize=5.5, va='top', zorder=3)
    # 4統計ミニカード
    stats = [('総業務',total),('時間外',ot),('休暇中業務',vac),('休憩',brk)]
    sw = cw/2 - 0.015
    sh = 0.135
    for j,(sl,sv) in enumerate(stats):
        sx = cx + 0.008 + (j%2)*(sw+0.008)
        sy = 0.60 - (j//2)*(sh+0.015)
        mr = FancyBboxPatch((sx, sy), sw, sh,
                            boxstyle='round,pad=0.005',
                            facecolor=BG_MAIN, edgecolor=BORDER,
                            linewidth=0.5, transform=ax_mem.transAxes, zorder=3)
        ax_mem.add_patch(mr)
        ax_mem.text(sx+0.006, sy+sh-0.01, sl, transform=ax_mem.transAxes,
                    color=TEXT_SUB, fontsize=5, va='top', zorder=4)
        vc = RED if sl in ('時間外','休暇中業務') and sv not in ('0時間','0時間00分') else TEXT_MAIN
        ax_mem.text(sx+0.006, sy+0.02, sv, transform=ax_mem.transAxes,
                    color=vc, fontsize=6, fontweight='bold', va='bottom', zorder=4)
    # 要因
    ax_mem.text(cx+0.010, 0.25, reason, transform=ax_mem.transAxes,
                color=TEXT_SUB, fontsize=5, va='top', zorder=3,
                wrap=True)

# 「他6名」ボタン
ax_mem.text(0.985, 0.50, '他6名 >', transform=ax_mem.transAxes,
            color=ACCENT, fontsize=7, ha='right', va='center',
            bbox=dict(boxstyle='round,pad=0.3', facecolor=ACCENT+'22',
                      edgecolor=ACCENT, linewidth=0.6))

# --- 4-2: 算出要因パネル
ax_fac = fig.add_subplot(gs4[1])
blank_card(ax_fac, '業務負荷スコアの算出要因（重み）')

factors = [
    ('[休暇]', '休暇中業務',          '40pt/件', RED,    RED+'33'),
    ('[休憩]', '休憩0分（非常に重）', '30pt/日', ORANGE, ORANGE+'33'),
    ('[残業]', '時間外90分以上（重）','20pt/日', YELLOW, YELLOW+'33'),
    ('[中]',   '休憩40分以下（中）',  '10pt/日', ACCENT, ACCENT+'33'),
    ('[複合]', '複合条件（重複時）',  '+10〜30pt',PURPLE, PURPLE+'33'),
]
yf = 0.86
for icon, label, weight, col, bg in factors:
    r = FancyBboxPatch((0.03, yf-0.115), 0.94, 0.125,
                       boxstyle='round,pad=0.01',
                       facecolor=bg, edgecolor=col,
                       linewidth=0.7, transform=ax_fac.transAxes)
    ax_fac.add_patch(r)
    ax_fac.text(0.08, yf-0.04, icon,   transform=ax_fac.transAxes,
                color=col, fontsize=8, fontweight='bold', va='center')
    ax_fac.text(0.22, yf-0.02, label,  transform=ax_fac.transAxes,
                color=TEXT_MAIN, fontsize=6, va='top')
    ax_fac.text(0.96, yf-0.04, weight, transform=ax_fac.transAxes,
                color=col, fontsize=7.5, fontweight='bold', va='center', ha='right')
    yf -= 0.158

ax_fac.text(0.05, 0.055, '※合計スコアに応じてレベルを判定します',
            transform=ax_fac.transAxes, color=TEXT_SUB, fontsize=5.5, va='bottom')

# ============================================================
# 保存
# ============================================================
plt.savefig('/home/ubuntu/sales-dashboard/dashboard_v31_mockup.png',
            dpi=150, bbox_inches='tight', facecolor=BG_MAIN)
print("Saved.")
