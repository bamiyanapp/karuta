import { useMemo, useState } from "react";
import { useQuizRoomSync } from "../hooks/useQuizRoomSync";

// クイズ大会モード（issue #470）の入口。
// - 管理者: ルームを作成したら、通常のかるたプレー画面（App.jsxのview="game"）へ遷移する。
//   カテゴリ選択・札めくり・読み上げは既存のゲーム画面をそのまま踏襲し、状態のブロードキャストは
//   App.jsx側（displayContentの変化を監視）で行う。招待用のルームコード・URL・QRコードは
//   ゲーム画面側のQuizRoomInfoPanelから確認する
// - 参加者: 閲覧専用。管理者の状態（初期/出題中/結果）をリアルタイム表示する

const CONNECTION_STATUS_LABEL = {
  idle: "未接続",
  connecting: "接続中...",
  connected: "接続済み",
  error: "接続できませんでした",
};

function renderParticipantContent(roomState) {
  if (!roomState || roomState.type === "initial") {
    return <p className="text-muted py-5">ホストの操作を待っています...</p>;
  }
  if (roomState.type === "phrase" && roomState.content) {
    const p = roomState.content;
    return (
      <div className="yomifuda-container mx-auto">
        <div className="yomifuda">
          <div className="yomifuda-kana"><span>{p.kana || p.phrase?.[0]}</span></div>
          <div className="yomifuda-phrase">{p.phrase}</div>
          {p.level !== "-" && <div className="yomifuda-level fw-bold">レベル: {p.level}</div>}
        </div>
      </div>
    );
  }
  if (roomState.type === "result" && roomState.content) {
    const r = roomState.content;
    return (
      <div className="yomifuda shadow-lg mx-auto">
        <div className="d-flex flex-column justify-content-center align-items-center h-100">
          <div className="text-muted mb-2">所要時間</div>
          <div className="display-4 fw-bold text-dark mb-2">{r.time?.toFixed(2)}<span className="fs-4">秒</span></div>
          {r.answer && r.answer !== "-" && (
            <>
              <div className="text-muted mt-4 mb-2">答え</div>
              <div className="h4 fw-bold text-dark">{r.answer}</div>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
}

function QuizRoomView({ setView, apiBaseUrl, wsBaseUrl, onRoomCreated }) {
  const urlRoomId = useMemo(() => new URLSearchParams(window.location.search).get("roomId"), []);
  const [joinRoomId, setJoinRoomId] = useState(urlRoomId);
  const [manualRoomId, setManualRoomId] = useState("");

  const [creatingRoom, setCreatingRoom] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [roomState, setRoomState] = useState(null);

  const { connectionStatus } = useQuizRoomSync({
    wsBaseUrl,
    roomId: joinRoomId,
    onState: setRoomState,
  });

  if (!wsBaseUrl) {
    return (
      <div className="container py-5 mx-auto text-center">
        <p className="text-muted mb-4">クイズ大会モードは現在準備中です。しばらくお待ちください。</p>
        <button onClick={() => setView("game")} className="btn btn-outline-dark rounded-pill">← 戻る</button>
      </div>
    );
  }

  const createRoom = async () => {
    setCreatingRoom(true);
    setCreateError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/quiz-room`, { method: "POST" });
      if (!response.ok) {
        throw new Error("ルームの作成に失敗しました");
      }
      const data = await response.json();
      onRoomCreated({ roomId: data.roomId, adminToken: data.adminToken });
      setView("game");
    } catch (error) {
      console.error("Failed to create quiz room:", error);
      setCreateError("ルームの作成に失敗しました。もう一度お試しください。");
    } finally {
      setCreatingRoom(false);
    }
  };

  // 参加者（閲覧専用）
  if (joinRoomId) {
    return (
      <div className="container py-5 mx-auto text-center">
        <header className="mb-4">
          <h1 className="h4 fw-bold">クイズ大会モード（参加者）</h1>
          <p className="text-muted small">ルーム: {joinRoomId}</p>
        </header>
        <p className="text-muted small mb-3">接続状態: {CONNECTION_STATUS_LABEL[connectionStatus] || connectionStatus}</p>
        {renderParticipantContent(roomState)}
      </div>
    );
  }

  // ロビー: 管理者としてルームを開設する、またはルームコードを直接入力して参加する
  return (
    <div className="container py-5 mx-auto">
      <header className="text-center mb-4">
        <h1 className="h4 fw-bold">クイズ大会モード</h1>
      </header>
      <main className="mx-auto" style={{ maxWidth: "480px" }}>
        <div className="text-center mb-5">
          <button onClick={createRoom} disabled={creatingRoom} className="btn btn-lg btn-karuta rounded-pill px-4 py-3 fw-bold shadow-sm">
            {creatingRoom ? "作成中..." : "管理者としてルームを開設する"}
          </button>
          {createError && <p className="text-danger small mt-2">{createError}</p>}
        </div>
        <div className="text-center">
          <p className="text-muted small mb-2">ルームコードを知っている場合はこちら</p>
          <div className="d-flex gap-2 justify-content-center">
            <input
              type="text"
              value={manualRoomId}
              onChange={(e) => setManualRoomId(e.target.value.toUpperCase())}
              placeholder="ルームコード"
              className="form-control"
              style={{ maxWidth: "160px" }}
            />
            <button
              onClick={() => setJoinRoomId(manualRoomId)}
              disabled={!manualRoomId}
              className="btn btn-outline-dark rounded-pill"
            >
              参加する
            </button>
          </div>
        </div>
        <div className="text-center mt-5">
          <button onClick={() => setView("game")} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
        </div>
      </main>
    </div>
  );
}

export default QuizRoomView;
