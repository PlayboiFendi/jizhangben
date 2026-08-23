// render.mjs —— 纯 HTML 渲染函数（不碰 DOM/数据库，便于单元测试）
import { ICONS } from './icons.mjs';
import { formatAmount } from './numpad.mjs';
import { fmtTime, todayLabel } from './stat.mjs';

export function iconSVG(name) {
  return ICONS[name] || '';
}

export function escapeHTML(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeAttr(s) {
  return escapeHTML(s).replace(/"/g, '&quot;');
}

export function emptyHTML(text) {
  return '<div class="empty">' + escapeHTML(text) + '</div>';
}

export function homeEmptyHTML() {
  return emptyHTML('还没有账目，点下方 ＋ 记一笔');
}

// ---------- 记账页 ----------
export function recordPageHTML(cats, opts) {
  const o = opts || {};
  const amount = o.amount || '';
  const catId = o.catId || 'food';
  const note = o.note || '';
  const banner = o.banner || '';
  const timeValue = o.timeValue || '';
  const app = o.app || '';

  const chips = cats
    .map((c) => {
      const active = c.id === catId;
      return (
        '<button type="button" class="chip' + (active ? ' active' : '') + '" data-cat="' + c.id + '" aria-pressed="' + active + '">' +
        '<span class="chip-ic" style="background:' + c.color + '">' + iconSVG(c.icon) + '</span>' +
        '<span>' + escapeHTML(c.name) + '</span></button>'
      );
    })
    .join('');

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
  const pad = keys
    .map((k) => '<button type="button" class="key" data-k="' + k + '">' + (k === 'del' ? iconSVG('delete') : k) + '</button>')
    .join('');

  const bannerHTML = banner
    ? '<div class="shortcut-banner" id="record-banner">' + iconSVG('zap') + '<span>' + escapeHTML(banner) + '</span></div>'
    : '<div class="shortcut-banner" id="record-banner" hidden></div>';

  const timeRow =
    '<div class="time-row">' +
    '<label class="time-label" for="record-time">记账时间</label>' +
    '<input class="time-input" id="record-time" type="datetime-local" step="1" value="' + escapeAttr(timeValue) + '">' +
    '<button type="button" class="time-now" id="record-time-now">现在</button>' +
    '</div>';

  const appRow = app
    ? '<div class="app-row"><span class="app-label">来源 App</span><span class="app-name">' + escapeHTML(app) + '</span></div>'
    : '';

  return (
    bannerHTML +
    '<div class="amount-box"><span class="amount-cur">¥</span><span class="amount-big" id="amount-display">' + formatAmount(amount) + '</span></div>' +
    timeRow +
    appRow +
    '<div class="cats" id="record-cats">' + chips + '</div>' +
    '<input class="note-input" id="record-note" type="text" inputmode="text" placeholder="备注（可选）" value="' + escapeAttr(note) + '">' +
    '<div class="numpad" id="record-pad">' + pad + '</div>' +
    '<button type="button" class="save-btn" id="record-save">保存这笔</button>'
  );
}

// ---------- 通用金额显示 ----------
export function fmtMoney(n) {
  return '¥' + formatAmount(String(n == null ? 0 : n));
}

// ---------- 首页（账单页） ----------
export function homePageHTML(monthText, monthSummary, todayTotal, groups, catMap) {
  const fallbackCat = { name: '其他', icon: 'circle-ellipsis', color: '#8b93a0' };

  const budget = monthSummary.budget || null;
  let budgetHTML = '';
  if (budget) {
    const over = budget.left < 0;
    budgetHTML =
      '<div class="budget-block">' +
      '<div class="budget-row"><span class="budget-label">月预算 ' + fmtMoney(budget.amount) + '</span>' +
      '<span class="budget-pct">已用 ' + budget.pct + '%</span></div>' +
      '<div class="budget-bar"><i style="width:' + Math.min(100, budget.pct) + '%"></i></div>' +
      '<div class="budget-hint">' + (over ? '已超预算 ' + fmtMoney(-budget.left) : '再花 ' + fmtMoney(budget.left) + ' 就超预算啦') + '</div>' +
      '</div>';
  } else {
    budgetHTML = '<button type="button" class="budget-empty" id="budget-set">设置月预算 ›</button>';
  }

  const overview =
    '<div class="overview">' +
    '<div class="ov-row">' +
    '<div class="ov-col"><span class="ov-label">本月支出</span>' +
    '<span class="ov-value">' + fmtMoney(monthSummary.total) + '</span>' +
    '<span class="ov-sub">共 ' + monthSummary.count + ' 笔</span></div>' +
    '<span class="ov-divider"></span>' +
    '<div class="ov-col"><span class="ov-label">今日支出</span>' +
    '<span class="ov-value">' + fmtMoney(todayTotal) + '</span>' +
    '<span class="ov-sub">' + escapeHTML(todayLabel()) + '</span></div>' +
    '</div>' +
    budgetHTML +
    '</div>';

  const quickCats = Array.from(catMap.values()).filter((c) => c && c.id && c.name).slice(0, 8);
  let quick = '';
  if (quickCats.length) {
    quick =
      '<div class="quick-grid">' +
      quickCats
        .map(
          (c) =>
            '<button type="button" class="quick-item" data-cat="' + escapeAttr(c.id) + '">' +
            '<span class="quick-ic" style="background-color:' + c.color + '">' + iconSVG(c.icon) + '</span>' +
            '<span class="quick-name">' + escapeHTML(c.name) + '</span></button>'
        )
        .join('') +
      '</div>';
  }

  let list = '';
  if (!groups.length) {
    list = homeEmptyHTML();
  } else {
    groups.forEach((g) => {
      list +=
        '<button type="button" class="group-title" data-day="' + g.day + '">' +
        '<span>' + escapeHTML(g.label) + '</span>' +
        '<span class="group-sum">支出 ' + fmtMoney(g.total) + ' <span class="group-chev">›</span></span></button>';
      g.items.forEach((r) => {
        const c = catMap.get(r.catId) || fallbackCat;
        list +=
          '<button type="button" class="tx-row" data-id="' + r.id + '">' +
          '<span class="cat-icon" style="background:' + c.color + '">' + iconSVG(c.icon) + '</span>' +
          '<span class="tx-main"><span class="tx-name">' + escapeHTML(c.name) + '</span>' +
          (r.note ? '<span class="tx-note">' + escapeHTML(r.note) + '</span>' : '') +
          (r.app ? '<span class="tx-app">' + escapeHTML(r.app) + '</span>' : '') +
          '</span><span class="tx-right"><span class="tx-amount">-' + fmtMoney(r.amount) + '</span>' +
          '<span class="tx-time">' + fmtTime(r.createdAt) + '</span></span></button>';
      });
    });
  }

  return (
    '<div class="row-head">' +
    '<span class="h2">' + escapeHTML(monthText) + '</span>' +
    '<span class="month-nav">' +
    '<button type="button" class="month-chip" id="home-month-prev" aria-label="上个月">‹</button>' +
    '<button type="button" class="month-chip" id="home-month-next" aria-label="下个月">›</button>' +
    '</span></div>' +
    overview + quick +
    '<p class="sec-title">账单明细</p>' +
    list
  );
}

// ---------- 统计页 ----------
export function statsPageHTML(monthText, monthSummary, bars, rows) {
  const max = Math.max.apply(null, bars.map((b) => b.total)) || 1;
  const barsHTML = bars
    .map((b) => {
      const h = Math.max(4, Math.round((b.total / max) * 88));
      return (
        '<button type="button" class="bar-wrap" data-day="' + b.day + '" aria-label="' + escapeAttr(b.day) + '">' +
        '<span class="bar' + (b.isToday ? ' strong' : '') + '" style="height:' + h + 'px"></span>' +
        '<span class="bar-day">' + escapeHTML(String(b.label)) + '</span></button>'
      );
    })
    .join('');

  let rowsHTML = '';
  if (!rows.length) {
    rowsHTML = emptyHTML('本月还没有支出');
  } else {
    rows.forEach((r) => {
      rowsHTML +=
        '<div class="cat-item">' +
        '<span class="cat-dot" style="background:' + r.color + '"></span>' +
        '<span class="cat-name">' + escapeHTML(r.name) + '</span>' +
        '<span class="cat-pct">' + r.pct + '%</span>' +
        '<span class="cat-val">' + fmtMoney(r.total) + '</span></div>' +
        '<div class="cat-bar"><i style="width:' + Math.min(100, r.pct) + '%;background:' + r.color + '"></i></div>';
    });
  }

  return (
    '<div class="row-head"><span class="h2">' + escapeHTML(monthText) + '</span></div>' +
    '<div class="summary">' +
    '<div class="sum-label">本月支出</div>' +
    '<div class="sum-value">' + fmtMoney(monthSummary.total) + '</div>' +
    '<div class="sum-sub">共 ' + monthSummary.count + ' 笔 · 日均约 ' + fmtMoney(monthSummary.avg) + '</div>' +
    '</div>' +
    '<p class="sec-title">本月每日支出</p>' +
    '<div class="bars">' + barsHTML + '</div>' +
    '<p class="bar-hint">点某一天查看当天金额与分类占比</p>' +
    '<p class="sec-title">分类占比</p>' +
    rowsHTML
  );
}

// ---------- 按日明细弹层 ----------
export function dayDetailHTML(total, count, rows) {
  let rowsHTML = '';
  if (!rows.length) {
    rowsHTML = emptyHTML('当天没有支出');
  } else {
    rows.forEach((r) => {
      rowsHTML +=
        '<div class="cat-item">' +
        '<span class="cat-dot" style="background:' + r.color + '"></span>' +
        '<span class="cat-name">' + escapeHTML(r.name) + '</span>' +
        '<span class="cat-pct">' + r.pct + '%</span>' +
        '<span class="cat-val">' + fmtMoney(r.total) + '</span></div>' +
        '<div class="cat-bar"><i style="width:' + Math.min(100, r.pct) + '%;background:' + r.color + '"></i></div>';
    });
  }
  return (
    '<div class="day-summary">' +
    '<div class="day-sum-item"><span class="day-sum-label">当日支出</span><span class="day-sum-value">' + fmtMoney(total) + '</span></div>' +
    '<div class="day-sum-item"><span class="day-sum-label">笔数</span><span class="day-sum-value">' + count + ' 笔</span></div>' +
    '</div>' +
    '<p class="sec-title">分类占比</p>' +
    rowsHTML
  );
}

// ---------- 设置页 ----------
export function settingsPageHTML() {
  const rows = [
    { id: 'budget', ic: 'chart-pie', name: '月预算', sub: '设置每月可花金额' },
    { id: 'cats', ic: 'list', name: '分类管理', sub: '增删改记账分类' },
    { id: 'shortcut', ic: 'smartphone', name: '快捷指令说明', sub: '怎么配"点一下记账"' },
    { id: 'backup', ic: 'download', name: '数据备份', sub: '导出账本到本机文件' },
    { id: 'restore', ic: 'upload', name: '数据恢复', sub: '从备份文件恢复' },
    { id: 'about', ic: 'info', name: '关于与隐私', sub: '数据只存在这台手机' },
  ];
  return rows
    .map(
      (r) =>
        '<button type="button" class="set-row" data-set="' + r.id + '">' +
        '<span class="set-ic">' + iconSVG(r.ic) + '</span>' +
        '<span class="set-txt"><span class="set-name">' + escapeHTML(r.name) + '</span>' +
        '<span class="set-sub">' + escapeHTML(r.sub) + '</span></span>' +
        '<span class="chev">' + iconSVG('chevron-right') + '</span></button>'
    )
    .join('');
}

export function shortcutGuideHTML() {
  return (
    '<div class="pri-desc">' +
    '<p>1. 打开 iPhone「快捷指令」App，点右上角 ＋ 新建快捷指令。</p>' +
    '<p>2. 添加动作「文本」，内容填写「金额」（建议把动作设为"运行时询问"，每次付款后输入金额）。</p>' +
    '<p>3. 添加动作「打开 URL」，URL 填写：</p>' +
    '<pre><code>你的App地址?amount=金额&amp;note=备注&amp;cat=food</code></pre>' +
    '<p>4. 保存后，把快捷指令添加到主屏幕，或设为"轻点背面/控制中心"触发。</p>' +
    '<p>5. 付款后点它，输入金额，App 会自动打开并带好金额，确认即可记账。</p>' +
    '</div>'
  );
}

export function aboutHTML() {
  return (
    '<div class="pri-desc">' +
    '<p>App 名称：钱需慢慢攒，心急则亏钱</p>' +
    '<p>所有账目数据只存在这台手机里（浏览器本地存储），不联网、不登录、不上传任何服务器。</p>' +
    '<p>建议定期在「设置 → 数据备份」里导出一份备份文件，以防万一。</p>' +
    '</div>'
  );
}
