// ui.mjs —— DOM 绑定与交互：导航、首页、记账页、统计页、设置页、提示条、弹层
import { PAGE_TITLES, normalizePage } from './nav.mjs';
import { ICONS } from './icons.mjs';
import { getCategories, getRecords, addRecord, updateRecord, deleteRecord, deleteCategory, putCategory, putRecord, clearAll } from './db.mjs';
import { recordPageHTML, homePageHTML, statsPageHTML, settingsPageHTML, shortcutGuideHTML, aboutHTML, emptyHTML, escapeHTML, fmtMoney, dayDetailHTML } from './render.mjs';
import { applyKey, formatAmount } from './numpad.mjs';
import { isValidAmount, sanitizeNote } from './validate.mjs';
import { resolveCategory } from './url.mjs';
import { buildBackup, backupToText, parseBackup, reassignCategory, countByCategory } from './backup.mjs';
import {
  filterByMonth, filterByDay, sumRecords, groupRecordsByDay, categoryBreakdown, monthDailyBars,
  todayKey, currentMonthKey, monthLabel, shiftMonth, groupLabel, todayLabel,
  toLocalInputValue, fromLocalInputValue, fmtDateTime, budgetInfo,
} from './stat.mjs';

const renderers = {};
let currentPage = 'home';
let toastTimer = null;

const recordState = {
  amount: '',
  catId: 'food',
  note: '',
  app: '',
  createdAt: null,
  editingId: null,
  banner: '',
  shortcutCat: null,
};

const homeState = { month: currentMonthKey() };

export function registerRenderer(page, fn) {
  renderers[page] = fn;
}

export function iconSVG(name) {
  return ICONS[name] || '';
}

export function getCurrentPage() {
  return currentPage;
}

export function showPage(name) {
  currentPage = normalizePage(name);
  document.querySelectorAll('.page').forEach((p) => {
    p.classList.toggle('active', p.dataset.page === currentPage);
  });
  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === currentPage);
  });
  const title = document.getElementById('page-title');
  if (title) title.textContent = PAGE_TITLES[currentPage];
  const fn = renderers[currentPage];
  if (fn) fn();
}

export function initIcons(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-ic]').forEach((el) => {
    const name = el.getAttribute('data-ic');
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

export function bindTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'record' && !recordState.editingId && !recordState.shortcutCat) {
        resetRecordState();
      }
      showPage(tab.dataset.tab);
    });
  });
}

export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

export function openSheet(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = false;
}

export function closeSheet(id) {
  const el = document.getElementById(id);
  if (el) el.hidden = true;
}

// ---------- 记账页 ----------
function resetRecordState() {
  recordState.amount = '';
  recordState.catId = 'food';
  recordState.note = '';
  recordState.app = '';
  recordState.createdAt = null;
  recordState.editingId = null;
  recordState.banner = '';
  recordState.shortcutCat = null;
}

async function renderRecordPage() {
  const cats = await getCategories();
  if (recordState.shortcutCat) {
    const id = resolveCategory(cats, recordState.shortcutCat);
    if (id) recordState.catId = id;
    recordState.shortcutCat = null;
  }
  const page = document.querySelector('.page[data-page="record"]');
  page.innerHTML = recordPageHTML(cats, {
    amount: recordState.amount,
    catId: recordState.catId,
    note: recordState.note,
    app: recordState.app,
    banner: recordState.banner,
    timeValue: toLocalInputValue(recordState.createdAt || new Date()),
  });
  bindRecordEvents(cats);
}

