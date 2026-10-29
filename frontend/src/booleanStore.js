import { useSyncExternalStore } from "react";

// karuta#1961: gameplayActivity.js・pdfExportStatus.jsが、useSyncExternalStoreを
// 使った単純なboolean store（setter + listeners Set + hookの3点セット）を
// 完全に同型のコードでそれぞれ個別に実装していたため共通化する。
export function createBooleanStore(initialValue = false) {
  let value = initialValue;
  const listeners = new Set();

  function setValue(newValue) {
    value = newValue;
    listeners.forEach((listener) => listener());
  }

  function useValue() {
    return useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => value
    );
  }

  return { setValue, useValue };
}
