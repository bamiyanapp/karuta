import { useEffect, useState } from "react";
import QRCode from "qrcode";

// QRコード表示＋URLコピーのカードUI。クイズ大会ルーム招待画面（QuizRoomInfoView、
// issue #547）で先に実装されていたものをissue #1429でアプリ共有画面（ShareView）
// と共用できるよう切り出した。shared/ui/ShareButton.jsx（モーダル型）は、
// karutaでは常時表示のUXと合わないため非採用（issue #1168）としており、
// 本コンポーネントはその方針を引き継ぎ常時表示のカードとして実装する
function ShareUrlCard({ url, codeLabel, codeValue, qrAltText = "共有用QRコード" }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url)
      .then(setQrDataUrl)
      .catch((error) => console.error("Failed to generate QR code:", error));
  }, [url]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy URL:", error);
      alert("URLのコピーに失敗しました。お手数ですが手動でコピーしてください。");
    }
  };

  return (
    <div className="p-3 mx-auto shadow-sm rounded-4 bg-light border" style={{ maxWidth: "360px" }}>
      {codeLabel && codeValue && (
        <>
          <p className="text-muted small mb-1">{codeLabel}</p>
          <p className="h3 fw-bold notranslate mb-3">{codeValue}</p>
        </>
      )}
      {qrDataUrl && (
        <img src={qrDataUrl} alt={qrAltText} style={{ width: "180px", height: "180px" }} className="mb-3" />
      )}
      <div className="d-flex gap-2 justify-content-center align-items-center flex-wrap">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="form-control form-control-sm"
          style={{ maxWidth: "220px" }}
        />
        <button type="button" onClick={copyUrl} className="btn btn-sm btn-outline-dark">
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
    </div>
  );
}

export default ShareUrlCard;
