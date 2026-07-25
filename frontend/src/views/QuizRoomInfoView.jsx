import { useEffect, useState } from "react";
import QRCode from "qrcode";
import QuizRoomParticipantTable from "../components/QuizRoomParticipantTable";

// クイズ大会モード（issue #470）の管理者向けルーム情報画面（issue #547）。
// 以前は通常のゲーム画面にインラインで展開する折りたたみパネル
// （components/QuizRoomInfoPanel.jsx）だったが、別画面への遷移に変更した。
// useQuizRoomSync（WebSocket接続）はApp.jsx側のトップレベルで呼ばれており、
// view遷移によってApp自体がアンマウントされることはないため、この画面への
// 遷移中も読み上げ・早押し等のクイズ大会の進行状態は維持される
function QuizRoomInfoView({ setView, roomId, quizRoomParticipants = [], quizRoomPoints = {}, quizRoomAnswerCounts = {}, resetQuizRoomPoints, closeQuizRoom }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?view=quiz-room&roomId=${roomId}`;

  useEffect(() => {
    QRCode.toDataURL(inviteUrl)
      .then(setQrDataUrl)
      .catch((error) => console.error("Failed to generate QR code:", error));
  }, [inviteUrl]);

  // ポイントリセット（issue #615）: 同じルームで2ゲーム目を始める際、前のゲームの
  // ポイントを引き継がずに再スタートしたい場合に管理者が明示的に実行する。取り消せない
  // 操作のため確認ダイアログを挟む（ゲームリセット等での自動リセットは行わない。
  // カテゴリを切り替えても通算得点で戦い続けたいユースケースを壊さないため）
  const handleResetPoints = () => {
    if (window.confirm("参加者全員のポイントをリセットします。よろしいですか？")) {
      resetQuizRoomPoints?.();
    }
  };

  // ルームを閉じる（issue #748）: 参加者全員が切断され、以後このルームIDでは
  // 再接続できなくなる取り消せない操作のため、ポイントリセットと同様に確認ダイアログを挟む
  const handleCloseRoom = () => {
    if (window.confirm("このルームを閉じます。参加者全員が切断され、元に戻せません。よろしいですか？")) {
      closeQuizRoom?.();
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
      <QuizRoomParticipantTable
        participantNames={quizRoomParticipants}
        points={quizRoomPoints}
        answerCounts={quizRoomAnswerCounts}
        className="mt-5"
        footer={(
          <div className="text-end mt-2">
            <button type="button" onClick={handleResetPoints} className="btn btn-sm btn-outline-danger">
              ポイントをリセット
            </button>
          </div>
        )}
      />
      <div className="mt-5">
        <button type="button" onClick={handleCloseRoom} className="btn btn-sm btn-outline-danger rounded-pill px-3">
          ルームを閉じる
        </button>
      </div>
      <div className="mt-3">
        <button onClick={() => setView("game")} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
      </div>
    </div>
  );
}

export default QuizRoomInfoView;
