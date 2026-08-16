import { useSyncExternalStore } from "react";

// PwaUpdatePrompt（main.jsxでAppの兄弟としてグローバルにマウントされておりpropsで
// 直接つなげない）に、「かるたを遊んでいる最中かどうか」を伝えるための最小限のstore
// （issue #1000、pdfExportStatus.jsと同じパターン）。プレイ中にPWAの更新プロンプトで
// 「更新する」を押すと即座にページが再読み込みされ、選択中のカテゴリ・読み上げ中の
// 進行状態（audioQueue・isReading等、sessionStorageに永続化されないもの）が失われ、
// ゲームが中断されてしまっていた。プレイ中は「更新する」ボタン自体を出さず、
// プレイを終えて安全なタイミングになってから更新できるようにする
let isGameplayActive = false;
const listeners = new Set();

export function setGameplayActive(value) {
  isGameplayActive = value;
  listeners.forEach((listener) => listener());
}

export function useGameplayActive() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => isGameplayActive
  );
}
