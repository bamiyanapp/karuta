import { useEffect, useMemo, useRef, useState } from "react";
import { useQuizRoomSync, CONNECTION_STATUS_LABEL } from "../hooks/useQuizRoomSync";
import { useLocalStorageState } from "../hooks/useLocalStorageState";
import { useValueChange } from "../hooks/useValueChange";
import { API_BASE_URL } from "../config";
import { unlockAudioPlayback, playSharedAudio, playQuizSfx, playQuizSfxAndWait, playJudgmentSfx, stopSharedAudio } from "../utils/audioUnlock";
import { phraseKey } from "../utils/phraseKey";
import { clearRoomIdParam } from "../utils/quizRoomUrl";
import AnswerAndExplanation from "../components/AnswerAndExplanation";
import QuizRoomParticipantTable from "../components/QuizRoomParticipantTable";
import Confetti from "../components/Confetti";
import { buildConfettiPieces } from "../utils/confetti";

// クイズ大会モード（issue #470）の参加者用入口（閲覧専用）。
// ルームコードの直接入力、または招待URL（?roomId=...）からの参加に対応する。
// ルーム作成（管理者側の導線）はここではなく、通常のかるた読み上げ画面の
// フッターのボタン→QuizRoomInfoView（issue #547）経由で行う（App.jsx参照）

const MAX_NAME_LENGTH = 20; // backend/quizRoomHandler.jsのMAX_NAME_LENGTHと合わせる（早押し機能、issue #510）
const ROOM_CODE_LENGTH = 6; // backend/quizRoomHandler.jsのROOM_CODE_LENGTHと合わせる（issue #616）
// 参加者名の永続化（issue #697）: ルームごとではなく端末全体で1つの名前を使い回す
// （同じ端末で複数のルームに参加する場合も、毎回同じ名前を入力し直さずに済むようにする）
const PARTICIPANT_NAME_STORAGE_KEY = "quizRoomParticipantName";

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
          {/* 早押し正解時の表示（issue #600）: winnerは正解と判定された回答者名、
              早押しが無かった／不正解のみで終わった場合はnull */}
          {r.winner && (
            <div className="h4 fw-bold text-dark mb-3 notranslate">🎉 {r.winner} さん正解！</div>
          )}
          <div className="text-muted mb-2">所要時間</div>
          <div className="display-4 fw-bold text-dark mb-2">{r.time?.toFixed(2)}<span className="fs-4">秒</span></div>
          <AnswerAndExplanation answer={r.answer} explanation={r.explanation} />
        </div>
      </div>
    );
  }
  return null;
}

// 早押し状態に応じた表示（不正解案内／回答中表示／回答ボタン）を1つに決定する。
// - excludedThisRound: 直前に不正解と判定され、次の札を待っている状態を優先表示する
// - winnerAlreadyShown: result画面側で既に正解者名を表示している間は「回答中」の
//   重複表示を出さない（issue #696）
// レンダー中に評価する早押しラウンドキーの導出（QuizRoomView本体の複雑度を
// 抑えるための純粋関数）。"result"表示中は直前のラウンドキーを維持し、
// それ以外の未知の状態（"initial"等）ではラウンドなし（null）とする
function deriveBuzzRoundKey(roomState, lastBuzzRoundKey) {
  if (roomState?.type === "phrase" && roomState.content?.id) {
    return phraseKey(roomState.content);
  }
  if (roomState?.type !== "result") {
    return null;
  }
  return lastBuzzRoundKey;
}

function renderBuzzStatus({ excludedThisRound, buzzedBy, roomState, onBuzz }) {
  if (excludedThisRound) {
    // issue #680: 不正解と判定された本人には「回答中」ではなく、不正解だった
    // ことと次の札を待つよう案内する専用の表示を出す
    return <p className="fw-bold text-muted mt-4">不正解でした。次の問題まで待っててね</p>;
  }
  const winnerAlreadyShown = roomState?.type === "result" && roomState.content?.winner;
  if (buzzedBy && !winnerAlreadyShown) {
    return <p className="fw-bold text-dark mt-4">🔔 {buzzedBy.name} さんが回答中</p>;
  }
  if (roomState?.type === "phrase") {
    return (
      <div className="mt-4">
        <button onClick={onBuzz} className="btn btn-danger btn-lg rounded-pill px-5">
          回答する
        </button>
      </div>
    );
  }
  return null;
}

