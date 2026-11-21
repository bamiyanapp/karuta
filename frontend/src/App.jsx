import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import "./App.css";
import karutaImage from "./assets/karuta_inubou.png";
import { WS_BASE_URL } from "./config";
import { useLocalStorageState } from "./hooks/useLocalStorageState";
import { useSessionStorageState } from "./hooks/useSessionStorageState";
import { useUrlQuerySync, parseCategoriesParam } from "./hooks/useUrlQuerySync";
import { useWakeLock } from "./hooks/useWakeLock";
import { useThemeSetting } from "./hooks/useThemeSetting";
import { useDocumentTitle } from "./hooks/useDocumentTitle";
import { useCategories } from "./hooks/useCategories";
import { useCategoryPhrases } from "./hooks/useCategoryPhrases";
import { setGameplayActive } from "./gameplayActivity";
import { useKarutaReading } from "./hooks/useKarutaReading";
import { usePlayerScores } from "./hooks/usePlayerScores";
import { useQuizRoomAdmin } from "./hooks/useQuizRoomAdmin";
import DivisionSelectView from "./views/DivisionSelectView";
import CategorySelectView from "./views/CategorySelectView";
import QuizRoomBuzzJudgmentModal from "./components/QuizRoomBuzzJudgmentModal";
import ResultCard from "./components/ResultCard";
import QuizCompletionScreen from "./components/QuizCompletionScreen";
import SettingsFooter from "./components/SettingsFooter";
import AppVersionInfo from "./components/AppVersionInfo";
import StableSwitchLink from "./components/StableSwitchLink";
import QuizRoomActionsPanel from "./components/QuizRoomActionsPanel";
import { NotificationProvider } from "./components/NotificationProvider";
import { useAllPhrasesList } from "./hooks/useAllPhrasesList";
import { usePhraseDetail } from "./hooks/usePhraseDetail";
import { useCategorySelection } from "./hooks/useCategorySelection";

// issue #2186: 最初の画面（division選択）とゲーム画面以外は、画面を開くまで読み込まない。
// react-markdown（更新履歴）・qrcode（共有・ルーム情報）等を、初期バンドルから外すため
const DetailView = lazy(() => import("./views/DetailView"));
const PrintEfudaView = lazy(() => import("./views/PrintEfudaView"));
const AllPhrasesView = lazy(() => import("./views/AllPhrasesView"));
const CommentsView = lazy(() => import("./views/CommentsView"));
const ChangelogView = lazy(() => import("./views/ChangelogView"));
const ShareView = lazy(() => import("./views/ShareView"));
const QuizRoomView = lazy(() => import("./views/QuizRoomView"));
const QuizRoomInfoView = lazy(() => import("./views/QuizRoomInfoView"));

const HISTORY_STORAGE_KEY = "historyByCategory";

// 絵札印刷時に選択できる合計読み札数の上限。PDF生成はバックエンド（renderEfudaPdfWorker、
// ヘッドレスChromiumのpage.pdf()）で行うため、クライアント端末のメモリには依存しなくなった。
// ただし無制限にすると認証なしのAPIに巨大なジョブを投げ放題になってしまうため、
// バックエンド側（backend/efudaPdfHandler.jsのMAX_EFUDA_PRINT_CARDS_SERVER）と
// 同じ値の上限を維持する。こちらは選択UI自体をブロックする一次防御、
// バックエンド側はURL直叩き等を弾く二次防御
const MAX_EFUDA_PRINT_CARDS = 500;

// カテゴリ一覧の再取得後、選択中のカテゴリのうち引き続き存在するものだけへ絞り込む
function filterStillValidCategories(prev, availableNames) {
  if (prev.length === 0) return prev;
  const stillValid = prev.filter(cat => availableNames.includes(cat));
  return stillValid.length !== prev.length ? stillValid : prev;
}