function bindRecordEvents(cats) {
  const display = document.getElementById('amount-display');
  const refresh = () => {
    display.textContent = formatAmount(recordState.amount);
  };

  document.querySelectorAll('#record-cats .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      recordState.catId = chip.dataset.cat;
      document.querySelectorAll('#record-cats .chip').forEach((c) => {
        const on = c === chip;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', String(on));
      });
    });
  });

  document.querySelectorAll('#record-pad .key').forEach((key) => {
    key.addEventListener('click', () => {
      recordState.amount = applyKey(recordState.amount, key.dataset.k);
      refresh();
    });
  });

  const note = document.getElementById('record-note');
  if (note) {
    note.addEventListener('input', () => {
      recordState.note = note.value;
    });
  }

  const timeInput = document.getElementById('record-time');
  if (timeInput) {
    timeInput.addEventListener('change', () => {
      recordState.createdAt = timeInput.value ? fromLocalInputValue(timeInput.value) : new Date();
    });
    const nowBtn = document.getElementById('record-time-now');
    if (nowBtn) {
      nowBtn.addEventListener('click', () => {
        recordState.createdAt = new Date();
        timeInput.value = toLocalInputValue(recordState.createdAt);
      });
    }
  }

  document.getElementById('record-save').addEventListener('click', async () => {
    if (!isValidAmount(recordState.amount)) {
      toast('请先输入金额');
      return;
    }
    const amount = Number(recordState.amount);
    const noteText = sanitizeNote(recordState.note);
    try {
      const createdAt = recordState.createdAt || new Date();
      if (recordState.editingId) {
        await updateRecord(recordState.editingId, { amount, catId: recordState.catId, note: noteText, app: recordState.app, createdAt });
        toast('已修改这笔账');
      } else {
        await addRecord({ amount, catId: recordState.catId, note: noteText, app: recordState.app, createdAt });
        toast('已记入账本');
      }
    } catch (e) {
      toast('保存失败：' + (e && e.message ? e.message : '未知错误'));
      return;
    }
    resetRecordState();
    showPage('home');
  });
}

export function openRecordForEdit(rec) {
  recordState.amount = String(rec.amount);
  recordState.catId = rec.catId;
  recordState.note = rec.note === '无备注' ? '' : rec.note;
  recordState.app = rec.app || '';
  recordState.editingId = rec.id;
  recordState.createdAt = rec.createdAt ? new Date(rec.createdAt) : null;
  recordState.banner = '正在修改：' + (rec.catName || rec.catId);
  recordState.shortcutCat = null;
  showPage('record');
}

export function openRecordFromShortcut(params) {
  const rawAmount = String(params.amount || '');
  recordState.amount = isValidAmount(rawAmount) ? rawAmount : '';
  recordState.note = params.note || '';
  recordState.app = String(params.app || '');
  recordState.createdAt = null;
  recordState.editingId = null;
  recordState.shortcutCat = params.cat || null;
  const banner = '来自快捷指令' + (recordState.app ? '（' + recordState.app + '）' : '') +
    '：¥' + formatAmount(recordState.amount) +
    (recordState.note ? ' · ' + recordState.note : '') + '，确认后保存';
  recordState.banner = banner;
  showPage('record');
}

// ---------- 首页（账单） ----------
async function renderHomePage() {
  const [records, cats] = await Promise.all([getRecords(), getCategories()]);
  const monthRecords = filterByMonth(records, homeState.month);
  const total = sumRecords(monthRecords);
  const monthSummary = { total, count: monthRecords.length, budget: budgetInfo(total, getBudget()) };
  const todayTotal = sumRecords(filterByDay(records, todayKey()));
  const groups = groupRecordsByDay(monthRecords, todayKey());
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const page = document.querySelector('.page[data-page="home"]');
  page.innerHTML = homePageHTML(monthLabel(homeState.month), monthSummary, todayTotal, groups, catMap);
  bindHomeEvents(records, cats);
}

