import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useQuizRoomSync } from "../hooks/useQuizRoomSync";

// クイズ大会モード（issue #470）の最小構成:
// 管理者がルームを開設しQRコード/ルームコードで参加者を招待する。参加者は閲覧専用で、
// 管理者が「次の札」を進めるたびに全端末へ同じ札が同期表示される。
// 読み上げ音声の同期再生・参加者一覧表示は初回リリースのスコープ外（issue本文に明記）。

// シャッフルはFisher-Yatesで実施する（Array.prototype.sortのランダム比較関数は
// 実装依存で偏りが出るため使わない）
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const CONNECTION_STATUS_LABEL = {
  idle: "未接続",
  connecting: "接続中...",
  connected: "接続済み",
  error: "接続できませんでした",
};

function QuizRoomView({ setView, apiBaseUrl, wsBaseUrl }) {
  const urlRoomId = useMemo(() => new URLSearchParams(window.location.search).get("roomId"), []);
  const [joinRoomId, setJoinRoomId] = useState(urlRoomId);
  const [manualRoomId, setManualRoomId] = useState("");

  const [room, setRoom] = useState(null); // { roomId, adminToken }（管理者がルーム作成後にのみ設定される）
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [queue, setQueue] = useState(null); // カテゴリ選択後にシャッフルされた札の配列
  const [queueIndex, setQueueIndex] = useState(0);
  const [loadingPhrase, setLoadingPhrase] = useState(false);

  const [roomState, setRoomState] = useState(null);

  const isAdmin = !joinRoomId;
  const activeRoomId = joinRoomId || room?.roomId || null;

  const { connectionStatus, broadcastState } = useQuizRoomSync({
    wsBaseUrl,
    roomId: activeRoomId,
    adminToken: room?.adminToken,
    onState: setRoomState,
  });

  useEffect(() => {
    if (isAdmin && categories.length === 0 && wsBaseUrl) {
      fetch(`${apiBaseUrl}/get-categories`)
        .then((res) => res.json())
        .then((data) => setCategories(data.categories || []))
        .catch((error) => console.error("Failed to fetch categories:", error));
    }
  }, [isAdmin, categories.length, apiBaseUrl, wsBaseUrl]);

  useEffect(() => {
    if (!room?.roomId) {
      setQrDataUrl(null);
      return;
    }
    const inviteUrl = `${window.location.origin}${window.location.pathname}?view=quiz-room&roomId=${room.roomId}`;
    QRCode.toDataURL(inviteUrl)
      .then(setQrDataUrl)
      .catch((error) => console.error("Failed to generate QR code:", error));
  }, [room]);

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
      setRoom({ roomId: data.roomId, adminToken: data.adminToken });
    } catch (error) {
      console.error("Failed to create quiz room:", error);
      setCreateError("ルームの作成に失敗しました。もう一度お試しください。");
    } finally {
      setCreatingRoom(false);
    }
  };

  const toggleCategory = (name) => {
    setSelectedCategories((prev) => (
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    ));
  };

  const startQuiz = async () => {
    try {
      const results = await Promise.all(
        selectedCategories.map(async (category) => {
          const response = await fetch(`${apiBaseUrl}/get-phrases-list?category=${encodeURIComponent(category)}`);
          const data = await response.json();
          return (data.phrases || []).map((p) => ({ id: p.id, category }));
        })
      );
      const shuffled = shuffle(results.flat());
      setQueue(shuffled);
      setQueueIndex(0);
      broadcastState({ type: "waiting", categoryLabel: selectedCategories.join("・") });
    } catch (error) {
      console.error("Failed to start quiz:", error);
      alert("読み札の取得に失敗しました。もう一度お試しください。");
    }
  };

  const advanceToNextPhrase = async () => {
    if (!queue || queueIndex >= queue.length) {
      return;
    }
    setLoadingPhrase(true);
    try {
      const target = queue[queueIndex];
      const response = await fetch(
        `${apiBaseUrl}/get-phrase?id=${encodeURIComponent(target.id)}&category=${encodeURIComponent(target.category)}` +
        `&repeatCount=2&speechRate=90%25&lang=ja&voiceId=Mizuki&announceCategory=${selectedCategories.length > 1}`
      );
      const phrase = await response.json();
      if (response.ok) {
        if (phrase.audioData) {
          new Audio(phrase.audioData).play().catch((error) => console.error("Audio playback failed:", error));
        }
        broadcastState({
          type: "phrase",
          phrase: {
            id: phrase.id,
            category: phrase.category,
            kana: phrase.kana,
            phrase: phrase.phrase,
            level: phrase.level,
            answer: phrase.answer,
          },
        });
      }
      const nextIndex = queueIndex + 1;
      setQueueIndex(nextIndex);
      if (nextIndex >= queue.length) {
        broadcastState({ type: "finished" });
      }
    } catch (error) {
      console.error("Failed to advance to the next phrase:", error);
      alert("札の取得に失敗しました。もう一度お試しください。");
    } finally {
      setLoadingPhrase(false);
    }
  };

  const renderConnectionStatus = () => (
    <p className="text-muted small mb-3">
      接続状態: {CONNECTION_STATUS_LABEL[connectionStatus] || connectionStatus}
    </p>
  );

  // 参加者（閲覧専用）
  if (!isAdmin) {
    return (
      <div className="container py-5 mx-auto text-center">
        <header className="mb-4">
          <h1 className="h4 fw-bold">クイズ大会モード（参加者）</h1>
          <p className="text-muted small">ルーム: {joinRoomId}</p>
        </header>
        {renderConnectionStatus()}
        {(!roomState || Object.keys(roomState).length === 0) && (
          <p className="text-muted py-5">ホストの操作を待っています...</p>
        )}
        {roomState?.type === "waiting" && (
          <p className="text-muted py-5">まもなく開始します（{roomState.categoryLabel}）...</p>
        )}
        {roomState?.type === "phrase" && (
          <div className="yomifuda-container mx-auto">
            <div className="yomifuda">
              <div className="yomifuda-kana"><span>{roomState.phrase.kana || roomState.phrase.phrase?.[0]}</span></div>
              <div className="yomifuda-phrase">{roomState.phrase.phrase}</div>
              {roomState.phrase.level !== "-" && <div className="yomifuda-level fw-bold">レベル: {roomState.phrase.level}</div>}
            </div>
          </div>
        )}
        {roomState?.type === "finished" && (
          <p className="text-muted py-5">すべての読み札が終わりました。お疲れ様でした！</p>
        )}
      </div>
    );
  }

  // 管理者: ルーム未作成（ロビー画面。ルームコードを直接入力しての参加も許可する）
  if (!room) {
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

  // 管理者: ルーム作成済み
  return (
    <div className="container py-5 mx-auto">
      <header className="text-center mb-4">
        <h1 className="h4 fw-bold">クイズ大会モード（管理者）</h1>
        <p className="h2 fw-bold notranslate">{room.roomId}</p>
        {qrDataUrl && <img src={qrDataUrl} alt="参加用QRコード" style={{ width: "200px", height: "200px" }} />}
        {renderConnectionStatus()}
      </header>

      <main className="mx-auto" style={{ maxWidth: "600px" }}>
        {!queue && (
          <>
            <h2 className="h5 text-center mb-3">出題するかるたの種類を選択してください</h2>
            <div className="d-flex flex-wrap gap-2 justify-content-center mb-4">
              {categories.map((c) => (
                <button
                  key={c.name}
                  onClick={() => toggleCategory(c.name)}
                  className={`btn btn-sm ${selectedCategories.includes(c.name) ? 'btn-dark' : 'btn-outline-dark'}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={startQuiz}
                disabled={selectedCategories.length === 0 || connectionStatus !== "connected"}
                className="btn btn-lg btn-karuta rounded-pill px-4 py-3 fw-bold shadow-sm"
              >
                開始する
              </button>
            </div>
          </>
        )}

        {queue && (
          <div className="text-center">
            <p className="text-muted mb-3">{queueIndex} / {queue.length} 枚</p>
            <button
              onClick={advanceToNextPhrase}
              disabled={loadingPhrase || queueIndex >= queue.length || connectionStatus !== "connected"}
              className="btn btn-lg btn-karuta rounded-pill px-5 py-3 fw-bold shadow-sm"
            >
              {queueIndex >= queue.length ? "終了しました" : (loadingPhrase ? "読み込み中..." : "次の札")}
            </button>
          </div>
        )}
      </main>

      <div className="text-center mt-5">
        <button onClick={() => setView("game")} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
      </div>
    </div>
  );
}

export default QuizRoomView;
