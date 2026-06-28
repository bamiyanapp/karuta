import '@testing-library/jest-dom';

// Node 22+ がフラグなしの `localStorage` グローバルを提供するが、
// `--localstorage-file` 未指定だと getItem/setItem が機能せず jsdom の実装を覆ってしまう。
// テスト用にメモリ上で動作する localStorage を明示的に補完する。
if (typeof globalThis.localStorage?.setItem !== 'function') {
  class MemoryStorage {
    constructor() {
      this.store = new Map();
    }
    getItem(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    }
    setItem(key, value) {
      this.store.set(key, String(value));
    }
    removeItem(key) {
      this.store.delete(key);
    }
    clear() {
      this.store.clear();
    }
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  });
}