function QuizRoomView({ setView, wsBaseUrl, adminSessionRoomId, adminSessionRestoreError, switchToAdminMode }) {
  const urlRoomId = useMemo(() => new URLSearchParams(window.location.search).get("roomId"), []);
  const [joinRoomId, setJoinRoomId] = useState(urlRoomId);
  const [manualRoomId, setManualRoomId] = useState("");
  // ルームコードの事前確認（issue #616）: 存在しない・失効済みのルームコードで
  // 参加しようとした場合、理由不明のままWebSocket接続を5回リトライして
  // 「接続できませんでした」になるのを避けるため、接続を試みる前に軽量なREST
  // チェックで存在を確認する。確認自体が失敗した場合（バックエンド障害等）は
  // 参加をブロックせず、従来どおり接続を試みさせる（安全側にフォールバックする）
  const [roomInvalid, setRoomInvalid] = useState(false);
  // ルームを閉じる（issue #748）: 管理者がルームを閉じると、サーバーから
  // {type: "roomClosed"}が届いたのち強制切断される。理由不明のまま「接続できません
  // でした」表示に落ちるのを避け、終了したことを明示的に案内する
  const [roomClosedNotice, setRoomClosedNotice] = useState(false);

  const [roomState, setRoomState] = useState(null);
  // これまでに読み上げた札の履歴（issue #548）: サーバー側では履歴を保持・配信していない
  // ため、参加者が受信したphrase状態を自分のローカルstateに積み上げて構築する。この方式は
  // 途中から参加した参加者には接続後に読まれた分しか履歴に残らないが、サーバー側の変更
  // （DynamoDBの状態サイズ上限・新規WebSocketメッセージ種別の追加）が不要でシンプルなため
  // 採用した。デフォルト非表示にし、ボタンを押したときだけ開く（管理者側と同じ挙動）
  const [phraseHistory, setPhraseHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // 参加者名の永続化（issue #697）: 以前はconfirmedNameを毎回空文字から始め、
  // 入室のたびに名前入力を必須にしていた（issue #510）が、保存済みの名前があれば
  // それを初期値として採用し、名前入力画面自体をスキップできるようにする
  const [storedParticipantName, setStoredParticipantName] = useLocalStorageState(PARTICIPANT_NAME_STORAGE_KEY, "");
  const [confirmedName, setConfirmedName] = useState(storedParticipantName);
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
  // 回答数集計（issue #698）: 名前→{attempts, correct}のマップ。pointsと同様、
  // 切断・退室後も保持され続ける
  const [answerCounts, setAnswerCounts] = useState({});
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
    clearRoomIdParam();
    setView("game");
  };

  // 誤ったルームコードで参加しようとした場合の再入力導線（issue #616）。
  // goBackと同様にURLの?roomId=を取り除きつつ、通常のゲーム画面へは戻らず
  // この画面のルームコード入力欄に留まる
  const retryRoomCode = () => {
    clearRoomIdParam();
    setRoomInvalid(false);
    setJoinRoomId(null);
    setManualRoomId("");
  };

  // ルームコードの事前確認（issue #616）: joinRoomIdが変わるたびに、前回の
  // 「存在しない」判定を持ち越さないようリセットする
  useValueChange(joinRoomId, () => {
    setRoomInvalid(false);
  });

  // 実際にWebSocket接続を試みる前にGET /quiz-roomで存在確認する
  useEffect(() => {
    if (!joinRoomId) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/quiz-room?roomId=${encodeURIComponent(joinRoomId)}`);
        if (cancelled || !response.ok) {
          // 確認自体が失敗した場合は「存在しない」と断定せず、従来どおり
          // WebSocket接続を試みさせる
          return;
        }
        const data = await response.json();
        if (!cancelled && data.exists === false) {
          setRoomInvalid(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to check quiz room existence:", error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [joinRoomId]);

  // 早押し正誤判定（issue #546）: 不正解と判定されると、サーバーはbuzzを
  // リセットして{type:"roundReset", excludedName}を返す。除外されたのが
  // 自分自身であれば早押しボタンを再表示せず、それ以外の参加者なら
  // buzzedByをクリアして再度早押しできるようにする
  const handleRoundReset = ({ excludedName, answerCounts: nextAnswerCounts }) => {
    // issue #613: 不正解の判定結果を参加者全員に音で伝える（除外された本人以外にとっては
    // 「次に早押しできるようになった」合図でもあるが、判定内容自体は不正解のため同じ音を使う）
    playJudgmentSfx(false).catch(() => {});
    // issue #680: 除外された本人はbuzzedByを残したままにするとexcludedThisRoundが
    // trueになっても表示分岐（下記JSX）でbuzzedByが優先され、「〇〇さんが回答中」の
    // 表示が次の札が届くまで残り続けてしまう。自分自身が不正解と判定されたことを
    // 表す専用の表示に切り替えるため、buzzedByもクリアする
    setBuzzedBy(null);
    if (excludedName === confirmedName) {
      setExcludedThisRound(true);
    }
    // 回答数集計（issue #698）: 不正解判定でもattemptsが増えるため更新する
    if (nextAnswerCounts) {
      setAnswerCounts(nextAnswerCounts);
    }
  };

  const { connectionStatus, setParticipantName, buzz, reconnect } = useQuizRoomSync({
    wsBaseUrl,
    // issue #616: 存在しないルームだと判明した場合はroomIdをnullに落とし、
    // WebSocketの無駄な接続リトライを打ち切る（issue #748: ルームが閉じられた場合も同様）
    roomId: (roomInvalid || roomClosedNotice) ? null : joinRoomId,
    onState: setRoomState,
    onBuzz: (buzzedByParam) => {
      // issue #613: 早押し発生（自分・他の参加者いずれの場合も）を音で通知する
      playQuizSfx("buzz").catch(() => {});
      // issue #800: 従来はhandleBuzz（自分が押した場合のみ）でしか読み上げを
      // 止めておらず、他の参加者が早押ししてもこの端末の読み上げは流れ続けて
      // いた。管理者側（issue #788、誰の早押しでも止める）と揃え、早押しの
      // ブロードキャストを受け取った時点（自分・他の参加者いずれも）で止める
      stopSharedAudio();
      setBuzzedBy(buzzedByParam);
    },
    onPoints: (nextPoints, nextAnswerCounts) => {
      setPoints(nextPoints);
      // 回答数集計（issue #698）: 正解判定時（type:"points"ブロードキャスト）の更新
      if (nextAnswerCounts) {
        setAnswerCounts(nextAnswerCounts);
      }
    },
    onNameError: handleNameError,
    onRoundReset: handleRoundReset,
    onParticipants: setParticipants,
    onRoomClosed: () => setRoomClosedNotice(true),
  });

  // 早押し結果表示のリセット判定（issue #510）。ラウンドを表す値（buzzRoundKey）を
  // 状態種別ごとに導出し、前回と異なれば新しいラウンドとみなしてリセットする。
  // - "phrase": 札ごとの一意キー（同じ札の再ブロードキャスト＝設定変更等では変わらない）
  // - "result": 直前のラウンドキーを維持する（result表示中も回答者表示を残したいため）
  // - それ以外（"initial"等）: ラウンドなし（null）とし、管理者がゲームをリセットした
  //   場合等に、古い回答者情報が次のラウンドへ持ち越されないようにする
  // レンダー中に前回値と比較して直接更新する、Reactが推奨する「レンダー中のstate調整」
  // パターン（useEffect内でのsetStateはeslintのreact-hooks/set-state-in-effectに抵触するため使わない）。
  // issue #800: 同種のパターンはuseValueChangeへ共通化したが、このキーの導出自体が
  // 「直前のラウンドキー（lastBuzzRoundKey）を参照して"result"中は維持する」という
  // 前回値への依存を持つため、値の変化だけを検知するuseValueChangeにはそのまま乗らず、
  // ここでは個別に扱う
  const currentBuzzRoundKey = deriveBuzzRoundKey(roomState, lastBuzzRoundKey);
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

  // 早押しボタン押下時、サーバーからのbuzzブロードキャストが返ってくるまでの間
  // ボタンが非活性化されず連打・二重押下できてしまう問題（issue #588）への対策。
  // 押した瞬間にローカルで即座にbuzzedByを仮設定してボタンを非表示にする。
  // サーバー側は早押しを1件だけ条件付き書き込みで確定させるため（backend/
  // quizRoomHandler.js buzzQuizRoom）実際の勝者判定はサーバーに委ねられており、
  // 後から届くbuzzブロードキャスト（自分の勝ち・他の参加者の勝ちいずれも）が
  // この仮の値を正しい値で上書きする
  const handleBuzz = () => {
    // issue #696: 読み上げ中に回答ボタンが押された場合、読み上げを中断する。
    // サーバーへのbuzz送信・ブロードキャスト受信（onBuzz、issue #800で追加）を
    // 待たず、押した瞬間に即座に止めるためここでも呼ぶ（onBuzz側の呼び出しと
    // 二重になるがstopSharedAudioは冪等なので問題ない）
    stopSharedAudio();
    setBuzzedBy({ name: confirmedName });
    buzz();
  };

  // 早押し正解時の紙吹雪演出（issue #600）。QuizCompletionScreenの読了時演出と
  // 同じComponents/Confetti.jsxを流用する。showCelebrationはresult表示かつ
  // winner（正解と判定された回答者名）がある間だけtrueになり、次のラウンドの
  // 札が届く（roomState.typeが"phrase"に変わる）とfalseに戻るため、ラウンドが
  // 変わるたびに演出が再生成される
  const showCelebration = roomState?.type === "result" && !!roomState.content?.winner;
  const confettiPieces = useMemo(
    () => (showCelebration ? buildConfettiPieces() : []),
    [showCelebration]
  );

  // issue #613: 正解時の演出（紙吹雪）と同じタイミングで、正解の音も鳴らす。
  // showCelebrationはラウンドが変わるたびfalse→trueと切り替わるため、trueに
  // なった瞬間にだけ再生されるようdepsをshowCelebrationのみにする
  useEffect(() => {
    if (showCelebration) {
      playQuizSfx("correct").catch(() => {});
    }
  }, [showCelebration]);

  const handleConfirmName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      return;
    }
    setNameError(null);
    setConfirmedName(trimmed);
    // 参加者名の永続化（issue #697）: 次回以降、この端末での再接続時に
    // 名前入力をスキップできるよう保存する
    setStoredParticipantName(trimmed);
  };

  // 参加者名の永続化（issue #697）: confirmedNameが決まったタイミング（手動確定・
  // 保存済み名前による自動確定のいずれも）でサーバーへ表示名を伝える
  useEffect(() => {
    if (confirmedName) {
      setParticipantName(confirmedName);
    }
  }, [confirmedName, setParticipantName]);

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
  // issue #860: 早押しボタン押下時にstopSharedAudio()を呼んでも、その時点で本編音声が
  // まだ再生開始前（フレーズ取得中・イントロ音再生中）だと何も止まらず、その後に
  // 開始される再生を止める手段が無かった。ラウンドごとにリセットするこのフラグへ
  // 早押し発生（自分・他の参加者いずれも）を記録し、本編再生を開始する直前に
  // 確認することで、開始前の早押しも確実に読み上げを止められるようにする
  const buzzStoppedRef = useRef(false);

  // issue #860: buzzedByは自分の早押し（handleBuzz）・他の参加者の早押し（onBuzz）の
  // いずれでもセットされるため、その変化を検知してbuzzStoppedRefへ反映する。
  // handleBuzz/onBuzz内で直接refへ書き込まないのは、handleBuzzがrenderJoinedRoom()
  // 経由でレンダー中に到達可能なコールパスとして扱われ、react-hooks/refsルール
  // （レンダー中のref書き込み禁止）に抵触するため
  useEffect(() => {
    if (buzzedBy) {
      buzzStoppedRef.current = true;
    }
  }, [buzzedBy]);

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
    const key = phraseKey(roomState.content);
    if (lastPlayedKeyRef.current === key) {
      return;
    }
    lastPlayedKeyRef.current = key;
    // issue #860: 新しいラウンドの再生開始前に、前のラウンドの早押し停止フラグを
    // 必ずリセットする
    buzzStoppedRef.current = false;

    // 名前入力画面（confirmedName未確定）の間は再生しない（issue #530）。
    // 上のlastPlayedKeyRef更新は先に行っているため、名前確定後にこの同じ
    // ラウンドが再度この画面に届いても、遡って再生されることはない
    // （要望どおり「入室後、次の札へ切り替わったタイミング」からの再生になる）
    if (!confirmedName) {
      return;
    }

    // イントロ音（太鼓の音、issue #786）: 管理者は次の札ごとにwadodon.mp3を再生してから
    // 読み上げを始める（useKarutaReading.jsのplayIntroSound）が、参加者側には従来この
    // 演出が無かった。早押し効果音（issue #613）と同じ仕組みの共有<audio>要素を使い、
    // 読み札本編の音声取得・再生とは別に鳴らす。
    // issue #796: 太鼓の音の再生完了を待たずに本編音声の取得・再生を始めていたため、
    // 太鼓の音と読み上げが重なって聞こえてしまっていた。本編音声の「取得」は太鼓の音の
    // 再生と並行して進め（余計な遅延を増やさないため）、「再生開始」だけを太鼓の音の
    // 完了後まで遅らせることで、管理者側（太鼓の音の後に読み上げを始める）と同じ順序にする
    const introPromise = playQuizSfxAndWait("intro");

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
        await introPromise;
        // issue #860: このawait中（フレーズ取得・イントロ音再生の間）に早押しされて
        // いた場合、stopSharedAudio()はまだ再生されていない音声には効かないため、
        // buzzStoppedRefで再生開始自体を取りやめる
        if (cancelled || buzzStoppedRef.current) {
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

  // ルームコード確認済み・参加中の画面。routedViewの複雑度を抑えるため、
  // 別関数として切り出している
  const renderJoinedRoom = () => {
    return (
      <div className="container py-5 mx-auto text-center">
        <Confetti pieces={confettiPieces} />
        <header className="mb-4">
          <h1 className="h4 fw-bold">クイズ大会モード（参加者）</h1>
          <p className="text-muted small">ルーム: {joinRoomId}</p>
        </header>
        {/* 管理者セッション復帰（issue #697）: 保存済みの管理者トークンで管理者への
            切り替えを試みて失敗した場合のエラー表示。この時点で保存済みトークンは
            既に破棄されているため、「管理者に切り替える」ボタン自体も表示されなくなる */}
        {adminSessionRestoreError && <p className="text-danger small mb-3">{adminSessionRestoreError}</p>}
        <p className="text-muted small mb-3">
          <span>接続状態: {CONNECTION_STATUS_LABEL[connectionStatus] || connectionStatus}</span>
          {/* issue #614: 再接続の上限に達した場合、フォアグラウンド復帰・オンライン復帰では
              自動的に再接続を試みるが、それでも復帰しない場合に手動でやり直せる導線が
              無かったため追加する */}
          {connectionStatus === "error" && (
            <button
              type="button"
              onClick={reconnect}
              className="btn btn-sm btn-outline-danger rounded-pill ms-2"
            >
              再接続
            </button>
          )}
        </p>
        <p className="fw-bold text-dark">獲得ポイント: {points[confirmedName] || 0}</p>
        {renderParticipantContent(roomState)}
        {renderBuzzStatus({ excludedThisRound, buzzedBy, roomState, onBuzz: handleBuzz })}
        {/* 参加者一覧（issue #545）: まだ得点していない参加者も0ptとして含めた1つのリストに
            統合して表示する（管理者画面と同じ並び順）。表形式・接続ステータス表示、回答ボタン
            より下への配置はissue #599で対応。回答数（issue #698）: 早押しして正誤判定された
            累計回数（attempts）も併せて表示する */}
        <QuizRoomParticipantTable
          participantNames={participants}
          points={points}
          answerCounts={answerCounts}
          highlightName={confirmedName}
        />
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
        {/* 管理者セッション復帰（issue #697）: このルームの管理者トークンが保存されている
            場合のみ表示する。押すと保存済みトークンで管理者として再接続し、
            管理者画面（QuizRoomInfoView）へ切り替わる */}
        {adminSessionRoomId === joinRoomId && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                if (switchToAdminMode(joinRoomId)) {
                  setView("quiz-room-info");
                }
              }}
              className="btn btn-sm btn-outline-dark rounded-pill px-3"
            >
              管理者に切り替える
            </button>
          </div>
        )}
        <div className="mt-5">
          <button onClick={goBack} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
        </div>
      </div>
    );
  };

  // ルームコード入力前の各種早期リターン・参加中画面。QuizRoomViewコンポーネント
  // 本体の複雑度を抑えるため、該当が無ければnullを返すだけの即時実行関数へまとめている
  const routedView = (() => {
  if (!wsBaseUrl) {
    return (
      <div className="container py-5 mx-auto text-center">
        <p className="text-muted mb-4">クイズ大会モードは現在準備中です。しばらくお待ちください。</p>
        <button onClick={goBack} className="btn btn-outline-dark rounded-pill">← 戻る</button>
      </div>
    );
  }

  // ルームを閉じる（issue #748）: 管理者がルームを閉じた場合、理由不明のまま
  // 「接続できませんでした」表示に落ちるのを避け、終了したことを明示的に案内する
  if (joinRoomId && roomClosedNotice) {
    return (
      <div className="container py-5 mx-auto text-center">
        <header className="mb-4">
          <h1 className="h4 fw-bold">クイズ大会モード（参加者）</h1>
        </header>
        <p className="text-danger mb-4">このルームはホストによって終了されました。</p>
        <button onClick={goBack} className="btn btn-outline-dark rounded-pill">← 戻る</button>
      </div>
    );
  }

  // issue #616: 存在しない・失効済みのルームコードだと判明した場合、原因不明の
  // まま接続リトライを待たせず即座に理由を示す
  if (joinRoomId && roomInvalid) {
    return (
      <div className="container py-5 mx-auto text-center">
        <header className="mb-4">
          <h1 className="h4 fw-bold">クイズ大会モード（参加者）</h1>
        </header>
        <p className="text-danger mb-4">ルームが見つかりませんでした。ルームコードを確認してください。</p>
        <button onClick={retryRoomCode} className="btn btn-outline-dark rounded-pill">コードを入力し直す</button>
        <div className="text-center mt-4">
          <button onClick={goBack} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
        </div>
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

  if (joinRoomId) return renderJoinedRoom();

  return null;
  })();
  if (routedView) return routedView;

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
            maxLength={ROOM_CODE_LENGTH}
            className="form-control"
            style={{ maxWidth: "160px" }}
          />
          <button
            onClick={() => setJoinRoomId(manualRoomId)}
            disabled={manualRoomId.length !== ROOM_CODE_LENGTH}
            className="btn btn-outline-dark rounded-pill"
          >
            参加する
          </button>
        </div>
        {/* issue #616: ルームコードは0/O/1/I/Lを使わない6文字（backend/quizRoomHandler.js
            のROOM_CODE_CHARSと合わせる）ため、読み間違えやすい文字が無い旨を案内する */}
        <p className="text-muted small mt-2">{ROOM_CODE_LENGTH}文字のコードです（0, O, 1, I, L は使用されません）</p>
        <div className="text-center mt-5">
          <button onClick={goBack} className="btn btn-link text-muted text-decoration-none">← 戻る</button>
        </div>
      </main>
    </div>
  );
}

export default QuizRoomView;
