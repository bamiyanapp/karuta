import { useEffect, useMemo, useRef, useState } from "react";
import { useQuizRoomSync } from "../hooks/useQuizRoomSync";
import { API_BASE_URL } from "../config";
import { unlockAudioPlayback, playSharedAudio } from "../utils/audioUnlock";
import { mergeParticipantsWithPoints } from "../utils/quizRoomParticipants";

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

const MAX_NAME_LENGTH = 20; // backend/quizRoomHandler.jsのMAX_NAME_LENGTHと合わせる（早押し機能、issue #510）

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
  // これまでに読み上げた札の履歴（issue #548）: サーバー側では履歴を保持・配信していない
  // ため、参加者が受信したphrase状態を自分のローカルstateに積み上げて構築する。この方式は
  // 途中から参加した参加者には接続後に読まれた分しか履歴に残らないが、サーバー側の変更
  // （DynamoDBの状態サイズ上限・新規WebSocketメッセージ種別の追加）が不要でシンプルなため
  // 採用した。デフォルト非表示にし、ボタンを押したときだけ開く（管理者側と同じ挙動）
  const [phraseHistory, setPhraseHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // 早押し機能（issue #510）: 参加者名は入室のたびに入力してもらう（永続化しない）。
  // confirmedNameが空の間は名前入力画面を表示し、決定後にのみ通常の参加者画面へ進む
  const [confirmedName, setConfirmedName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState(null);
  const [buzzedBy, setBuzzedBy] = useState(null);
  const [lastBuzzRoundKey, setLastBuzzRoundKey] = useState(null);
  // 早押し正誤判定（issue #546）: 不正解と判定された場合、そのラウンド中は
  // 自分だけ早押しボタンを再表示しない
  const [excludedThisRound, setExcludedThisRound] = useState(false);
  // ポイント制（issue #519）: 名前→累計ポイントのマップ。集計単位はconnectionIdではなく
  // name（早押し機能の実装参照）なので、自分のポイントはpoints[confirmedName]で引く
  const [points, setPoints] = useState({});
  // 参加者一覧（issue #545）: 名前確定済みの参加者名一覧。管理者側と同様、ポイントと
  // 統合した1つのリストとして表示する
  const [participants, setParticipants] = useState([]);

  // ポイント制（issue #519）: サーバーは同一ルーム内での名前重複を拒否する。拒否された
  // 場合は名前入力画面に戻し、別の名前を選び直してもらう
  const handleNameError = (message) => {
    setNameError(message);
    setConfirmedName("");
  };

  // 通常のゲーム画面へ戻る（issue #532）。URLに残った?roomId=をそのままにすると、
  // 次にトップページの汎用的な「クイズ大会に参加する」リンクを押した際、
  // QuizRoomViewが再マウント時にこの残留したroomIdを読み取ってしまい、
  // ルームコード入力画面ではなく以前のルームへ入室しようとする画面になってしまう。
  // そのため離脱時に明示的にクエリから取り除く（他のクエリパラメータは保持する）
  const goBack = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("roomId");
    const query = params.toString();
    window.history.pushState({}, "", query ? `?${query}` : window.location.pathname);
    setView("game");
  };

  // 早押し正誤判定（issue #546）: 不正解と判定されると、サーバーはbuzzを
  // リセットして{type:"roundReset", excludedName}を返す。除外されたのが
  // 自分自身であれば早押しボタンを再表示せず、それ以外の参加者なら
  // buzzedByをクリアして再度早押しできるようにする
  const handleRoundReset = ({ excludedName }) => {
    if (excludedName === confirmedName) {
      setExcludedThisRound(true);
    } else {
      setBuzzedBy(null);
    }
  };

  const { connectionStatus, setParticipantName, buzz } = useQuizRoomSync({
    wsBaseUrl,
    roomId: joinRoomId,
    onState: setRoomState,
    onBuzz: setBuzzedBy,
    onPoints: setPoints,
    onNameError: handleNameError,
    onRoundReset: handleRoundReset,
    onParticipants: setParticipants,
  });

  // 早押し結果表示のリセット判定（issue #510）。ラウンドを表す値（buzzRoundKey）を
  // 状態種別ごとに導出し、前回と異なれば新しいラウンドとみなしてリセットする。
  // - "phrase": 札ごとの一意キー（同じ札の再ブロードキャスト＝設定変更等では変わらない）
  // - "result": 直前のラウンドキーを維持する（result表示中も回答者表示を残したいため）
  // - それ以外（"initial"等）: ラウンドなし（null）とし、管理者がゲームをリセットした
  //   場合等に、古い回答者情報が次のラウンドへ持ち越されないようにする
  // レンダー中に前回値と比較して直接更新する、Reactが推奨する「レンダー中のstate調整」
  // パターン（useEffect内でのsetStateはeslintのreact-hooks/set-state-in-effectに抵触するため使わない）
  let currentBuzzRoundKey = lastBuzzRoundKey;
  if (roomState?.type === "phrase" && roomState.content?.id) {
    currentBuzzRoundKey = `${roomState.content.category}:${roomState.content.id}`;
  } else if (roomState?.type !== "result") {
    currentBuzzRoundKey = null;
  }
  if (currentBuzzRoundKey !== lastBuzzRoundKey) {
    setLastBuzzRoundKey(currentBuzzRoundKey);
    setBuzzedBy(null);
    setExcludedThisRound(false);
    // これまでに読み上げた札の履歴（issue #548）: 新しいラウンドの札が届いたタイミングで
    // ローカル履歴に積み上げる（同じ札の再ブロードキャストでは currentBuzzRoundKey が
    // 変わらないため重複追加されない）
    if (roomState?.type === "phrase" && roomState.content) {
      setPhraseHistory(prev => [roomState.content, ...prev]);
    }
  }

  const handleConfirmName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      return;
    }
    setNameError(null);
    setConfirmedName(trimmed);
    setParticipantName(trimmed);
  };

  // issue #490: 音声同期再生は明示的にスコープ外だった（管理者端末でのみ再生）ため、
  // 参加者側は通知（roomState）を受けて自分自身で/get-phraseを呼び直し、取得した
  // 音声を再生する。同じ設定であれば/get-phrase側のPollyキャッシュがヒットするため、
  // 参加者が増えてもPollyの合成コストは増えない。
  // issue #497: ボタン操作は設けず常にオンとする。ブラウザの自動再生ポリシー対策として、
  // トップページのルーム一覧クリック（App.jsxのjoinQuizRoom）での解錠に加え、
  // この画面自体が開かれた後の最初のクリック/タップでも解錠する（下記useEffect。
  // 招待URLからの直接アクセス等、参加操作のクリックを経ない場合の保険）
  // issue #498: 再生設定（repeatCount/speechRate/lang/voiceId/announceCategory）は
  // 参加者自身のlocalStorageではなく、管理者からのブロードキャスト内容（roomState.content）
  // に含まれる値を使い、全員が管理者と同じ内容で聞こえるようにする
  // issue #514: 音声の再生自体は`playSharedAudio`（frontend/src/utils/audioUnlock.js）で
  // ユーザー操作により解錠済みの単一<audio>要素を使い回す。fetch完了後の非同期文脈で
  // 毎回`new Audio(...)`していると、その要素自体はユーザー操作中に一度も再生されておらず、
  // Safari等では再生がブロックされ続けてしまうため
  const lastPlayedKeyRef = useRef(null);

  useEffect(() => {
    if (!wsBaseUrl) {
      return undefined;
    }
    // ルームへの参加操作以外（招待URLからの直接アクセス等）で、ユーザー操作を伴う
    // 参加ボタンのクリックを経ずに画面が開かれた場合の保険。画面内の最初のクリック/
    // タップで解錠しておくことで、その後の自動再生（次の札の通知）が通りやすくなる
    const handleFirstInteraction = () => unlockAudioPlayback();
    document.addEventListener("click", handleFirstInteraction, { once: true });
    document.addEventListener("touchstart", handleFirstInteraction, { once: true });
    return () => {
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, [wsBaseUrl]);

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

    // 名前入力画面（confirmedName未確定）の間は再生しない（issue #530）。
    // 上のlastPlayedKeyRef更新は先に行っているため、名前確定後にこの同じ
    // ラウンドが再度この画面に届いても、遡って再生されることはない
    // （要望どおり「入室後、次の札へ切り替わったタイミング」からの再生になる）
    if (!confirmedName) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const apiUrl = `${API_BASE_URL}/get-phrase?id=${id}&category=${encodeURIComponent(category)}&repeatCount=${repeatCount ?? 2}&speechRate=${encodeURIComponent(speechRate ?? "80%")}&lang=${lang ?? "ja"}&voiceId=${encodeURIComponent(voiceId ?? "Mizuki")}&announceCategory=${!!announceCategory}`;
        const response = await fetch(apiUrl);
        if (cancelled || !response.ok) {
          return;
        }
        const data = await response.json();
        if (cancelled || !data.audioData) {
          return;
        }
        await playSharedAudio(data.audioData);
      } catch (error) {
        console.error("Failed to play quiz room audio:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomState, confirmedName]);

  if (!wsBaseUrl) {
    return (
      <div className="container py-5 mx-auto text-center">
        <p className="text-muted mb-4">クイズ大会モードは現在準備中です。しばらくお待ちください。</p>
        <button onClick={goBack} className="btn btn-outline-dark rounded-pill">← 戻る</button>
      </div>
    );
  }

  if (joinRoomId && !confirmedName) {
    return (
      <div className="container py-5 mx-auto text-center">
        <header className="mb-4">
          <h1 className="h4 fw-bold">クイズ大会モード（参加者）</h1>
        </header>
        <main className="mx-auto text-center" style={{ maxWidth: "360px" }}>
          <p className="text-muted small mb-2">早押し対決で使うお名前を入力してください</p>
          {nameError && <p className="text-danger small mb-2">{nameError}</p>}
          <div className="d-flex gap-2 justify-content-center">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="お名前"
              maxLength={MAX_NAME_LENGTH}
              className="form-control"
              style={{ maxWidth: "200px" }}
            />
            <button
              onClick={handleConfirmName}
              disabled={!nameDraft.trim()}
              className="btn btn-outline-dark rounded-pill"
            >
              決定
            </button>
          </div>
          <div className="text-center mt-5">
            <button onClick={goBack} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
          </div>
        </main>
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
        <p className="fw-bold text-dark">獲得ポイント: {points[confirmedName] || 0}</p>
        {renderParticipantContent(roomState)}
        {(() => {
          // 参加者一覧（issue #545）: まだ得点していない参加者も0ptとして含めた
          // 1つのリストに統合して表示する（管理者画面と同じ並び順）
          const participantList = mergeParticipantsWithPoints(participants, points);
          return participantList.length > 0 && (
            <div className="mx-auto mt-4 text-start" style={{ maxWidth: "320px" }}>
              <p className="text-muted small mb-2">参加者一覧</p>
              <div className="d-flex flex-wrap gap-2 justify-content-center">
                {participantList.map(({ name, points: pt }) => (
                  <div key={name} className="bg-white rounded-3 shadow-sm px-3 py-2">
                    <span className={`notranslate ${name === confirmedName ? "fw-bold" : ""}`}>{name}</span>: {pt}pt
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {buzzedBy ? (
          <p className="fw-bold text-dark mt-4">🔔 {buzzedBy.name} さんが回答しました</p>
        ) : roomState?.type === "phrase" && !excludedThisRound && (
          <div className="mt-4">
            <button onClick={buzz} className="btn btn-danger btn-lg rounded-pill px-5">
              回答する
            </button>
          </div>
        )}
        {phraseHistory.length > 0 && (
          <div className="mx-auto mt-4 text-center" style={{ maxWidth: "480px" }}>
            <button
              type="button"
              onClick={() => setShowHistory(prev => !prev)}
              className="btn btn-sm btn-outline-secondary rounded-pill px-3"
            >
              {showHistory ? "これまでに読み上げた札を閉じる" : `これまでに読み上げた札を表示する（${phraseHistory.length}枚）`}
            </button>
            {showHistory && (
              // 管理者側の「詳細・報告 →」リンク（openDetail、DetailViewへの画面遷移を伴う指摘
              // コメント投稿につながる）はここでは出さず、閲覧専用の簡易表示にとどめる（issue #548）。
              // クイズ大会モードの参加者は端末を共有していない不特定多数のため、管理者専用機能への
              // 導線をそのまま公開する必要はないと判断した
              <div className="text-start mt-3">
                <div className="list-group shadow-sm rounded">
                  {phraseHistory.map((p, index) => (
                    <div key={`${p.category}-${p.id}-${phraseHistory.length - index}`} className="list-group-item d-flex align-items-center">
                      {p.level !== "-" && <span className="badge bg-danger me-2">Lv.{p.level}</span>}
                      <span className="text-dark">{p.phrase}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mt-5">
          <button onClick={goBack} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
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
          <button onClick={goBack} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
        </div>
      </main>
    </div>
  );
}

export default QuizRoomView;
