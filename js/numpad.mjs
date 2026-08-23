// numpad.mjs —— 金额数字键盘状态机（纯函数）
// 规则：最多 7 位整数 + 2 位小数；'.' 只能出现一次；'del' 退格

export function applyKey(current, key) {
  const cur = String(current || '');
  if (key === 'del') return cur.slice(0, -1);
  if (key === '.') {
    if (cur.indexOf('.') >= 0) return cur;
    return cur ? cur + '.' : '0.';
  }
  if (!/^[0-9]$/.test(key)) return cur;
  if (cur.replace('.', '').length >= 7) return cur;
  const parts = cur.split('.');
  if (parts.length > 1 && parts[1].length >= 2) return cur;
  return cur + key;
}

export function formatAmount(str) {
  const n = str === '' ? 0 : Number(str);
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
