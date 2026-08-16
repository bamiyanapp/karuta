import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useIsPrintScreenActive } from "./pdfExportStatus";
import { useGameplayActive } from "./gameplayActivity";
import "./PwaUpdatePrompt.css";

// オフライン利用可能通知は操作を要求しない情報表示のため、この時間が経てば自動的に消す。
// position: fixedで画面下部に表示されるため、消えずに残り続けると同じ位置にある他の
// クリック可能な要素（例: かるた読み上げ画面フッターのリンク）を覆い、
// クリックをブロックしてしまう不具合があった
const OFFLINE_READY_AUTO_DISMISS_MS = 5000;

// virtual:pwa-register/reactが未提供（テスト等）の場合のフォールバック。
// 毎レンダー新しい関数を作らず安定した参照にすることで、useEffectの依存配列を汚さない
const noop = () => {};

// virtual:pwa-register/reactが未提供の場合のフォールバック込みで、必要な値・
// 関数一式を取り出す。PwaUpdatePrompt本体の複雑度を抑えるため分離している
function resolveSwState(sw) {
  return {
    needRefresh: sw?.needRefresh?.[0] || false,
    setNeedRefresh: sw?.needRefresh?.[1] || noop,
    offlineReady: sw?.offlineReady?.[0] || false,
    setOfflineReady: sw?.offlineReady?.[1] || noop,
    updateServiceWorker: sw?.updateServiceWorker || noop,
  };
}

function PwaUpdatePrompt() {
  const sw = useRegisterSW();
  const { needRefresh, setNeedRefresh, offlineReady, setOfflineReady, updateServiceWorker } = resolveSwState(sw);
  // 絵札PDF印刷画面（PrintEfudaView）はバックエンドAPIへの通信が必須でオフラインでは
  // 動作しないため、この画面を開いている間に「オフラインで利用可能になりました」を
  // 出すと誤解を招く（issue #473）
  const isPrintScreenActive = useIsPrintScreenActive();
  // issue #1000: プレイ中に「更新する」を押すと、選択中のカテゴリ・読み上げ中の
  // 進行状態を失ったまま即座にページが再読み込みされ、ゲームが中断されてしまう。
  // プレイ中は更新ボタン自体を出さず、プレイを終えて安全なタイミングになってから
  // 更新できるようにする
  const isGameplayActive = useGameplayActive();

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

  if (needRefresh && isGameplayActive) {
    return (
      <div className="pwa-update-prompt" role="status">
        <span>新しいバージョンがあります（プレイ終了後に更新できます）</span>
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

  if (offlineReady && !isPrintScreenActive) {
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