function AppContent() {
  const [division, setDivision] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("division") || null;
  });
  const [selectedCategories, setSelectedCategories] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return parseCategoriesParam(params.get("category"));
  });

  const [detailPhraseId, setDetailPhraseId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
  });

  // 指摘一覧表示用の状態
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") || "game";
  });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  // カテゴリ一覧の取得。取得完了時点で、ゲーム画面を表示していれば、選択中のカテゴリを、
  // 存在するものへ絞り込む。viewRefで「取得完了時点の画面」を参照する
  const categories = useCategories({
    onLoaded: (availableCategories) => {
      if (availableCategories.length > 0 && viewRef.current === "game") {
        const availableNames = availableCategories.map(cat => cat.name);
        setSelectedCategories(prev => filterStillValidCategories(prev, availableNames));
      }
    },
  });

  // 選択中のカテゴリの札一覧。phrasesFetchErrorは、選択中のカテゴリのうち1件でも取得に失敗したか
  // （issue #474。「まだ読み込んでいない」と区別する）
  const { allPhrasesForCategory, phrasesFetchError, retryFetchPhrasesList } = useCategoryPhrases(selectedCategories);
  // 全札一覧画面の取得・ソート・絞り込み・検索（issue #2192）
  const allPhrasesList = useAllPhrasesList(view, categories);
  // issue #2190: 画面の主要な内容の取得失敗を、画面内のエラー表示と再試行で知らせる。
  // 「読み込み中」「0件」と区別するため、失敗の有無を別に持つ。*RetryTokenは再試行ボタンで増やし、
  // 取得のuseEffectを再実行する
  const [repeatCount, setRepeatCount] = useLocalStorageState("repeatCount", 2, (v) => parseInt(v, 10));
  const [cardRevealDelay, setCardRevealDelay] = useLocalStorageState("cardRevealDelay", 3000, (v) => parseInt(v, 10));
  // issue #1001で「ゆっくり」の値を70%→75%へ引き上げたが、既に70%を選択済みだった
  // ユーザーのlocalStorage保存値はそのままでは移行されない（issue #1115）。
  // parse時に旧値を新値へ読み替えることで、次回アクセス時に自動的に反映されるようにする
  const [speechRate, setSpeechRate] = useLocalStorageState("speechRate", "80%", (stored) => (stored === "70%" ? "75%" : stored));
  const [lang, setLang] = useLocalStorageState("lang", "ja");
  const [voiceId, setVoiceId] = useLocalStorageState("voiceId", "Mizuki");
  const [sortOrder, setSortOrder] = useLocalStorageState("sortOrder", "random");
  const { themeSetting, setThemeSetting } = useThemeSetting();
  const [historyByCategory, setHistoryByCategory] = useSessionStorageState(HISTORY_STORAGE_KEY, {});
  // 「これまでに読み上げた札」一覧は、件数が増えると画面が長くなるためデフォルト非表示にし、
  // ボタンを押したときだけ開く（issue #548）
  const [showHistory, setShowHistory] = useState(false);

  // コメント投稿用の状態

  const categoryKey = useMemo(() => {
    return JSON.stringify(selectedCategories.slice().sort());
  }, [selectedCategories]);

  const categoryLabel = useMemo(() => {
    return selectedCategories.join("・");
  }, [selectedCategories]);

  const isMultiCategorySelection = useMemo(() => {
    return selectedCategories.length > 1;
  }, [selectedCategories]);

  // 札の詳細・指摘一覧のデータ（issue #2192）。detailPhraseIdはURL同期のためここに残す
  const {
    detailPhrase,
    detailPhraseCategory,
    detailPhraseComments,
    allComments,
    detailFetchError,
    commentsFetchError,
    retryFetchDetail,
    retryFetchComments,
    commentText,
    setCommentText,
    postingComment,
    postComment,
    openDetail,
    closeDetail,
  } = usePhraseDetail({
    view,
    detailPhraseId,
    setDetailPhraseId,
    repeatCount,
    speechRate,
    lang,
    voiceId,
    isMultiCategorySelection,
  });

  const categoriesForDivision = useMemo(() => {
    if (division !== "kids" && division !== "engineer") return [];
    return categories.filter(cat => cat.group === division);
  }, [categories, division]);

  // かるた選択画面の下書き・決定/印刷ボタン（issue #2192）。division・selectedCategoriesはURL同期のためここに残す
  const {
    draftCategories,
    draftCardCount,
    draftCategoriesRequiringPossessionCheck,
    clearDraftCategories,
    selectDivision,
    goBackToDivisionSelect,
    toggleDraftCategory,
    handleDecideClick,
    handlePrintEfudaClick,
  } = useCategorySelection({
    division,
    setDivision,
    categories,
    setSelectedCategories,
    setView,
    maxPrintCards: MAX_EFUDA_PRINT_CARDS,
  });

  const currentHistory = useMemo(() => {
    return categoryKey ? (historyByCategory[categoryKey] || []) : [];
  }, [categoryKey, historyByCategory]);

  // クイズ大会モードかどうかを、useKarutaReading（useQuizRoomAdminより前に呼ぶ
  // 必要があり、quizRoomをまだ参照できない）へrefで伝える（issue #861）。
  // useQuizRoomAdmin呼び出し後にこのrefへ書き込む
  const quizRoomActiveRef = useRef(false);

  // 読み上げ・札めくり進行（音声再生・タイマー・フェード演出・結果確定）は
  // useKarutaReadingへ切り出した（issue #607）
  const {
    currentPhrase,
    broadcastPhrase,
    displayContent,
    isFadingOut,
    isReading,
    loading,
    isAllRead,
    isReadingLastPhrase,
    playKaruta,
    queueRepeatAudio,
    stopReading,
    revealCurrentResult,
    resetReadingState,
  } = useKarutaReading({
    selectedCategories,
    allPhrasesForCategory,
    categoryKey,
    currentHistory,
    setHistoryByCategory,
    sortOrder,
    repeatCount,
    speechRate,
    lang,
    voiceId,
    isMultiCategorySelection,
    quizRoomActiveRef,
    cardRevealDelay,
  });

  // 「取った人を記録する」参加者登録・スコア集計（issue #518）はusePlayerScoresへ
  // 切り出した（issue #607）
  const {
    players,
    newPlayerName,
    setNewPlayerName,
    showPlayerRegistration,
    setShowPlayerRegistration,
    currentRoundTakenBy,
    scoreSummary,
    addPlayer,
    removePlayer,
    recordTaken,
    resetCategoryScores,
    maxPlayers,
  } = usePlayerScores({ categoryKey, currentPhrase, isAllRead, division });

  // 読了時のセッションサマリー（合計所要時間・最速/最遅の札）
  const sessionSummary = useMemo(() => {
    if (!isAllRead) return null;
    const timedEntries = currentHistory.filter(p => p.elapsedTime && isFinite(parseFloat(p.elapsedTime)));
    if (timedEntries.length === 0) return null;

    const totalTime = timedEntries.reduce((sum, p) => sum + parseFloat(p.elapsedTime), 0);
    const fastest = timedEntries.reduce((a, b) => (parseFloat(b.elapsedTime) < parseFloat(a.elapsedTime) ? b : a));
    const slowest = timedEntries.reduce((a, b) => (parseFloat(b.elapsedTime) > parseFloat(a.elapsedTime) ? b : a));

    return { totalTime, fastest, slowest };
  }, [isAllRead, currentHistory]);

  const EFUDA_PER_PAGE = 10;
  const efudaPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < allPhrasesForCategory.length; i += EFUDA_PER_PAGE) {
      pages.push({ items: allPhrasesForCategory.slice(i, i + EFUDA_PER_PAGE) });
    }
    if (pages.length === 0) pages.push({ items: [] });
    return pages;
  }, [allPhrasesForCategory]);

  const renderSortArrow = (key) => {
      if (allPhrasesList.sortConfig.key === key) {
          return allPhrasesList.sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
      }
      return <span style={{ opacity: 0.3 }}> ⇅</span>;
  };

  // 「もう一度」ボタン・読み札カードのクリック: 詳細画面で開いている札があれば
  // それを、無ければ現在読み上げ中の札を対象にする。実際にキューへ積んで再生する
  // 処理自体はuseKarutaReading側が持つ（issue #607）
  const repeatPhrase = async () => {
    const target = detailPhrase || currentPhrase;
    if (target && target.audioData) {
      queueRepeatAudio(target.audioData);
    }
  };

  useUrlQuerySync({
    selectedCategories,
    division,
    detailPhraseId,
    view,
    setSelectedCategories,
    setDivision,
    setDetailPhraseId,
    setView,
  });

  useWakeLock(view === "game" && selectedCategories.length > 0);

  // PWA更新プロンプト（issue #1000）: プレイ中に「更新する」が押されると、選択中の
  // カテゴリ・読み上げ中の進行状態（sessionStorageに永続化されないもの）を失った
  // まま即座にページが再読み込みされ、ゲームが中断されてしまう。useWakeLockと同じ
  // 「実際に読み上げ画面で遊んでいる最中」の条件をPwaUpdatePromptへ伝え、その間は
  // 更新プロンプトを保留する
  useEffect(() => {
    setGameplayActive(view === "game" && selectedCategories.length > 0);
    return () => setGameplayActive(false);
  }, [view, selectedCategories]);

  // クイズ大会モード（issue #470）の管理者側ロジック（ルーム作成・一覧取得・
  // WebSocket接続・早押し判定・状態ブロードキャスト）はuseQuizRoomAdminへ切り出した
  // （issue #607）。参加者側の状態同期・カテゴリ選択・札めくり自体は通常のゲーム画面
  // （このApp.jsx）をそのまま使う
  const {
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
    closeQuizRoom,
    createQuizRoom,
    joinQuizRoom,
    judgeQuizRoomBuzz,
    adminSessionRoomId,
    adminSessionRestoreError,
    isRestoringAdminSession,
    switchToAdminMode,
    restoreSelectedCategoriesFromRoom,
  } = useQuizRoomAdmin({
    view,
    selectedCategories,
    categories,
    setSelectedCategories,
    setDivision,
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
    stopReading,
  });

  // useKarutaReading（quizRoomActiveRef、issue #861）へ最新のクイズ大会モード状態を
  // 伝える。useKarutaReadingはuseQuizRoomAdminより前に呼ぶ必要があり（useQuizRoomAdmin
  // はuseKarutaReadingの戻り値に依存するため）quizRoomを直接propsとして渡せない
  useEffect(() => {
    quizRoomActiveRef.current = !!quizRoom;
  }, [quizRoom]);

  useDocumentTitle({ view, categoryLabel, detailPhraseId, detailPhrase });

  const resetGame = () => {
    setSelectedCategories([]);
    clearDraftCategories();
    setDetailPhraseId(null);
    resetReadingState();
  };

  const restartCategory = () => {
    setHistoryByCategory(prev => ({
      ...prev,
      [categoryKey]: []
    }));
    resetCategoryScores();
    resetReadingState();
  };

  // かるた選択画面から印刷画面へ直接遷移した場合（issue #636）はカテゴリを
  // まだ「決定」していないため、戻る際はselectedCategoriesを空へ戻し
  // かるた選択画面へ戻す。こども向け（issue #636の検討事項により、ゲーム画面
  // フッターの印刷ボタンを引き続き使う）はゲーム画面から遷移しているため、
  // selectedCategoriesはそのままゲーム画面へ戻す
  const handlePrintEfudaBack = () => {
    if (division === "engineer") {
      setSelectedCategories([]);
    }
    setView("game");
  };

  // ゲーム画面以外の各画面（詳細・絵札印刷・全札一覧・指摘一覧・更新履歴・クイズ大会・
  // division/カテゴリ選択）へのルーティング。Appコンポーネント本体の複雑度を抑えるため、
  // 該当する画面が無ければnullを返すだけの即時実行関数へ分岐をまとめている
  const routedView = (() => {
  if (detailPhraseId) {
    return (
      <DetailView
        detailPhrase={detailPhrase}
        detailPhraseCategory={detailPhraseCategory}
        categoryLabel={categoryLabel}
        closeDetail={closeDetail}
        repeatPhrase={repeatPhrase}
        commentText={commentText}
        setCommentText={setCommentText}
        postComment={postComment}
        postingComment={postingComment}
        detailPhraseComments={detailPhraseComments}
        detailFetchError={detailFetchError}
        onRetryFetchDetail={retryFetchDetail}
      />
    );
  }

  if (view === "print-efuda") {
    return (
      <PrintEfudaView
        categoryLabel={categoryLabel}
        onBack={handlePrintEfudaBack}
        selectedCategories={selectedCategories}
        allPhrasesForCategory={allPhrasesForCategory}
        phrasesFetchError={phrasesFetchError}
        onRetryFetchPhrases={retryFetchPhrasesList}
        efudaPages={efudaPages}
        efudaPerPage={EFUDA_PER_PAGE}
      />
    );
  }

  if (view === "all-phrases") {
    return (
      <AllPhrasesView
        allPhrases={allPhrasesList.allPhrases}
        filterCategory={allPhrasesList.filterCategory}
        setFilterCategory={allPhrasesList.setFilterCategory}
        filterDivision={allPhrasesList.filterDivision}
        setFilterDivision={allPhrasesList.setFilterDivision}
        searchQuery={allPhrasesList.searchQuery}
        setSearchQuery={allPhrasesList.setSearchQuery}
        uniqueCategories={allPhrasesList.visibleCategories}
        categoryCount={allPhrasesList.categoryCount}
        filteredPhrases={allPhrasesList.filteredPhrases}
        renderSortArrow={renderSortArrow}
        handleSort={allPhrasesList.handleSort}
        sortConfig={allPhrasesList.sortConfig}
        openDetail={openDetail}
        setView={setView}
        setSelectedCategories={setSelectedCategories}
        fetchError={allPhrasesList.fetchError}
        onRetryFetch={allPhrasesList.retryFetch}
      />
    );
  }

  if (view === "comments") {
    return (
      <CommentsView
        allComments={allComments}
        setView={setView}
        fetchError={commentsFetchError}
        onRetryFetch={retryFetchComments}
      />
    );
  }

  if (view === "changelog") {
    return <ChangelogView setView={setView} />;
  }

  if (view === "share") {
    return <ShareView setView={setView} />;
  }

  if (view === "quiz-room") {
    return (
      <QuizRoomView
        setView={setView}
        wsBaseUrl={WS_BASE_URL}
        adminSessionRoomId={adminSessionRoomId}
        adminSessionRestoreError={adminSessionRestoreError}
        switchToAdminMode={switchToAdminMode}
      />
    );
  }

  // ルーム情報（ルームコード・QRコード・招待URL）表示は、以前は通常のゲーム画面内の
  // インラインパネルだったが、別画面への遷移に変更した（issue #547）。quizRoomが
  // 未設定（ページリロード等でstateが失われ、URLにこのviewだけが残っている場合）は
  // 通常のゲーム画面へフォールスルーする
  if (view === "quiz-room-info" && quizRoom) {
    return (
      <>
        <QuizRoomInfoView
          setView={setView}
          roomId={quizRoom.roomId}
          quizRoomParticipants={quizRoomParticipants}
          quizRoomPoints={quizRoomPoints}
          quizRoomAnswerCounts={quizRoomAnswerCounts}
          resetQuizRoomPoints={resetQuizRoomPoints}
          closeQuizRoom={closeQuizRoom}
          resumeReading={restoreSelectedCategoriesFromRoom}
        />
        {/* issue #613: 早押し判定モーダルはこの画面を開いている間も表示する
            （以前はゲーム画面のレンダー内にしか存在せず、この画面滞在中は
            参加者が早押ししても管理者が気づけなかった） */}
        <QuizRoomBuzzJudgmentModal
          buzzedBy={quizRoomBuzzedBy}
          answer={currentPhrase?.answer}
          explanation={currentPhrase?.explanation}
          onJudge={judgeQuizRoomBuzz}
        />
      </>
    );
  }

  if (selectedCategories.length === 0 && !division) {
    return (
      <DivisionSelectView
        openQuizRooms={openQuizRooms}
        joinQuizRoom={joinQuizRoom}
        selectDivision={selectDivision}
        setView={setView}
      />
    );
  }

  if (selectedCategories.length === 0) {
    return (
      <CategorySelectView
        division={division}
        categories={categories}
        categoriesForDivision={categoriesForDivision}
        draftCategories={draftCategories}
        draftCardCount={draftCardCount}
        draftCategoriesRequiringPossessionCheck={draftCategoriesRequiringPossessionCheck}
        maxEfudaPrintCards={MAX_EFUDA_PRINT_CARDS}
        goBackToDivisionSelect={goBackToDivisionSelect}
        toggleDraftCategory={toggleDraftCategory}
        handleDecideClick={handleDecideClick}
        handlePrintEfudaClick={handlePrintEfudaClick}
        setView={setView}
      />
    );
  }

  return null;
  })();
  if (routedView) return routedView;

  const renderPhrase = (phrase) => {
    if (!phrase) return null;
    return (
        <div
          className={`yomifuda ${division === "kids" ? "yomifuda-kids" : ""}`}
          onClick={repeatPhrase}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); repeatPhrase(); } }}
          role="button"
          tabIndex={0}
          aria-label="もう一度"
        >
            <div className="yomifuda-kana"><span>{phrase.kana || (phrase.phrase && phrase.phrase[0])}</span></div>
            <div className="yomifuda-phrase">{phrase.phrase}</div>
            {phrase.level !== "-" && <div className="yomifuda-level fw-bold">レベル: {phrase.level}</div>}
        </div>
    );
  }

  const renderInitial = () => {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center text-muted h-100">
        <img src={karutaImage} alt="準備完了" className="mb-3" style={{ width: "120px", opacity: 0.8 }} />
        <div className="fw-bold">準備完了</div>
        <small className="mt-2">「次の札を読み上げる」ボタンを押して開始してください<br/>
        読み上げのオプションは下部から設定してください</small>
      </div>
    )
  }

  // ゲーム画面本体（読了後のお祝い画面 or 読み札カード＋操作ボタン）。
  // Appコンポーネント本体の複雑度を抑えるため、別関数として切り出している
  const renderGameMain = () => {
    if (isAllRead) {
      return (
        <QuizCompletionScreen
          sessionSummary={sessionSummary}
          scoreSummary={scoreSummary}
          restartCategory={restartCategory}
        />
      );
    }
    return (
      <>
        <div className={`yomifuda-container mb-4 ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
          {displayContent.type === 'phrase' && renderPhrase(displayContent.content)}
          {displayContent.type === 'result' && <ResultCard result={displayContent.content} division={division} />}
          {displayContent.type === 'initial' && renderInitial()}
        </div>

        {displayContent.type === 'phrase' && division !== "kids" && players.length > 0 && (
          <div className="mb-4">
            <div className="text-muted small mb-2">取った人:</div>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              {players.map(name => (
                <button
                  key={name}
                  onClick={() => recordTaken(name)}
                  className={`btn btn-sm rounded-pill px-3 ${currentRoundTakenBy === name ? 'btn-dark' : 'btn-outline-dark'}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="d-flex flex-wrap gap-3 justify-content-center mb-5">
          <button onClick={playKaruta} disabled={loading || isReadingLastPhrase} className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow btn-karuta">
            {loading && <span className="spinner-border spinner-border-sm me-2"></span>}
            {loading ? "読み込み中..." : "次の札"}
          </button>
          <button onClick={repeatPhrase} disabled={isReading || !currentPhrase} className="btn btn-lg px-4 py-3 fw-bold rounded-pill border-3 border-dark bg-white text-dark shadow-sm">もう一度</button>
          <button onClick={stopReading} disabled={!isReading} className="btn btn-lg px-4 py-3 fw-bold rounded-pill border-3 border-danger bg-white text-danger shadow-sm">停止</button>
        </div>
      </>
    );
  };

  return (
    <div className="container py-4 mx-auto">
      <header className="text-center mb-4">
        <h1 className="h2 fw-bold text-dark notranslate">{categoryLabel}</h1>
        {!isAllRead && allPhrasesForCategory.length > 0 && (() => {
          const readCount = Math.min(currentHistory.length, allPhrasesForCategory.length);
          return (
            <div className="mt-2 mx-auto" style={{ maxWidth: "300px" }}>
              <div className="text-muted small mb-1">
                読み上げ済み {readCount} / 全{allPhrasesForCategory.length}枚
              </div>
              <div
                className="progress"
                style={{ height: "8px" }}
                role="progressbar"
                aria-label="読み上げ進捗"
                aria-valuenow={readCount}
                aria-valuemin={0}
                aria-valuemax={allPhrasesForCategory.length}
              >
                <div
                  className="progress-bar progress-bar-karuta"
                  style={{ width: `${(readCount / allPhrasesForCategory.length) * 100}%` }}
                ></div>
              </div>
            </div>
          );
        })()}
      </header>

      {/* issue #472: PC・タブレット等の横長画面（Bootstrapのlgブレークポイント、992px
          以上）では、読み札表示エリア（main）と設定/履歴エリア（aside）を左右2ペインに
          分ける。lg未満（スマートフォン想定）ではcol-lg-*が自動的に縦積みへ戻るため、
          既存のレイアウトと見た目上変わらない */}
      <div className="row">
        <main className="col-lg-7 text-center">
          {renderGameMain()}
        </main>

        <aside className="col-lg-5">
          {currentHistory.length > 0 && (
            <section className="history mx-auto text-center" style={{ maxWidth: "600px" }}>
              <button
                type="button"
                onClick={() => setShowHistory(prev => !prev)}
                className="btn btn-sm btn-outline-secondary rounded-pill px-3 mb-3"
              >
                {showHistory ? "これまでに読み上げた札を閉じる" : `これまでに読み上げた札を表示する（${currentHistory.length}枚）`}
              </button>
              {showHistory && (
                <div className="text-start">
                  <h2 className="h4 fw-bold mb-3 border-bottom pb-2 text-dark">これまでに読み上げた札</h2>
                  <div className="list-group shadow-sm rounded">
                    {currentHistory.map((p, index) => (
                      <button key={`${p.category}-${p.id}-${currentHistory.length - index}`} onClick={() => openDetail(p.id, p.category)} className="list-group-item list-group-item-action d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center">
                          {p.level !== "-" && <span className="badge bg-danger me-2">Lv.{p.level}</span>}
                          <span className="text-dark">{p.phrase}</span>
                        </div>
                        <div className="d-flex align-items-center">
                          {/* クイズ大会モードの正解者表示（issue #695）: winnerは早押しが
                              正解と判定された参加者名。クイズ大会モード以外・誰も正解
                              しなかった場合は表示しない */}
                          {p.winner && <span className="text-success small me-3 notranslate">🎉 {p.winner}さん正解</span>}
                          {p.elapsedTime && <span className="text-muted small me-3">{p.elapsedTime}秒</span>}
                          <span className="text-primary small">詳細・報告 →</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <footer className="text-center mt-5 pt-4 border-top">
            <SettingsFooter
              themeSetting={themeSetting}
              setThemeSetting={setThemeSetting}
              lang={lang}
              setLang={setLang}
              voiceId={voiceId}
              setVoiceId={setVoiceId}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              speechRate={speechRate}
              setSpeechRate={setSpeechRate}
              repeatCount={repeatCount}
              setRepeatCount={setRepeatCount}
              cardRevealDelay={cardRevealDelay}
              setCardRevealDelay={setCardRevealDelay}
            />
            <div className="d-flex flex-wrap gap-2 justify-content-center mb-4">
              {division === "kids" && (
                // こども向け（issue #636）はかるた選択画面に「決定」ボタンが無く印刷ボタンを
                // 置けないため、従来どおりゲーム画面からの導線を残す。エンジニア向けは
                // かるた選択画面の「かるたを始める」ボタン下に一本化したためここには置かない
                <button onClick={() => setView("print-efuda")} className="btn btn-outline-dark px-4 rounded-pill">絵札を印刷する</button>
              )}
              <button onClick={resetGame} className="btn btn-outline-dark px-4 rounded-pill">かるたの種類を選び直す</button>
            </div>
            <QuizRoomActionsPanel
              quizRoom={quizRoom}
              quizRoomConnectionStatus={quizRoomConnectionStatus}
              reconnectQuizRoom={reconnectQuizRoom}
              setView={setView}
              quizRoomBuzzedBy={quizRoomBuzzedBy}
              currentPhrase={currentPhrase}
              judgeQuizRoomBuzz={judgeQuizRoomBuzz}
              division={division}
              adminSessionRoomId={adminSessionRoomId}
              isRestoringAdminSession={isRestoringAdminSession}
              switchToAdminMode={switchToAdminMode}
              createQuizRoom={createQuizRoom}
              creatingQuizRoom={creatingQuizRoom}
              quizRoomCreateError={quizRoomCreateError}
              adminSessionRestoreError={adminSessionRestoreError}
              showPlayerRegistration={showPlayerRegistration}
              setShowPlayerRegistration={setShowPlayerRegistration}
              players={players}
              removePlayer={removePlayer}
              newPlayerName={newPlayerName}
              setNewPlayerName={setNewPlayerName}
              addPlayer={addPlayer}
              maxPlayers={maxPlayers}
            />
            <AppVersionInfo />
            <StableSwitchLink />
          </footer>
        </aside>
      </div>
    </div>
  );
}

// 通知（トースト）のProviderで包む。Appより内側のhookが、useNotifyで通知を出す（issue #2190）
function App() {
  return (
    <NotificationProvider>
      <Suspense fallback={<div className="text-center py-5" role="status">読み込み中...</div>}>
        <AppContent />
      </Suspense>
    </NotificationProvider>
  );
}

export default App;