function bindHomeEvents(records, cats) {
  const prev = document.getElementById('home-month-prev');
  const next = document.getElementById('home-month-next');
  if (prev) {
    prev.addEventListener('click', () => {
      homeState.month = shiftMonth(homeState.month, -1);
      renderHomePage();
    });
  }
  if (next) {
    const cm = currentMonthKey();
    if (homeState.month >= cm) next.disabled = true;
    next.addEventListener('click', () => {
      const cm2 = currentMonthKey();
      if (homeState.month < cm2) {
        homeState.month = shiftMonth(homeState.month, 1);
        renderHomePage();
      }
    });
  }
  document.querySelectorAll('.tx-row').forEach((row) => {
    row.addEventListener('click', () => {
      const rec = records.find((r) => r.id === row.dataset.id);
      if (rec) openTxSheet(rec, cats);
    });
  });
  document.querySelectorAll('.group-title[data-day]').forEach((el) => {
    el.addEventListener('click', () => {
      openDayDetailSheet(el.dataset.day, records, cats);
    });
  });
  document.querySelectorAll('.quick-item[data-cat]').forEach((el) => {
    el.addEventListener('click', () => {
      openRecordWithCat(el.dataset.cat);
    });
  });
  const budgetSet = document.getElementById('budget-set');
  if (budgetSet) {
    budgetSet.addEventListener('click', () => openBudgetSheet());
  }
}

// ---------- 月预算 ----------
function getBudget() {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const v = parseFloat(localStorage.getItem('ledger.monthly_budget') || '');
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch (e) { return 0; }
}

function setBudget(v) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('ledger.monthly_budget', String(v));
  } catch (e) { /* noop */ }
}

function openBudgetSheet() {
  const cur = getBudget();
  const root = document.getElementById('overlay-root');
  root.innerHTML =
    '<div class="overlay" id="budget-sheet"><div class="sheet">' +
    '<div class="sheet-head"><span class="sheet-title">设置月预算</span>' +
    '<button type="button" class="sheet-close" data-close="budget-sheet" aria-label="关闭">' + iconSVG('x') + '</button></div>' +
    '<div class="field"><label>每月可花金额（元）</label>' +
    '<input id="budget-input" type="number" inputmode="decimal" min="0" step="0.01" value="' + (cur > 0 ? cur : '') + '" placeholder="例如 8000"></div>' +
    '<div class="sheet-actions">' +
    '<button type="button" class="btn-ghost" id="budget-cancel">取消</button>' +
    '<button type="button" class="btn-primary" id="budget-save">保存</button>' +
    '</div></div></div>';
  const overlay = document.getElementById('budget-sheet');
  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const input = document.getElementById('budget-input');
  document.getElementById('budget-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('budget-save').addEventListener('click', () => {
    const v = parseFloat(input.value);
    if (!Number.isFinite(v) || v <= 0) { toast('请输入有效金额'); return; }
    setBudget(Math.round(v * 100) / 100);
    overlay.remove();
    toast('已设置月预算');
    showPage(getCurrentPage());
  });
}

function openRecordWithCat(catId) {
  resetRecordState();
  recordState.catId = catId || 'food';
  showPage('record');
}

