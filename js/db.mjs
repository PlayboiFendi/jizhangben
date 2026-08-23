// db.mjs —— 数据层（IndexedDB 封装）：账目记录 + 分类
// 设计为 Promise 风格；浏览器中使用全局 indexedDB，Node 测试中注入模拟实现。

import { dayKey, monthKey } from './stat.mjs';

export const DB_NAME = 'ledger';
export const DB_VERSION = 1;
export const RECORDS_STORE = 'records';
export const CATEGORIES_STORE = 'categories';

export const DEFAULT_CATEGORIES = [
  { id: 'food', name: '餐饮', icon: 'utensils', color: '#e8890c', order: 1, builtin: true },
  { id: 'transport', name: '交通', icon: 'bus', color: '#2f7de1', order: 2, builtin: true },
  { id: 'shopping', name: '购物', icon: 'shopping-bag', color: '#7c5ce0', order: 3, builtin: true },
  { id: 'home', name: '居住', icon: 'house', color: '#0e9f6e', order: 4, builtin: true },
  { id: 'fun', name: '娱乐', icon: 'film', color: '#d6539b', order: 5, builtin: true },
  { id: 'medical', name: '医疗', icon: 'heart-pulse', color: '#d63a3f', order: 6, builtin: true },
  { id: 'other', name: '其他', icon: 'circle-ellipsis', color: '#8b93a0', order: 7, builtin: true },
];

let _dbPromise = null;

function getIDB() {
  if (typeof globalThis.indexedDB === 'undefined') {
    throw new Error('当前环境不支持 IndexedDB');
  }
  return globalThis.indexedDB;
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB 操作失败'));
  });
}

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const idb = getIDB();
    const request = idb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        const store = db.createObjectStore(RECORDS_STORE, { keyPath: 'id' });
        store.createIndex('by_createdAt', 'createdAt');
        store.createIndex('by_day', 'day');
        store.createIndex('by_month', 'month');
      }
      if (!db.objectStoreNames.contains(CATEGORIES_STORE)) {
        const cstore = db.createObjectStore(CATEGORIES_STORE, { keyPath: 'id' });
        DEFAULT_CATEGORIES.forEach((c) => cstore.put(c));
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('打开数据库失败'));
  });
  return _dbPromise;
}

// 单仓库单操作封装：在请求成功时 resolve（不依赖事务完成事件）
function runOp(storeName, mode, run) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], mode);
        const store = tx.objectStore(storeName);
        let req;
        try {
          req = run(store);
        } catch (e) {
          reject(e);
          return;
        }
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('操作失败'));
        tx.onerror = () => reject(tx.error || new Error('事务失败'));
        tx.onabort = () => reject(tx.error || new Error('事务中止'));
      })
  );
}

export function getRecords() {
  return runOp(RECORDS_STORE, 'readonly', (s) => s.getAll());
}

export function getRecord(id) {
  return runOp(RECORDS_STORE, 'readonly', (s) => s.get(id));
}

export function putRecord(rec) {
  return runOp(RECORDS_STORE, 'readwrite', (s) => s.put(rec));
}

export function deleteRecord(id) {
  return runOp(RECORDS_STORE, 'readwrite', (s) => s.delete(id));
}

export function getCategories() {
  return runOp(CATEGORIES_STORE, 'readonly', (s) => s.getAll());
}

export function putCategory(cat) {
  return runOp(CATEGORIES_STORE, 'readwrite', (s) => s.put(cat));
}

export function deleteCategory(id) {
  return runOp(CATEGORIES_STORE, 'readwrite', (s) => s.delete(id));
}

export async function addRecord(data) {
  const amount = Math.round(Number(data.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('金额必须大于 0');
  }
  const catId = String(data.catId || 'other');
  const note = String(data.note || '').trim();
  const app = String(data.app || '').trim();
  const dt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt || Date.now());
  if (Number.isNaN(dt.getTime())) throw new Error('无效的记账时间');
  const rec = {
    id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    amount,
    catId,
    note,
    app,
    createdAt: dt.toISOString(),
    day: dayKey(dt),
    month: monthKey(dt),
  };
  await putRecord(rec);
  return rec;
}

export async function updateRecord(id, patch) {
  const rec = await getRecord(id);
  if (!rec) return null;
  if (patch.amount !== undefined) {
    const amount = Math.round(Number(patch.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('金额必须大于 0');
    rec.amount = amount;
  }
  if (patch.catId !== undefined) rec.catId = String(patch.catId);
  if (patch.note !== undefined) rec.note = String(patch.note).trim();
  if (patch.app !== undefined) rec.app = String(patch.app).trim();
  if (patch.createdAt !== undefined) {
    const dt = patch.createdAt instanceof Date ? patch.createdAt : new Date(patch.createdAt);
    if (Number.isNaN(dt.getTime())) throw new Error('无效的记账时间');
    rec.createdAt = dt.toISOString();
    rec.day = dayKey(dt);
    rec.month = monthKey(dt);
  }
  await putRecord(rec);
  return rec;
}

export function clearAll() {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([RECORDS_STORE, CATEGORIES_STORE], 'readwrite');
        tx.objectStore(RECORDS_STORE).clear();
        tx.objectStore(CATEGORIES_STORE).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('清空失败'));
        tx.onabort = () => reject(tx.error || new Error('清空中止'));
      })
  );
}

export async function resetDatabase() {
  await clearAll();
  for (const c of DEFAULT_CATEGORIES) {
    await putCategory({ ...c });
  }
  return true;
}

// 测试/恢复场景下需要重开连接
export function resetDBConnection() {
  _dbPromise = null;
}
