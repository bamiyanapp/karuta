import karutaImage from "../assets/karuta_inubou.png";
import ResultCard from "../components/ResultCard";
import QuizCompletionScreen from "../components/QuizCompletionScreen";
import SettingsFooter from "../components/SettingsFooter";
import AppVersionInfo from "../components/AppVersionInfo";
import StableSwitchLink from "../components/StableSwitchLink";
import QuizRoomActionsPanel from "../components/QuizRoomActionsPanel";

// ゲーム画面（読み上げ画面）。App.jsxから切り出した（issue #2192）。
// 状態は持たず、App.jsxが保持する読み上げ・クイズ大会・設定の状態と操作を、propsで受け取って描画する。
// 読了後はお祝い画面、読み上げ中は読み札カードと操作ボタン、右（lg以上）または下に、履歴と設定を出す。
function GameView({
  division,
  repeatPhrase,
  isAllRead,
  sessionSummary,
  scoreSummary,
  restartCategory,
  isFadingOut,
  displayContent,
  players,
  recordTaken,
  currentRoundTakenBy,
  playKaruta,
  loading,
  isReadingLastPhrase,
  isReading,
  currentPhrase,
  stopReading,
  categoryLabel,
  allPhrasesForCategory,
  currentHistory,
  showHistory,
  setShowHistory,
  openDetail,
  themeSetting,
  setThemeSetting,
  lang,
  setLang,
  voiceId,
  setVoiceId,
  sortOrder,
  setSortOrder,
  speechRate,
  setSpeechRate,
  repeatCount,
  setRepeatCount,
  cardRevealDelay,
  setCardRevealDelay,
  setView,
  resetGame,
  quizRoom,
  quizRoomConnectionStatus,
  reconnectQuizRoom,
  quizRoomBuzzedBy,
  judgeQuizRoomBuzz,
  adminSessionRoomId,
  isRestoringAdminSession,
  switchToAdminMode,
  createQuizRoom,
  creatingQuizRoom,
  quizRoomCreateError,
  adminSessionRestoreError,
  showPlayerRegistration,
  setShowPlayerRegistration,
  removePlayer,
  newPlayerName,
  setNewPlayerName,
  addPlayer,
  maxPlayers,
}) {
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

export default GameView;
