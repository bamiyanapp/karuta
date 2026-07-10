import { useEffect, useRef } from "react";

// activeがtrueの間、画面のスリープを防止する。Wake Lock API未対応環境では何もしない（フィーチャーディテクション）。
// ブラウザはタブが非表示になると自動でロックを解放するため、releaseイベントでsentinelRefをクリアし、
// visibilitychangeで可視状態に戻った際に再取得する。
export function useWakeLock(active) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) {
      return undefined;
    }

    let cancelled = false;

    const requestWakeLock = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release();
          return;
        }
        sentinel.addEventListener("release", () => {
          sentinelRef.current = null;
        });
        sentinelRef.current = sentinel;
      } catch {
        // 端末のバッテリー状態や非アクティブタブなど、リクエストが拒否されるケースがあるため無視する
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && sentinelRef.current === null) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sentinelRef.current?.release();
      sentinelRef.current = null;
    };
  }, [active]);
}