function openDayDetailSheet(day, records, cats) {
  const dayRecords = filterByDay(records, day);
  const total = sumRecords(dayRecords);
  const count = dayRecords.length;
  const rows = categoryBreakdown(dayRecords, cats);
  const label = groupLabel(day, todayKey());
  const root = document.getElementById('overlay-root');
  root.innerHTML =
    '<div class="overlay" id="day-sheet"><div class="sheet">' +
    '<div class="sheet-head"><span class="sheet-title">' + escapeHTML(label) + '</span>' +
    '<button type="button" class="sheet-close" data-close="day-sheet" aria-label="关闭">' + iconSVG('x') + '</button></div>' +
    dayDetailHTML(total, count, rows) +
    '</div></div>';
  const overlay = document.getElementById('day-sheet');
  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function openTxSheet(rec, cats) {
  const cat = cats.find((c) => c.id === rec.catId) || { name: rec.catId };
  const root = document.getElementById('overlay-root');
  root.innerHTML =
    '<div class="overlay" id="tx-sheet">' +
    '<div class="sheet">' +
    '<div class="sheet-head"><span class="sheet-title">' + escapeHTML(cat.name || rec.catId) +
    (rec.note ? ' · ' + escapeHTML(rec.note) : '') + '</span>' +
    '<button type="button" class="sheet-close" data-close="tx-sheet" aria-label="关闭">' + iconSVG('x') + '</button></div>' +
    '<div class="tx-amount-center">-' + fmtMoney(rec.amount) + '</div>' +
    '<div class="tx-time-full">' + fmtDateTime(rec.createdAt) + '</div>' +
    (rec.app ? '<div class="tx-app-full">来源 App：' + escapeHTML(rec.app) + '</div>' : '') +
    '<div class="sheet-actions">' +
    '<button type="button" class="btn-ghost" id="tx-del">' + iconSVG('trash-2') + '删除</button>' +
    '<button type="button" class="btn-primary" id="tx-edit">' + iconSVG('pencil') + '修改</button>' +
    '</div></div></div>';

  const overlay = document.getElementById('tx-sheet');
  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById('tx-del').addEventListener('click', async () => {
    await deleteRecord(rec.id);
    overlay.remove();
    toast('已删除');
    renderHomePage();
  });
  document.getElementById('tx-edit').addEventListener('click', () => {
    overlay.remove();
    openRecordForEdit({ id: rec.id, amount: rec.amount, catId: rec.catId, note: rec.note, catName: cat.name });
  });
}

// ---------- 统计页 ----------
async function renderStatsPage() {
  const [records, cats] = await Promise.all([getRecords(), getCategories()]);
  const month = currentMonthKey();
  const monthRecords = filterByMonth(records, month);
  const bars = monthDailyBars(records, month);
  const rows = categoryBreakdown(monthRecords, cats);
  const total = sumRecords(monthRecords);
  const count = monthRecords.length;
  const daysElapsed = new Date().getDate();
  const avg = daysElapsed > 0 ? Math.round((total / daysElapsed) * 100) / 100 : 0;
  const page = document.querySelector('.page[data-page="stats"]');
  page.innerHTML = statsPageHTML(monthLabel(month), { total, count, avg }, bars, rows);
  bindStatsEvents(records, cats);
}

function bindStatsEvents(records, cats) {
  document.querySelectorAll('.bar-wrap[data-day]').forEach((el) => {
    el.addEventListener('click', () => {
      openDayDetailSheet(el.dataset.day, records, cats);
    });
  });
}

// ---------- 设置页 ----------
const CAT_COLORS = ['#e8890c', '#2f7de1', '#7c5ce0', '#0e9f6e', '#d6539b', '#d63a3f', '#8b93a0', '#d4a017'];
let catEditId = null;

async function renderSettingsPage() {
  const page = document.querySelector('.page[data-page="settings"]');
  page.innerHTML = settingsPageHTML();
  document.querySelectorAll('[data-set]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.set;
      if (act === 'budget') openBudgetSheet();
      else if (act === 'cats') openCategoryManager();
      else if (act === 'shortcut') showInfoSheet('快捷指令说明', shortcutGuideHTML());
      else if (act === 'backup') doBackup();
      else if (act === 'restore') doRestore();
      else if (act === 'about') showInfoSheet('关于与隐私', aboutHTML());
    });
  });
}

