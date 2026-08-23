// nav.mjs —— 页面与导航定义（纯数据，便于测试）
export const PAGES = ['home', 'stats', 'record', 'settings'];

export const PAGE_TITLES = {
  home: '钱需慢慢攒，心急则亏钱',
  stats: '统计',
  record: '记一笔',
  settings: '设置',
};

export function normalizePage(name) {
  return PAGES.indexOf(name) >= 0 ? name : 'home';
}
