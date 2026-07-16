import { useMemo, useState } from "react";
import { useQuizRoomSync } from "../hooks/useQuizRoomSync";

// クイズ大会モード（issue #470）の参加者用入口（閲覧専用）。
// ルームコードの直接入力、または招待URL（?roomId=...）からの参加に対応する。
// ルーム作成（管理者側の導線）はここではなく、通常のかるた読み上げ画面の
// フッターにあるQuizRoomInfoPanel経由で行う（App.jsx参照）

const CONNECTION_STATUS_LABEL = {
  idle: "未接続",
  connecting: "接続中...",
  connected: "接続済み",
  error: "接続できませんでした",
};

function renderParticipantContent(roomState) {
  // ルーム作成直後（まだ一度もupdateStateが呼ばれていない）は、サーバー側の状態が
  // 空オブジェクト{}のままsyncで返ってくる。typeを持たない・未知のtypeの場合は
  // すべて「待機中」として扱い、空白画面にならないようにする
  if (!roomState || !["phrase", "result"].includes(roomState.type)) {
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

function QuizRoomView({ setView, wsBaseUrl }) {
  const urlRoomId = useMemo(() => new URLSearchParams(window.location.search).get("roomId"), []);
  const [joinRoomId, setJoinRoomId] = useState(urlRoomId);
  const [manualRoomId, setManualRoomId] = useState("");

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

  if (joinRoomId) {
    return (
      <div className="container py-5 mx-auto text-center">
        <header className="mb-4">
          <h1 className="h4 fw-bold">クイズ大会モード（参加者）</h1>
          <p className="text-muted small">ルーム: {joinRoomId}</p>
        </header>
        <p className="text-muted small mb-3">接続状態: {CONNECTION_STATUS_LABEL[connectionStatus] || connectionStatus}</p>
        {renderParticipantContent(roomState)}
        <div className="mt-5">
          <button onClick={() => setView("game")} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5 mx-auto">
      <header className="text-center mb-4">
        <h1 className="h4 fw-bold">クイズ大会に参加する</h1>
      </header>
      <main className="mx-auto text-center" style={{ maxWidth: "480px" }}>
        <p className="text-muted small mb-2">ホストから伝えられたルームコードを入力してください</p>
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
        <div className="text-center mt-5">
          <button onClick={() => setView("game")} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
        </div>
      </main>
    </div>
  );
}

export default QuizRoomView;
