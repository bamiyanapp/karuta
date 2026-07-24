import { useEffect, useState } from "react";
import { API_BASE_URL, WS_BASE_URL } from "../config";
import { useQuizRoomSync } from "./useQuizRoomSync";
import { unlockAudioPlayback, playQuizSfx } from "../utils/audioUnlock";

// クイズ大会モード（issue #470）でuseQuizRoomSyncにonStateを渡す際の既定値。
// 管理者側は自身のゲーム状態が唯一の正であり、サーバーから送り返される状態を
// 使う必要がないため、何もしない関数を安定した参照として渡す
const noop = () => {};

// 管理者セッション復帰（issue #697）: 管理者トークンをlocalStorageへ保存する際のキー。
// ブラウザ/タブを閉じてもルームへ管理者として復帰できるようにするため、
// createQuizRoom成功時にここへ{roomId, adminToken}を保存する
const ADMIN_SESSION_STORAGE_KEY = "quizRoomAdminSession";

function readStoredAdminSession() {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.roomId === "string" && typeof parsed.adminToken === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function clearStoredAdminSession() {
  try {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // プライベートブラウズ等でlocalStorageが使えない環境では何もしない
  }
}

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
  broadcastPhrase,
  isAllRead,
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
  // 管理者セッション復帰（issue #697）: 保存済みの管理者トークンが指すルームID。
  // QuizRoomView.jsx（参加者画面）側で、このルームIDに一致する場合のみ
  // 「管理者に切り替える」ボタンを表示する
  const [adminSessionRoomId, setAdminSessionRoomId] = useState(() => readStoredAdminSession()?.roomId ?? null);
  const [adminSessionRestoreError, setAdminSessionRestoreError] = useState(null);
  // switchToAdminMode経由で復帰を試みている間だけtrueにする。この間に接続が
  // エラーになった場合のみ「トークンが無効化された」と判断して保存済みトークンを
  // 破棄する（既に管理者として正常稼働中の接続が、一時的なネットワーク不調で
  // エラーになった場合にまで誤ってトークンを破棄しないようにするため）
  const [isRestoringAdminSession, setIsRestoringAdminSession] = useState(false);
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
  // 回答数集計（issue #698）: 名前→{attempts, correct}のマップ。pointsと同様、
  // 切断・退室後も保持され続ける
  const [quizRoomAnswerCounts, setQuizRoomAnswerCounts] = useState({});
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
    closeRoom: closeQuizRoomConnection,
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
    onPoints: (points, answerCounts) => {
      setQuizRoomPoints(points);
      // 回答数集計（issue #698）: 正解判定時（type:"points"ブロードキャスト）の更新
      if (answerCounts) {
        setQuizRoomAnswerCounts(answerCounts);
      }
    },
    onParticipants: setQuizRoomParticipants,
    // 回答数集計（issue #698）: 不正解判定時（type:"roundReset"ブロードキャスト）にも
    // attemptsが増えるため、管理者側もこのイベントでanswerCountsを更新する
    onRoundReset: ({ answerCounts }) => {
      if (answerCounts) {
        setQuizRoomAnswerCounts(answerCounts);
      }
    },
    // ルームを閉じる（issue #748）: 自分自身の操作（closeQuizRoom）・別タブでの操作の
    // いずれで閉じられた場合も同じ経路で受け取り、保存済みセッション・管理者状態を
    // クリアして読み上げ画面へ戻す
    onRoomClosed: () => {
      clearStoredAdminSession();
      setAdminSessionRoomId(null);
      setQuizRoom(null);
      setView("game");
    },
  });

  // 管理者セッション復帰（issue #697）: switchToAdminModeで保存済みトークンを使った
  // 復帰を試みている間、接続が確立できれば復帰成功とみなして監視を終了する。
  // 逆に接続がエラーになった場合は、トークンが無効（ルーム失効・削除済み等）と
  // 判断し、保存済みトークンを破棄したうえで通常の参加者フローへフォールバックする。
  // レンダー中のstate調整パターン（QuizRoomView.jsxのbuzzRoundKey判定と同じ考え方）で、
  // 副作用を伴わないstate更新はuseEffectを介さずレンダー中に直接行う
  // （react-hooks/set-state-in-effect対策）
  const [lastRestoreCheckedStatus, setLastRestoreCheckedStatus] = useState(quizRoomConnectionStatus);
  if (quizRoomConnectionStatus !== lastRestoreCheckedStatus) {
    setLastRestoreCheckedStatus(quizRoomConnectionStatus);
    if (isRestoringAdminSession) {
      if (quizRoomConnectionStatus === "connected") {
        setIsRestoringAdminSession(false);
      } else if (quizRoomConnectionStatus === "error") {
        setIsRestoringAdminSession(false);
        clearStoredAdminSession();
        setAdminSessionRoomId(null);
        setQuizRoom(null);
        setAdminSessionRestoreError("保存されていた管理者情報でルームに接続できませんでした。ルームが終了しているか、情報が無効になっている可能性があります。");
        // quizRoomがnullに戻るとview==="quiz-room-info"の表示条件を満たさなくなる
        // ため、エラーメッセージが表示できる参加者画面（quiz-room）へ明示的に戻す
        setView("quiz-room");
      }
    }
  }

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
  // する（サーバー側もこの同じタイミングで早押し状態をリセットしている）。
  // issue #781: ラウンドキーの確定はdisplayContentではなくbroadcastPhrase（管理者自身の
  // 画面演出より前に確定する値）を基準にする。これにより、管理者の画面がまだ演出中でも
  // 参加者は新しい札に対して早押しできるようになる（下のブロードキャストと同じタイミング）。
  // broadcastPhraseは次の札が出題されるたびに更新され、resetReadingState（ゲームリセット・
  // カテゴリ選び直し）でnullへ戻るため、これだけでresult表示中の保持・リセット時のクリアの
  // 両方が自然に成り立つ（displayContentの型を個別に見る必要がない）
  // レンダー中のstate調整パターン（QuizRoomView.jsxのbuzzRoundKey判定と同じ考え方）で、
  // 副作用を伴わないstate更新はuseEffectを介さずレンダー中に直接行う
  // （react-hooks/set-state-in-effect対策）
  const nextQuizRoomBuzzRoundKey = quizRoom && broadcastPhrase
    ? `${broadcastPhrase.content.category}:${broadcastPhrase.content.id}`
    : null;
  if (nextQuizRoomBuzzRoundKey !== quizRoomBuzzRoundKey) {
    setQuizRoomBuzzRoundKey(nextQuizRoomBuzzRoundKey);
    setQuizRoomBuzzedBy(null);
  }

  // 次の札のブロードキャスト（issue #781）: 管理者自身の画面演出（イントロ音声＋3秒待ち＋
  // フェード、useKarutaReading.js）を待たず、次の札が確定した時点（broadcastPhraseの
  // 更新）で参加者へ先行してブロードキャストする。以前はdisplayContentの更新（演出完了後）
  // を待っていたため、その分だけ参加者側の表示が管理者より遅れていた
  useEffect(() => {
    if (!quizRoom || !broadcastPhrase) {
      return;
    }
    const p = broadcastPhrase.content;
    // 読み上げ設定（issue #498）は、ブロードキャスト時点の最新設定ではなく、この札の
    // 音声を実際に取得した時点の設定（playbackSettings）を使う。読み上げ開始まで数秒の
    // 遅延があり、その間に管理者が設定を変更すると、最新設定を読んでしまうと「管理者が
    // 実際に聞いている音声」とズレるため
    const settings = broadcastPhrase.playbackSettings
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
  }, [quizRoom, broadcastPhrase, broadcastQuizRoomState, repeatCount, speechRate, lang, voiceId, isMultiCategorySelection]);

  // 結果画面・準備画面への切り替わりをクイズ大会モードの参加者へブロードキャストする。
  // 「次の札」への切り替わり（"phrase"）は上のbroadcastPhrase側で既により早いタイミングで
  // 処理済みのため、ここでは扱わない
  useEffect(() => {
    if (!quizRoom || displayContent.type === "phrase") {
      return;
    }
    if (displayContent.type === "result" && displayContent.content) {
      const r = displayContent.content;
      broadcastQuizRoomState({
        type: "result",
        // winner: 早押しが正解と判定された場合、その回答者名（issue #600）。
        // 誰も正解しなかった場合（通常の「次の札」による結果表示）はnull。
        // isAllRead: 選択中カテゴリの全札を読み終えたかどうか（issue #501）。
        // トップページの開設中ルーム一覧で「終了」ステータスを表示するために使う
        content: {
          time: r.time, isFast: r.isFast, difficulty: r.difficulty, answer: r.answer, explanation: r.explanation,
          winner: r.winner ?? null, isAllRead,
        },
      });
    } else {
      broadcastQuizRoomState({ type: "initial" });
    }
  }, [quizRoom, displayContent, isAllRead, broadcastQuizRoomState]);

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
      // 管理者セッション復帰（issue #697）: ブラウザ/タブを閉じても管理者として
      // 復帰できるよう、トークンをlocalStorageへ保存する
      try {
        localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify({ roomId: data.roomId, adminToken: data.adminToken }));
      } catch {
        // プライベートブラウズ等でlocalStorageが使えない環境では保存をあきらめる
        // （復帰できないだけで、今回のセッションでの利用自体には影響しない）
      }
      setAdminSessionRoomId(data.roomId);
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

  // 管理者セッション復帰（issue #697）: 参加者画面（QuizRoomView.jsx）の
  // 「管理者に切り替える」ボタンから呼ばれる。保存済みの管理者トークンが
  // 現在のroomIdに一致する場合のみ管理者として再接続し、trueを返す
  const switchToAdminMode = (roomId) => {
    const stored = readStoredAdminSession();
    if (!stored || stored.roomId !== roomId) {
      return false;
    }
    unlockAudioPlayback();
    setAdminSessionRestoreError(null);
    setIsRestoringAdminSession(true);
    setQuizRoom({ roomId: stored.roomId, adminToken: stored.adminToken });
    return true;
  };

  // ルームを閉じる（issue #748）: ルーム詳細画面（QuizRoomInfoView.jsx）の
  // 「ルームを閉じる」ボタンから呼ばれる。実際の状態クリア（保存済みセッションの
  // 破棄・quizRoomのリセット・画面遷移）はサーバーからのroomClosedブロードキャストを
  // 受けて上記onRoomClosedで行う
  const closeQuizRoom = () => {
    closeQuizRoomConnection();
  };

  return {
    quizRoom,
    creatingQuizRoom,
    quizRoomCreateError,
    openQuizRooms,
    quizRoomBuzzedBy,
    quizRoomPoints,
    quizRoomAnswerCounts,
    quizRoomParticipants,
    quizRoomConnectionStatus,
    reconnectQuizRoom,
    resetQuizRoomPoints,
    createQuizRoom,
    joinQuizRoom,
    judgeQuizRoomBuzz,
    adminSessionRoomId,
    adminSessionRestoreError,
    isRestoringAdminSession,
    switchToAdminMode,
    closeQuizRoom,
  };
}
