import { useEffect, useMemo, useRef, useState } from "react";
import { useQuizRoomSync } from "../hooks/useQuizRoomSync";
import { API_BASE_URL } from "../config";

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

  // issue #490: 音声同期再生は明示的にスコープ外だった（管理者端末でのみ再生）ため、
  // 参加者側は通知（roomState）を受けて自分自身で/get-phraseを呼び直し、取得した
  // 音声を再生する。同じ設定であれば/get-phrase側のPollyキャッシュがヒットするため、
  // 参加者が増えてもPollyの合成コストは増えない。
  // issue #497: ミュート操作は設けず常にオンとする（ブラウザの自動再生ポリシーで
  // 再生自体がブロックされた場合の救済策としてのretryPlaybackのみ用意する）。
  // issue #498: 再生設定（repeatCount/speechRate/lang/voiceId/announceCategory）は
  // 参加者自身のlocalStorageではなく、管理者からのブロードキャスト内容（roomState.content）
  // に含まれる値を使い、全員が管理者と同じ内容で聞こえるようにする
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const lastPlayedKeyRef = useRef(null);
  const lastAudioDataRef = useRef(null);
  const currentAudioRef = useRef(null);

  useEffect(() => {
    if (roomState?.type !== "phrase" || !roomState.content?.id) {
      return;
    }
    const { id, category, repeatCount, speechRate, lang, voiceId, announceCategory } = roomState.content;
    const key = `${category}:${id}`;
    if (lastPlayedKeyRef.current === key) {
      return;
    }
    lastPlayedKeyRef.current = key;

    let cancelled = false;
    (async () => {
      try {
        const apiUrl = `${API_BASE_URL}/get-phrase?id=${id}&category=${encodeURIComponent(category)}&repeatCount=${repeatCount ?? 2}&speechRate=${encodeURIComponent(speechRate ?? "80%")}&lang=${lang ?? "ja"}&voiceId=${encodeURIComponent(voiceId ?? "Mizuki")}&announceCategory=${!!announceCategory}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        if (cancelled || !response.ok || !data.audioData) {
          return;
        }
        lastAudioDataRef.current = data.audioData;
        // 前の札の音声がまだ再生中なら、次の札の音声と重なって再生されないよう止める
        currentAudioRef.current?.pause();
        const audio = new Audio(data.audioData);
        currentAudioRef.current = audio;
        await audio.play();
        if (!cancelled) {
          setPlaybackBlocked(false);
        }
      } catch (error) {
        console.error("Failed to play quiz room audio:", error);
        if (!cancelled) {
          setPlaybackBlocked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomState]);

  // 自動再生がブラウザにブロックされた場合（ユーザー操作を伴わない再生）の救済策。
  // 直近取得済みの音声データをこのクリック操作（ユーザー操作）を起点に再生し直す
  const retryPlayback = () => {
    if (!lastAudioDataRef.current) {
      return;
    }
    const audio = new Audio(lastAudioDataRef.current);
    currentAudioRef.current = audio;
    audio.play()
      .then(() => setPlaybackBlocked(false))
      .catch(() => setPlaybackBlocked(true));
  };

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
        {playbackBlocked && (
          <button onClick={retryPlayback} className="btn btn-sm btn-outline-dark rounded-pill mb-3">
            🔊 タップして音声を有効にする
          </button>
        )}
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
