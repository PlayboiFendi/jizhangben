// main.mjs —— 入口：初始化 + 快捷指令 URL 参数解析
import { init, openRecordFromShortcut } from './ui.mjs';
import { parseShortcutParams } from './url.mjs';

init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => {
    console.warn('Service Worker 注册失败：', e);
  });
}

const params = parseShortcutParams(window.location.search);
if (params.amount) {
  openRecordFromShortcut(params);
}
