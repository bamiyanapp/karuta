import { useSyncExternalStore } from "react";

// PrintEfudaView（PDF出力の実行元）とPwaUpdatePrompt（main.jsxでAppの兄弟として
// グローバルにマウントされており、propsで直接つなげない）との間で、
// 「PDF生成中かどうか」だけを共有するための最小限のstore（issue #473）
let isExporting = false;
const listeners = new Set();

export function setPdfExportInProgress(value) {
  isExporting = value;
  listeners.forEach((listener) => listener());
}

export function usePdfExportInProgress() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => isExporting
  );
}
