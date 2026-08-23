// url.mjs —— 快捷指令 URL 参数解析/生成（纯函数）
// 约定：?amount=36&note=咖啡&cat=food   （cat 支持分类 id 或分类名）

export function parseShortcutParams(search) {
  const params = new URLSearchParams(search || '');
  const out = {};
  const amount = params.get('amount');
  if (amount) out.amount = amount;
  const note = params.get('note');
  if (note !== null) out.note = note;
  const cat = params.get('cat');
  if (cat) out.cat = cat;
  const app = params.get('app');
  if (app) out.app = app;
  return out;
}

export function buildShortcutURL(base, opts) {
  const u = new URL(base, 'http://localhost/');
  const o = opts || {};
  if (o.amount !== undefined && o.amount !== null && o.amount !== '') {
    u.searchParams.set('amount', String(o.amount));
  }
  if (o.note) u.searchParams.set('note', String(o.note));
  if (o.cat) u.searchParams.set('cat', String(o.cat));
  if (o.app) u.searchParams.set('app', String(o.app));
  return u.toString();
}

// 把快捷指令传入的分类（id 或名字）解析为分类 id
export function resolveCategory(cats, cat) {
  if (!cat) return null;
  const c = cats.find((x) => x.id === cat || x.name === cat);
  return c ? c.id : null;
}
