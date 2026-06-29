import { useRegisterSW } from "virtual:pwa-register/react";
import "./PwaUpdatePrompt.css";

function PwaUpdatePrompt() {
  const sw = useRegisterSW();
  const needRefresh = sw?.needRefresh?.[0] || false;
  const setNeedRefresh = sw?.needRefresh?.[1] || (() => {});
  const offlineReady = sw?.offlineReady?.[0] || false;
  const setOfflineReady = sw?.offlineReady?.[1] || (() => {});
  const updateServiceWorker = sw?.updateServiceWorker || (() => {});

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

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