function showInfoSheet(title, html) {
  const root = document.getElementById('overlay-root');
  root.innerHTML =
    '<div class="overlay" id="info-sheet"><div class="sheet">' +
    '<div class="sheet-head"><span class="sheet-title">' + escapeHTML(title) + '</span>' +
    '<button type="button" class="sheet-close" data-close="info-sheet" aria-label="关闭">' + iconSVG('x') + '</button></div>' +
    html +
    '</div></div>';
  const overlay = document.getElementById('info-sheet');
  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

async function doBackup() {
  const [records, cats] = await Promise.all([getRecords(), getCategories()]);
  const backup = buildBackup(records, cats);
  const blob = new Blob([backupToText(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '账本备份-' + todayKey() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('备份已导出');
}

function doRestore() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    let data;
    try {
      data = parseBackup(await file.text());
    } catch (e) {
      toast('恢复失败：' + (e && e.message ? e.message : '文件无法读取'));
      return;
    }
    confirmRestore(data);
  });
  input.click();
}

function confirmRestore(data) {
  const root = document.getElementById('overlay-root');
  root.innerHTML =
    '<div class="overlay" id="restore-confirm"><div class="sheet">' +
    '<div class="sheet-head"><span class="sheet-title">确认恢复</span>' +
    '<button type="button" class="sheet-close" data-close="restore-confirm" aria-label="关闭">' + iconSVG('x') + '</button></div>' +
    '<p class="pri-desc">备份文件包含 <b>' + data.records.length + '</b> 笔账、<b>' + data.categories.length + '</b> 个分类（导出时间 ' + escapeHTML(String(data.exportedAt || '').slice(0, 10)) + '）。</p>' +
    '<p class="pri-desc" style="color:var(--danger)">恢复会<strong>覆盖当前全部数据</strong>，且无法撤销。确定继续吗？</p>' +
    '<div class="sheet-actions">' +
    '<button type="button" class="btn-ghost" id="restore-cancel">取消</button>' +
    '<button type="button" class="btn-primary" id="restore-ok">确认覆盖导入</button>' +
    '</div></div></div>';
  const overlay = document.getElementById('restore-confirm');
  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('restore-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('restore-ok').addEventListener('click', async () => {
    try {
      await clearAll();
      for (const c of data.categories) await putCategory(c);
      for (const r of data.records) await putRecord(r);
      overlay.remove();
      toast('恢复完成');
      showPage(getCurrentPage());
    } catch (e) {
      toast('恢复失败：' + (e && e.message ? e.message : '未知错误'));
    }
  });
}

async function openCategoryManager() {
  const [records, cats] = await Promise.all([getRecords(), getCategories()]);
  const counts = countByCategory(records);
  const root = document.getElementById('overlay-root');
  root.innerHTML =
    '<div class="overlay" id="cat-manager"><div class="sheet">' +
    '<div class="sheet-head"><span class="sheet-title">分类管理</span>' +
    '<button type="button" class="sheet-close" data-close="cat-manager" aria-label="关闭">' + iconSVG('x') + '</button></div>' +
    '<div id="cat-list"></div>' +
    '<div class="cat-form">' +
    '<input id="cat-name" type="text" placeholder="分类名称（如：宠物）" maxlength="8">' +
    '<div class="cat-colors" id="cat-colors"></div>' +
    '<div class="sheet-actions">' +
    '<button type="button" class="btn-ghost" id="cat-cancel">取消</button>' +
    '<button type="button" class="btn-primary" id="cat-save">新增</button>' +
    '</div></div></div></div>';

  const overlay = document.getElementById('cat-manager');
  overlay.querySelector('[data-close]').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const listEl = document.getElementById('cat-list');
  const nameEl = document.getElementById('cat-name');
  const colorsEl = document.getElementById('cat-colors');
  const saveEl = document.getElementById('cat-save');
  const cancelEl = document.getElementById('cat-cancel');

  let selectedColor = CAT_COLORS[0];
  catEditId = null;

  function renderList() {
    listEl.innerHTML = cats
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(
        (c) =>
          '<div class="cat-manage-row">' +
          '<span class="cat-dot" style="background:' + c.color + '"></span>' +
          '<span class="cat-name">' + escapeHTML(c.name) + '</span>' +
          '<span class="cat-count">' + (counts[c.id] || 0) + ' 笔</span>' +
          '<button type="button" class="mini-btn" data-act="rename" data-id="' + c.id + '">改名</button>' +
          '<button type="button" class="mini-btn danger" data-act="del" data-id="' + c.id + '">删除</button>' +
          '</div>'
      )
      .join('');
    listEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = cats.find((c) => c.id === btn.dataset.id);
        if (!cat) return;
        if (btn.dataset.act === 'rename') {
          catEditId = cat.id;
          nameEl.value = cat.name;
          selectedColor = cat.color;
          renderColors();
          saveEl.textContent = '保存修改';
          nameEl.focus();
        } else if (btn.dataset.act === 'del') {
          deleteCategoryFlow(cat, cats, counts, overlay);
        }
      });
    });
  }

  function renderColors() {
    colorsEl.innerHTML = CAT_COLORS.map(
      (c) =>
        '<button type="button" class="swatch' + (c === selectedColor ? ' on' : '') + '" data-color="' + c + '" style="background:' + c + '" aria-label="颜色"></button>'
    ).join('');
    colorsEl.querySelectorAll('.swatch').forEach((sw) => {
      sw.addEventListener('click', () => {
        selectedColor = sw.dataset.color;
        renderColors();
      });
    });
  }

  cancelEl.addEventListener('click', () => {
    catEditId = null;
    nameEl.value = '';
    saveEl.textContent = '新增';
    renderColors();
  });

  saveEl.addEventListener('click', async () => {
    const name = nameEl.value.trim();
    if (!name) {
      toast('请输入分类名称');
      return;
    }
    if (catEditId) {
      const cat = cats.find((c) => c.id === catEditId);
      if (cat) {
        cat.name = name;
        cat.color = selectedColor;
        await putCategory(cat);
        toast('已修改分类');
      }
      catEditId = null;
      saveEl.textContent = '新增';
    } else {
      const maxOrder = cats.reduce((m, c) => Math.max(m, c.order), 0);
      await putCategory({ id: 'c_' + Date.now(), name, icon: 'circle-ellipsis', color: selectedColor, order: maxOrder + 1, builtin: false });
      cats.push({ id: 'c_' + Date.now(), name, icon: 'circle-ellipsis', color: selectedColor, order: maxOrder + 1, builtin: false });
      toast('已新增分类');
    }
    nameEl.value = '';
    renderList();
  });

  renderList();
  renderColors();
}

