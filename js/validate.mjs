// validate.mjs —— 金额校验（纯函数）

export function parseAmount(str) {
  const n = Number(str);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function isValidAmount(str) {
  const n = parseAmount(str);
  return n !== null && n > 0;
}

export function sanitizeNote(note) {
  return String(note == null ? '' : note).trim();
}
