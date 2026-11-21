import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import "./App.css";
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
import GameView from "./views/GameView";
import QuizRoomBuzzJudgmentModal from "./components/QuizRoomBuzzJudgmentModal";
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

  return (
    <GameView
      division={division}
      repeatPhrase={repeatPhrase}
      isAllRead={isAllRead}
      sessionSummary={sessionSummary}
      scoreSummary={scoreSummary}
      restartCategory={restartCategory}
      isFadingOut={isFadingOut}
      displayContent={displayContent}
      players={players}
      recordTaken={recordTaken}
      currentRoundTakenBy={currentRoundTakenBy}
      playKaruta={playKaruta}
      loading={loading}
      isReadingLastPhrase={isReadingLastPhrase}
      isReading={isReading}
      currentPhrase={currentPhrase}
      stopReading={stopReading}
      categoryLabel={categoryLabel}
      allPhrasesForCategory={allPhrasesForCategory}
      currentHistory={currentHistory}
      showHistory={showHistory}
      setShowHistory={setShowHistory}
      openDetail={openDetail}
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
      setView={setView}
      resetGame={resetGame}
      quizRoom={quizRoom}
      quizRoomConnectionStatus={quizRoomConnectionStatus}
      reconnectQuizRoom={reconnectQuizRoom}
      quizRoomBuzzedBy={quizRoomBuzzedBy}
      judgeQuizRoomBuzz={judgeQuizRoomBuzz}
      adminSessionRoomId={adminSessionRoomId}
      isRestoringAdminSession={isRestoringAdminSession}
      switchToAdminMode={switchToAdminMode}
      createQuizRoom={createQuizRoom}
      creatingQuizRoom={creatingQuizRoom}
      quizRoomCreateError={quizRoomCreateError}
      adminSessionRestoreError={adminSessionRestoreError}
      showPlayerRegistration={showPlayerRegistration}
      setShowPlayerRegistration={setShowPlayerRegistration}
      removePlayer={removePlayer}
      newPlayerName={newPlayerName}
      setNewPlayerName={setNewPlayerName}
      addPlayer={addPlayer}
      maxPlayers={maxPlayers}
    />
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