async function deleteCategoryFlow(cat, cats, counts, overlay) {
  const n = counts[cat.id] || 0;
  const root = document.getElementById('overlay-root');
  root.innerHTML =
    '<div class="overlay" id="cat-del"><div class="sheet">' +
    '<div class="sheet-head"><span class="sheet-title">删除分类</span>' +
    '<button type="button" class="sheet-close" data-close="cat-del" aria-label="关闭">' + iconSVG('x') + '</button></div>' +
    '<p class="pri-desc">删除「' + escapeHTML(cat.name) + '」后，该分类下 <b>' + n + '</b> 笔账会自动归入「其他」，账目不会丢失。</p>' +
    '<div class="sheet-actions">' +
    '<button type="button" class="btn-ghost" id="cat-del-cancel">取消</button>' +
    '<button type="button" class="btn-primary" id="cat-del-ok">删除</button>' +
    '</div></div></div>';
  const delOverlay = document.getElementById('cat-del');
  delOverlay.querySelector('[data-close]').addEventListener('click', () => delOverlay.remove());
  delOverlay.addEventListener('click', (e) => { if (e.target === delOverlay) delOverlay.remove(); });
  document.getElementById('cat-del-cancel').addEventListener('click', () => delOverlay.remove());
  document.getElementById('cat-del-ok').addEventListener('click', async () => {
    const records = await getRecords();
    const updated = reassignCategory(records, cat.id, 'other');
    for (const r of updated) await putRecord(r);
    await deleteCategory(cat.id);
    delOverlay.remove();
    overlay.remove();
    toast('已删除分类');
    showPage(getCurrentPage());
  });
}

export function init() {
  registerRenderer('home', renderHomePage);
  registerRenderer('stats', renderStatsPage);
  registerRenderer('record', renderRecordPage);
  registerRenderer('settings', renderSettingsPage);
  initIcons();
  bindTabs();
  const dateEl = document.getElementById('topbar-date');
  if (dateEl) dateEl.textContent = todayLabel();
  showPage('home');
}
