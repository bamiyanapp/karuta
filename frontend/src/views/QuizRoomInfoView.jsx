import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { mergeParticipantsWithPoints } from "../utils/quizRoomParticipants";

// クイズ大会モード（issue #470）の管理者向けルーム情報画面（issue #547）。
// 以前は通常のゲーム画面にインラインで展開する折りたたみパネル
// （components/QuizRoomInfoPanel.jsx）だったが、別画面への遷移に変更した。
// useQuizRoomSync（WebSocket接続）はApp.jsx側のトップレベルで呼ばれており、
// view遷移によってApp自体がアンマウントされることはないため、この画面への
// 遷移中も読み上げ・早押し等のクイズ大会の進行状態は維持される
function QuizRoomInfoView({ setView, roomId, quizRoomParticipants = [], quizRoomPoints = {}, resetQuizRoomPoints }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?view=quiz-room&roomId=${roomId}`;

  useEffect(() => {
    QRCode.toDataURL(inviteUrl)
      .then(setQrDataUrl)
      .catch((error) => console.error("Failed to generate QR code:", error));
  }, [inviteUrl]);

  // 参加者一覧（issue #545）: まだ得点していない参加者も0ptとして含めた1つのリストに
  // 統合して表示する。以前は通常のゲーム画面にインラインで表示していたが、ルーム情報
  // 画面（この画面）の下部へ移動し、表形式に変更した（issue #587）
  const participantList = mergeParticipantsWithPoints(quizRoomParticipants, quizRoomPoints);

  // ポイントリセット（issue #615）: 同じルームで2ゲーム目を始める際、前のゲームの
  // ポイントを引き継がずに再スタートしたい場合に管理者が明示的に実行する。取り消せない
  // 操作のため確認ダイアログを挟む（ゲームリセット等での自動リセットは行わない。
  // カテゴリを切り替えても通算得点で戦い続けたいユースケースを壊さないため）
  const handleResetPoints = () => {
    if (window.confirm("参加者全員のポイントをリセットします。よろしいですか？")) {
      resetQuizRoomPoints?.();
    }
  };

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
    <div className="container py-5 mx-auto text-center">
      <header className="mb-4">
        <h1 className="h4 fw-bold">クイズ大会モードのルーム情報</h1>
      </header>
      <div className="p-3 mx-auto shadow-sm rounded-4 bg-light border" style={{ maxWidth: "360px" }}>
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
      {participantList.length > 0 && (
        <div className="mx-auto mt-5 text-start" style={{ maxWidth: "360px" }}>
          <p className="text-muted small mb-2">参加者一覧</p>
          <table className="table table-sm table-bordered bg-white mb-0">
            <thead>
              <tr>
                <th scope="col">名前</th>
                <th scope="col">接続</th>
                <th scope="col" className="text-end">得点</th>
              </tr>
            </thead>
            <tbody>
              {participantList.map(({ name, points, connected }) => (
                <tr key={name}>
                  <td className="notranslate">{name}</td>
                  <td className={connected ? "text-success" : "text-muted"}>
                    {connected ? "接続中" : "切断済み"}
                  </td>
                  <td className="text-end">{points}pt</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-end mt-2">
            <button type="button" onClick={handleResetPoints} className="btn btn-sm btn-outline-danger">
              ポイントをリセット
            </button>
          </div>
        </div>
      )}
      <div className="mt-5">
        <button onClick={() => setView("game")} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
      </div>
    </div>
  );
}

export default QuizRoomInfoView;
