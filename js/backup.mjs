// backup.mjs —— 备份文件格式与解析（纯函数）
// 备份文件：单个 JSON，含格式版本号，便于以后兼容升级。

export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_APP_NAME = '钱需慢慢攒，心急则亏钱';

export function buildBackup(records, categories, now) {
  const dt = now instanceof Date ? now : new Date(now || Date.now());
  return {
    app: BACKUP_APP_NAME,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: dt.toISOString(),
    records: records.map((r) => ({ ...r })),
    categories: categories.map((c) => ({ ...c })),
  };
}

export function backupToText(backup) {
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('备份文件不是有效的 JSON');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('备份文件格式不正确');
  }
  if (data.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error('备份文件版本不支持：' + String(data.formatVersion));
  }
  if (!Array.isArray(data.records)) throw new Error('备份文件缺少账目数据');
  if (!Array.isArray(data.categories)) throw new Error('备份文件缺少分类数据');
  return data;
}

// 删除分类时：把该分类下的账目改挂到目标分类（默认「其他」），返回新记录数组
export function reassignCategory(records, deletedId, targetId) {
  const target = targetId || 'other';
  return records.map((r) => (r.catId === deletedId ? { ...r, catId: target } : r));
}

export function countByCategory(records) {
  const out = {};
  records.forEach((r) => {
    out[r.catId] = (out[r.catId] || 0) + 1;
  });
  return out;
}
