import { useEffect, useState } from "react";
import { API_BASE_URL, WS_BASE_URL } from "../config";
import { useQuizRoomSync } from "./useQuizRoomSync";
import { unlockAudioPlayback, playQuizSfx } from "../utils/audioUnlock";

// クイズ大会モード（issue #470）でuseQuizRoomSyncにonStateを渡す際の既定値。
// 管理者側は自身のゲーム状態が唯一の正であり、サーバーから送り返される状態を
// 使う必要がないため、何もしない関数を安定した参照として渡す
const noop = () => {};

// 開設中ルーム一覧（issue #489）の定期更新間隔。REST GET1本のみで参加者数に
// 応じて増える負荷ではないため、issue #619のsyncポーリングほど頻度を絞る必要はない
const OPEN_ROOMS_POLL_INTERVAL_MS = 15000;

// クイズ大会モードの管理者側ロジック（ルーム作成・開設中ルーム一覧の取得・
// WebSocket接続・早押し判定・状態ブロードキャスト）をまとめたカスタムhook（issue #607）。
// 元々はApp.jsx本体に直接展開されていたが、責務単位で切り出した。
// 参加者側の状態同期・カテゴリ選択・札めくり自体は通常のゲーム画面（App.jsx）を
// そのまま使い、このhookはブロードキャストに必要な最小限の情報（roomId・管理者
// トークン等）のみを扱う
export function useQuizRoomAdmin({
  view,
  selectedCategories,
  displayContent,
  repeatCount,
  speechRate,
  lang,
  voiceId,
  isMultiCategorySelection,
  setView,
  revealCurrentResult,
}) {
  // 管理者としてルームを開設した場合のみ設定される
  const [quizRoom, setQuizRoom] = useState(null); // { roomId, adminToken } | null
  const [creatingQuizRoom, setCreatingQuizRoom] = useState(false);
  const [quizRoomCreateError, setQuizRoomCreateError] = useState(null);
  // トップページ下部に表示する、開設中のクイズ大会ルーム一覧（issue #489）
  const [openQuizRooms, setOpenQuizRooms] = useState([]);
  // 早押し機能（issue #510）: 現在のラウンドで最初に回答した参加者名。次の札が
  // 出題されたらリセットする（下記のブロードキャストeffect内。quizRoomBuzzRoundKeyは
  // QuizRoomView.jsxのbuzzRoundKeyと同じ考え方で、resultの間はリセットしない）
  const [quizRoomBuzzedBy, setQuizRoomBuzzedBy] = useState(null);
  const [quizRoomBuzzRoundKey, setQuizRoomBuzzRoundKey] = useState(null);
  // ポイント制（issue #519）: 名前→累計ポイントのマップ。管理者には参加者ごとの
  // ポイントを一覧表示する
  const [quizRoomPoints, setQuizRoomPoints] = useState({});
  // 参加者一覧（issue #545）: 名前確定済みの参加者名一覧。ポイントと統合して
  // 「参加者名（0pt含む全員）」の1つのリストとして表示する
  const [quizRoomParticipants, setQuizRoomParticipants] = useState([]);

  // クイズ大会モード（issue #489）: トップページ下部に開設中のルーム一覧を表示するため、
  // WebSocket未設定（機能自体が準備中）の場合は取得を試みない。
  // 一覧は初回マウント時だけでなく、他画面から戻る等でトップページへ再度遷移した
  // たびに再取得する（issue #531: 一度取得したきり更新されず古くなる不具合の対応）。
  // さらに、トップページに開きっぱなしのまま（isOnTopPageが変化しないまま）でも、
  // 定期ポーリングとフォアグラウンド復帰時（visibilitychange）の即時再取得により、
  // 他の管理者が新しく開設したルームが自動的に一覧へ反映されるようにする（issue #640）
  const isOnTopPage = view === "game" && selectedCategories.length === 0;
  useEffect(() => {
    if (!WS_BASE_URL || !isOnTopPage) {
      return;
    }
    const fetchOpenQuizRooms = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/quiz-rooms`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        setOpenQuizRooms(data.rooms || []);
      } catch (error) {
        console.error("Failed to fetch open quiz rooms:", error);
      }
    };
    fetchOpenQuizRooms();

    const pollTimer = setInterval(fetchOpenQuizRooms, OPEN_ROOMS_POLL_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchOpenQuizRooms();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isOnTopPage]);

  // クイズ大会モード: quizRoomが設定されている（管理者としてルームを開設した）間だけ接続する
  const {
    connectionStatus: quizRoomConnectionStatus,
    broadcastState: broadcastQuizRoomState,
    judgeBuzz,
    resetPoints: resetQuizRoomPoints,
    reconnect: reconnectQuizRoom,
  } = useQuizRoomSync({
    wsBaseUrl: WS_BASE_URL,
    roomId: quizRoom?.roomId,
    adminToken: quizRoom?.adminToken,
    onState: noop,
    onBuzz: (buzzedBy) => {
      // issue #613: 参加者の早押しを管理者側にも音で通知する
      // issue #679: base: "./"（vite.config.js）でサブパス配下にデプロイされるため、
      // 絶対パス（先頭スラッシュ）だとドメインルート宛になり音声ファイルが見つからず
      // NotSupportedErrorになる。favicon.png等と同じ相対パスにする
      playQuizSfx("buzz", "quiz-buzz.mp3").catch(() => {});
      setQuizRoomBuzzedBy(buzzedBy);
    },
    onPoints: setQuizRoomPoints,
    onParticipants: setQuizRoomParticipants,
  });

  // 早押し正誤判定（issue #546）: 「正解」「不正解」を選んだら判定結果をサーバーへ
  // 送信し、モーダルはローカルで即座に閉じる（roundResetのブロードキャストは
  // 参加者側の早押しボタン復活・除外に使われる）。
  // 正解の場合は、その場でrevealCurrentResult()を呼び、経過時間を「正解が出た
  // タイミング」で確定させ、結果画面（答え表示）へ即座に切り替える（issue #600）。
  // 誰も正解しなかった場合は何もせず、従来どおり「次の札」押下時
  // （App.jsxのplayKarutaInternal）まで経過時間の確定・結果画面切り替えが持ち越される
  const judgeQuizRoomBuzz = async (correct) => {
    const winner = correct ? quizRoomBuzzedBy?.name ?? null : null;
    judgeBuzz(correct);
    setQuizRoomBuzzedBy(null);
    // issue #613: 正誤判定した瞬間に管理者側でも結果を音で確認できるようにする。
    // ボタン押下という実際のユーザー操作の中で呼ぶため、事前のunlockAudioPlayback()
    // なしでも再生できる
    playQuizSfx(correct ? "correct" : "incorrect", correct ? "quiz-correct.mp3" : "quiz-incorrect.mp3").catch(() => {});
    if (correct) {
      await revealCurrentResult(winner);
    }
  };

  // 早押し機能（issue #510）: 新しい札が出題されたら、前のラウンドの回答者表示をリセット
  // する（サーバー側もこの同じタイミングで早押し状態をリセットしている）。ラウンドキーで
  // 判定するのは、設定変更等で同じ札が再ブロードキャストされた際に既に記録済みの回答者
  // 表示を誤って消さないようにするため（resultの間はリセットしない）。
  // レンダー中のstate調整パターン（QuizRoomView.jsxのbuzzRoundKey判定と同じ考え方）で、
  // 副作用を伴わないstate更新はuseEffectを介さずレンダー中に直接行う
  // （react-hooks/set-state-in-effect対策）
  let nextQuizRoomBuzzRoundKey = quizRoomBuzzRoundKey;
  if (quizRoom) {
    if (displayContent.type === "phrase" && displayContent.content) {
      nextQuizRoomBuzzRoundKey = `${displayContent.content.category}:${displayContent.content.id}`;
    } else if (displayContent.type !== "result") {
      nextQuizRoomBuzzRoundKey = null;
    }
  }
  if (nextQuizRoomBuzzRoundKey !== quizRoomBuzzRoundKey) {
    setQuizRoomBuzzRoundKey(nextQuizRoomBuzzRoundKey);
    setQuizRoomBuzzedBy(null);
  }

  // 表示中の札・結果画面が変わるたびクイズ大会モードの参加者へ状態をブロードキャストする。
  // audioData等の重量級フィールドは送らず、表示に必要な項目だけを抜き出す
  // （サーバー側の状態サイズ上限にも抵触しないようにする）
  useEffect(() => {
    if (!quizRoom) {
      return;
    }
    if (displayContent.type === "phrase" && displayContent.content) {
      const p = displayContent.content;
      // 読み上げ設定（issue #498）は、ブロードキャスト時点の最新設定ではなく、この札の
      // 音声を実際に取得した時点の設定（playbackSettings）を使う。読み上げ開始まで数秒の
      // 遅延があり、その間に管理者が設定を変更すると、最新設定を読んでしまうと「管理者が
      // 実際に聞いている音声」とズレるため
      const settings = displayContent.playbackSettings
        ?? { repeatCount, speechRate, lang, voiceId, announceCategory: isMultiCategorySelection };
      broadcastQuizRoomState({
        type: "phrase",
        content: {
          // idを含めるのは、参加者側（issue #490）が自分自身で/get-phraseを呼び直し、
          // 同じ札の音声を取得・再生できるようにするため
          id: p.id, category: p.category, kana: p.kana, phrase: p.phrase, level: p.level, answer: p.answer,
          repeatCount: settings.repeatCount, speechRate: settings.speechRate, lang: settings.lang,
          voiceId: settings.voiceId, announceCategory: settings.announceCategory,
        },
      });
    } else if (displayContent.type === "result" && displayContent.content) {
      const r = displayContent.content;
      broadcastQuizRoomState({
        type: "result",
        // winner: 早押しが正解と判定された場合、その回答者名（issue #600）。
        // 誰も正解しなかった場合（通常の「次の札」による結果表示）はnull
        content: { time: r.time, isFast: r.isFast, difficulty: r.difficulty, answer: r.answer, explanation: r.explanation, winner: r.winner ?? null },
      });
    } else {
      broadcastQuizRoomState({ type: "initial" });
    }
  }, [quizRoom, displayContent, broadcastQuizRoomState, repeatCount, speechRate, lang, voiceId, isMultiCategorySelection]);

  // クイズ大会モード（issue #470）: 通常のかるた読み上げ画面のフッターから直接ルームを作成する
  const createQuizRoom = async () => {
    // issue #613: 早押し発生時（onBuzz）は管理者自身の操作を伴わないため、
    // ここ（ルーム作成というユーザー操作起点の処理）で効果音要素を解錠しておく
    unlockAudioPlayback();
    setCreatingQuizRoom(true);
    setQuizRoomCreateError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/quiz-room`, { method: "POST" });
      if (!response.ok) {
        throw new Error("ルームの作成に失敗しました");
      }
      const data = await response.json();
      setQuizRoom({ roomId: data.roomId, adminToken: data.adminToken });
    } catch (error) {
      console.error("Failed to create quiz room:", error);
      setQuizRoomCreateError("ルームの作成に失敗しました。もう一度お試しください。");
    } finally {
      setCreatingQuizRoom(false);
    }
  };

  // クイズ大会モード（issue #489）: トップページの一覧から直接、参加者としてルームに入る。
  // QuizRoomViewはマウント時に一度だけURLの?roomId=を読むため、view切り替えの前にURLへ反映する
  const joinQuizRoom = (roomId) => {
    // ブラウザの自動再生ポリシー対策（issue #497）: この参加操作（クリック）に
    // 便乗して無音再生しておき、参加後の自動再生が通りやすくする
    unlockAudioPlayback();
    const params = new URLSearchParams(window.location.search);
    params.set("roomId", roomId);
    window.history.pushState({}, "", `?${params.toString()}`);
    setView("quiz-room");
  };

  return {
    quizRoom,
    creatingQuizRoom,
    quizRoomCreateError,
    openQuizRooms,
    quizRoomBuzzedBy,
    quizRoomPoints,
    quizRoomParticipants,
    quizRoomConnectionStatus,
    reconnectQuizRoom,
    resetQuizRoomPoints,
    createQuizRoom,
    joinQuizRoom,
    judgeQuizRoomBuzz,
  };
}
