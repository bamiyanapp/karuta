import { useState } from "react";
import QuizRoomParticipantTable from "../components/QuizRoomParticipantTable";
import AppVersionInfo from "../components/AppVersionInfo";
import ShareUrlCard from "../components/ShareUrlCard";
import ConfirmDialog from "../components/ConfirmDialog";

// クイズ大会モード（issue #470）の管理者向けルーム情報画面（issue #547）。
// 以前は通常のゲーム画面にインラインで展開する折りたたみパネル
// （components/QuizRoomInfoPanel.jsx）だったが、別画面への遷移に変更した。
// useQuizRoomSync（WebSocket接続）はApp.jsx側のトップレベルで呼ばれており、
// view遷移によってApp自体がアンマウントされることはないため、この画面への
// 遷移中も読み上げ・早押し等のクイズ大会の進行状態は維持される
function QuizRoomInfoView({ setView, roomId, quizRoomParticipants = [], quizRoomPoints = {}, quizRoomAnswerCounts = {}, resetQuizRoomPoints, closeQuizRoom, resumeReading }) {
  const [resuming, setResuming] = useState(false);
  // 確認ダイアログの表示状態（issue #2242）。"reset"・"close"・null（非表示）のいずれか。
  // window.confirmはJavaScriptの実行を止め、WebSocketの同期・音声再生まで止めるため使わない
  const [confirming, setConfirming] = useState(null);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?view=quiz-room&roomId=${roomId}`;

  // ポイントリセット（issue #615）: 同じルームで2ゲーム目を始める際、前のゲームの
  // ポイントを引き継がずに再スタートしたい場合に管理者が明示的に実行する。取り消せない
  // 操作のため確認ダイアログを挟む（ゲームリセット等での自動リセットは行わない。
  // カテゴリを切り替えても通算得点で戦い続けたいユースケースを壊さないため）
  const handleResetPoints = () => {
    resetQuizRoomPoints?.();
    setConfirming(null);
  };

  // ルームを閉じる（issue #748）: 参加者全員が切断され、以後このルームIDでは
  // 再接続できなくなる取り消せない操作のため、ポイントリセットと同様に確認ダイアログを挟む
  const handleCloseRoom = () => {
    closeQuizRoom?.();
    setConfirming(null);
  };

  // かるたを再開する（issue #1267）: セッション復帰直後（selectedCategoriesが未選択）に
  // 開設時のかるた種類を復元し、実際の読み上げ画面へ遷移する。「← 戻る」は、読み上げ中に
  // この画面を開いた場合に元の読み上げ画面へそのまま戻るための既存の導線（issue #547）
  // のままとし、状況によって挙動が変わって分かりにくいという指摘（issue #1262対応時）を
  // 受けてこのボタンへ分離した
  const handleResumeReading = async () => {
    setResuming(true);
    try {
      await resumeReading?.(roomId);
    } finally {
      setResuming(false);
      setView("game");
    }
  };

  return (
    <div className="container py-5 mx-auto text-center">
      <header className="mb-4">
        <h1 className="h4 fw-bold">クイズ大会モードのルーム情報</h1>
      </header>
      <main>
        <ShareUrlCard url={inviteUrl} codeLabel="ルームコード" codeValue={roomId} qrAltText="参加用QRコード" />
        <QuizRoomParticipantTable
          participantNames={quizRoomParticipants}
          points={quizRoomPoints}
          answerCounts={quizRoomAnswerCounts}
          className="mt-5"
          footer={(
            <div className="text-end mt-2">
              <button type="button" onClick={() => setConfirming("reset")} className="btn btn-sm btn-outline-danger">
                ポイントをリセット
              </button>
            </div>
          )}
        />
        <div className="mt-5">
          <button type="button" onClick={() => setConfirming("close")} className="btn btn-sm btn-outline-danger rounded-pill px-3">
            ルームを閉じる
          </button>
        </div>
        <div className="mt-3">
          <button type="button" onClick={handleResumeReading} disabled={resuming} className="btn btn-sm btn-outline-dark rounded-pill px-3">
            {resuming ? "再開中..." : "かるたを再開する"}
          </button>
        </div>
        <div className="mt-3">
          <button onClick={() => setView("game")} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
        </div>
      </main>
      <ConfirmDialog
        open={confirming === "reset"}
        title="ポイントをリセットしますか？"
        message="参加者全員のポイントを0に戻します。元に戻せません。"
        confirmLabel="リセットする"
        onConfirm={handleResetPoints}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "close"}
        title="ルームを閉じますか？"
        message="参加者全員が切断され、このルームには再接続できなくなります。元に戻せません。"
        confirmLabel="閉じて全員を切断する"
        onConfirm={handleCloseRoom}
        onCancel={() => setConfirming(null)}
      />
      <footer>
        <AppVersionInfo />
      </footer>
    </div>
  );
}

export default QuizRoomInfoView;
