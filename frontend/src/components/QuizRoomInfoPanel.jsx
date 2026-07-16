import { useEffect, useState } from "react";
import QRCode from "qrcode";

// クイズ大会モード（issue #470）: 管理者が通常のゲーム画面から離れずに、参加者を
// 招待するためのルームコード・URL・QRコードを確認できるようにする折りたたみパネル。
// 既存のゲーム画面（読み札表示）はそのまま流用し、フッター末尾にリンクとして
// 追加するだけで済むようにしている
function QuizRoomInfoPanel({ roomId }) {
  const [expanded, setExpanded] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?view=quiz-room&roomId=${roomId}`;

  useEffect(() => {
    if (!expanded) {
      return;
    }
    QRCode.toDataURL(inviteUrl)
      .then(setQrDataUrl)
      .catch((error) => console.error("Failed to generate QR code:", error));
  }, [expanded, inviteUrl]);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy invite URL:", error);
      alert("URLのコピーに失敗しました。お手数ですが手動でコピーしてください。");
    }
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="btn btn-outline-dark px-4 rounded-pill"
      >
        {expanded ? "ルーム情報を隠す" : "ルーム情報を表示（クイズ大会モード）"}
      </button>
      {expanded && (
        <div className="p-3 mx-auto shadow-sm rounded-4 bg-light border text-center" style={{ maxWidth: "360px" }}>
          <p className="text-muted small mb-1">ルームコード</p>
          <p className="h3 fw-bold notranslate mb-3">{roomId}</p>
          {qrDataUrl && (
            <img src={qrDataUrl} alt="参加用QRコード" style={{ width: "180px", height: "180px" }} className="mb-3" />
          )}
          <div className="d-flex gap-2 justify-content-center align-items-center flex-wrap">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.target.select()}
              className="form-control form-control-sm"
              style={{ maxWidth: "220px" }}
            />
            <button type="button" onClick={copyUrl} className="btn btn-sm btn-outline-dark">
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizRoomInfoPanel;
