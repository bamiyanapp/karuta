import { useEffect, useState } from "react";
import "./AddToHomeScreenPrompt.css";

const DISMISSED_STORAGE_KEY = "a2hsPromptDismissed";

const isStandalone = () => {
  return Boolean(window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
};

// iOSのChrome/Firefox/EdgeはUAに専用トークン（CriOS/FxiOS/EdgiOS）を含むため、
// それらを除外することでiOS Safari（ホーム画面追加の案内が必要な対象）のみを判定する
const isIosSafari = () => {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isOtherIosBrowser = /crios|fxios|edgios/i.test(ua);
  return isIos && /safari/i.test(ua) && !isOtherIosBrowser;
};

function AddToHomeScreenPrompt() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_STORAGE_KEY) === "true");
  const [installed, setInstalled] = useState(isStandalone);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosGuide] = useState(isIosSafari);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
    setDismissed(true);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (installed || dismissed) return null;

  if (deferredPrompt) {
    return (
      <div className="a2hs-prompt" role="alert">
        <span>ホーム画面に追加できます</span>
        <div className="a2hs-prompt-buttons">
          <button type="button" className="a2hs-prompt-button" onClick={handleInstallClick}>
            追加する
          </button>
          <button type="button" className="a2hs-prompt-button" onClick={dismiss}>
            閉じる
          </button>
        </div>
      </div>
    );
  }

  if (showIosGuide) {
    return (
      <div className="a2hs-prompt" role="alert">
        <span>共有ボタンから「ホーム画面に追加」を選ぶとアプリのように使えます</span>
        <div className="a2hs-prompt-buttons">
          <button type="button" className="a2hs-prompt-button" onClick={dismiss}>
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default AddToHomeScreenPrompt;
