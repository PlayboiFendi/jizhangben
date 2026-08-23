// stat.mjs —— 日期工具 + 汇总统计（纯函数，可在浏览器与 Node 测试中直接使用）

export function pad2(n) {
  return String(n).padStart(2, '0');
}

// 时间显示：HH:mm（本地时区）
export function fmtTime(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return pad2(dt.getHours()) + ':' + pad2(dt.getMinutes());
}

// 完整时间显示：YYYY-MM-DD HH:mm:ss（本地时区）
export function fmtDateTime(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return (
    dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()) +
    ' ' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + ':' + pad2(dt.getSeconds())
  );
}

// <input type="datetime-local" step="1"> 的 value：本地时间 YYYY-MM-DDTHH:mm:ss
export function toLocalInputValue(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return (
    dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate()) +
    'T' + pad2(dt.getHours()) + ':' + pad2(dt.getMinutes()) + ':' + pad2(dt.getSeconds())
  );
}

// 解析 datetime-local 的值（无时区后缀，按本地时间解析）
export function fromLocalInputValue(s) {
  return new Date(String(s));
}

export function dayKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
}

export function monthKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1);
}

export function todayKey(now) {
  return dayKey(now || new Date());
}

export function currentMonthKey(now) {
  return monthKey(now || new Date());
}

export function monthLabel(key) {
  const parts = String(key).split('-');
  return parts[0] + '年' + parseInt(parts[1], 10) + '月';
}

export function dayLabel(key) {
  const parts = String(key).split('-');
  return parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日';
}

// 今天的日期标签：8月23日 周日
export function todayLabel(now) {
  const dt = now instanceof Date ? now : new Date(now || Date.now());
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dt.getDay()];
  return (dt.getMonth() + 1) + '月' + dt.getDate() + '日 ' + week;
}

// 列表分组显示名：今天 / 昨天 / 8月11日
export function groupLabel(key, today) {
  const t = today || todayKey();
  if (key === t) return '今天';
  const y = new Date(t + 'T00:00:00');
  y.setDate(y.getDate() - 1);
  const yk = dayKey(y);
  if (key === yk) return '昨天';
  return dayLabel(key);
}

// 月份加减：'2026-08' 减 1 -> '2026-07'
export function shiftMonth(month, delta) {
  const parts = String(month).split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

export function sumRecords(records) {
  return Math.round(records.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100;
}

// 预算进度：返回 { amount, left, pct }；budget<=0 或非法时返回 null
export function budgetInfo(total, budget) {
  const b = Number(budget);
  if (!Number.isFinite(b) || b <= 0) return null;
  const t = Number(total) || 0;
  const left = Math.round((b - t) * 100) / 100;
  const pct = t > 0 ? Math.round((t / b) * 100) : 0;
  return { amount: b, left, pct };
}

export function filterByMonth(records, month) {
  return records.filter((r) => r.month === month);
}

export function filterByDay(records, day) {
  return records.filter((r) => r.day === day);
}

// 按日分组，组内时间倒序，组按日期倒序；返回 [{day, label, items, total}]
export function groupRecordsByDay(records, today) {
  const map = new Map();
  records.forEach((r) => {
    if (!map.has(r.day)) map.set(r.day, []);
    map.get(r.day).push(r);
  });
  const groups = Array.from(map.entries()).map(([day, items]) => ({
    day,
    label: groupLabel(day, today),
    items: items.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    total: sumRecords(items),
  }));
  groups.sort((a, b) => (a.day < b.day ? 1 : -1));
  return groups;
}

// 分类占比：返回按金额降序的 [{catId, name, icon, color, total, pct}]
export function categoryBreakdown(records, cats) {
  const totals = new Map();
  records.forEach((r) => {
    totals.set(r.catId, (totals.get(r.catId) || 0) + (Number(r.amount) || 0));
  });
  const grand = sumRecords(records);
  const fallback = { name: '其他', icon: 'circle-ellipsis', color: '#8b93a0' };
  const rows = Array.from(totals.entries()).map(([catId, total]) => {
    const cat = cats.find((c) => c.id === catId) || { id: catId, ...fallback };
    return {
      catId,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      total: Math.round(total * 100) / 100,
      pct: grand > 0 ? Math.round((total / grand) * 100) : 0,
    };
  });
  rows.sort((a, b) => b.total - a.total);
  return rows;
}

// 整月每日支出：每月 1 号到最后一天，[{day, label, total, isToday}]
export function monthDailyBars(records, month, now) {
  const parts = String(month).split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const lastDay = new Date(y, m, 0).getDate();
  const byDay = new Map();
  records.forEach((r) => {
    byDay.set(r.day, (byDay.get(r.day) || 0) + (Number(r.amount) || 0));
  });
  const base = now instanceof Date ? now : new Date(now || Date.now());
  const tk = dayKey(base);
  const out = [];
  for (let d = 1; d <= lastDay; d++) {
    const key = month + '-' + pad2(d);
    out.push({
      day: key,
      label: String(d),
      total: Math.round((byDay.get(key) || 0) * 100) / 100,
      isToday: key === tk,
    });
  }
  return out;
}

// 近 n 天每日支出 [{day, label, total, isToday}]
export function dailyBars(records, n, now) {
  const count = n == null ? 7 : n;
  const base = now instanceof Date ? now : new Date(now || Date.now());
  const byDay = new Map();
  records.forEach((r) => {
    byDay.set(r.day, (byDay.get(r.day) || 0) + (Number(r.amount) || 0));
  });
  const out = [];
  const tk = dayKey(base);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const key = dayKey(d);
    out.push({
      day: key,
      label: d.getMonth() + 1 + '/' + d.getDate(),
      total: Math.round((byDay.get(key) || 0) * 100) / 100,
      isToday: key === tk,
    });
  }
  return out;
}
