import { useSyncExternalStore } from "react";

// PwaUpdatePrompt（main.jsxでAppの兄弟としてグローバルにマウントされておりpropsで
// 直接つなげない）に、「絵札PDF印刷画面を開いている間かどうか」を伝えるための
// 最小限のstore（issue #473）。絵札PDFのサーバーサイド生成はバックエンドAPIへの
// 通信が必須でオフラインでは動作しないため、この画面を開いている間に「オフラインで
// 利用可能になりました」という表示が出ると誤解を招く。
// 当初はPDF生成中（fetch/ポーリング中）だけに絞って抑制していたが、それだと
// 画面を開いた直後や生成完了直後にオフライン通知が出るタイミングまでは
// 抑制できず、実際には解消していなかった（issue #473の再オープン）。
// この画面を開いている間ずっと抑制する方が、実際に再現するタイミングをより広く
// カバーできる
let isPrintScreenActive = false;
const listeners = new Set();

export function setPrintScreenActive(value) {
  isPrintScreenActive = value;
  listeners.forEach((listener) => listener());
}

export function useIsPrintScreenActive() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => isPrintScreenActive
  );
}
