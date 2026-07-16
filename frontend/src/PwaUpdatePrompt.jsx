import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import "./PwaUpdatePrompt.css";

// オフライン利用可能通知は操作を要求しない情報表示のため、この時間が経てば自動的に消す。
// position: fixedで画面下部に表示されるため、消えずに残り続けると同じ位置にある他の
// クリック可能な要素（例: かるた読み上げ画面フッターのリンク）を覆い、
// クリックをブロックしてしまう不具合があった
const OFFLINE_READY_AUTO_DISMISS_MS = 5000;

// virtual:pwa-register/reactが未提供（テスト等）の場合のフォールバック。
// 毎レンダー新しい関数を作らず安定した参照にすることで、useEffectの依存配列を汚さない
const noop = () => {};

function PwaUpdatePrompt() {
  const sw = useRegisterSW();
  const needRefresh = sw?.needRefresh?.[0] || false;
  const setNeedRefresh = sw?.needRefresh?.[1] || noop;
  const offlineReady = sw?.offlineReady?.[0] || false;
  const setOfflineReady = sw?.offlineReady?.[1] || noop;
  const updateServiceWorker = sw?.updateServiceWorker || noop;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  useEffect(() => {
    if (!offlineReady) {
      return undefined;
    }
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_READY_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh) {
    return (
      <div className="pwa-update-prompt" role="alert">
        <span>新しいバージョンがあります</span>
        <button
          type="button"
          className="pwa-update-prompt-button"
          onClick={() => updateServiceWorker(true)}
        >
          更新する
        </button>
        <button
          type="button"
          className="pwa-update-prompt-button close-button"
          onClick={close}
        >
          閉じる
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
      <div className="pwa-update-prompt" role="alert">
        <span>オフラインで利用可能になりました</span>
        <button
          type="button"
          className="pwa-update-prompt-button close-button"
          onClick={close}
        >
          閉じる
        </button>
      </div>
    );
  }

  return null;
}

export default PwaUpdatePrompt;
