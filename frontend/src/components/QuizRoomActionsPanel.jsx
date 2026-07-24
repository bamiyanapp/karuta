import { CONNECTION_STATUS_LABEL } from "../hooks/useQuizRoomSync";
import QuizRoomBuzzJudgmentModal from "./QuizRoomBuzzJudgmentModal";
import PlayerRegistrationPanel from "./PlayerRegistrationPanel";

// ゲーム画面フッターのクイズ大会モード操作パネル（issue #607でApp.jsxから切り出し）。
// ルーム開設中は接続状態・ルーム情報ボタン・早押し判定モーダルを、未開設時は
// ルーム作成/再開ボタンと参加者登録（取った人を記録する）を表示する
function QuizRoomActionsPanel({
  quizRoom,
  quizRoomConnectionStatus,
  reconnectQuizRoom,
  setView,
  quizRoomBuzzedBy,
  currentPhrase,
  judgeQuizRoomBuzz,
  division,
  adminSessionRoomId,
  isRestoringAdminSession,
  switchToAdminMode,
  createQuizRoom,
  creatingQuizRoom,
  quizRoomCreateError,
  adminSessionRestoreError,
  showPlayerRegistration,
  setShowPlayerRegistration,
  players,
  removePlayer,
  newPlayerName,
  setNewPlayerName,
  addPlayer,
  maxPlayers,
}) {
  if (quizRoom) {
    return (
      <div className="mb-4">
        {/* issue #614: 管理者側は従来connectionStatusを受け取ってすらおらず、
            切断されたことが画面のどこにも表示されなかった（切断に気づかず
            読み上げを進めると参加者に札が配信されない不具合があった）。
            接続状態が悪い場合のみ警告として表示し、平常時は表示を増やさない */}
        {quizRoomConnectionStatus !== "connected" && (
          <p className="text-danger small mb-2">
            <span>
              クイズ大会の接続状態: {CONNECTION_STATUS_LABEL[quizRoomConnectionStatus] || quizRoomConnectionStatus}
              （参加者に札が届いていない可能性があります）
            </span>
            {quizRoomConnectionStatus === "error" && (
              <button
                type="button"
                onClick={reconnectQuizRoom}
                className="btn btn-sm btn-outline-danger rounded-pill ms-2"
              >
                再接続
              </button>
            )}
          </p>
        )}
        <button
          type="button"
          onClick={() => setView("quiz-room-info")}
          className="btn btn-outline-dark px-4 rounded-pill mb-4"
        >
          ルーム情報を表示（クイズ大会モード）
        </button>
        <QuizRoomBuzzJudgmentModal
          buzzedBy={quizRoomBuzzedBy}
          answer={currentPhrase?.answer}
          explanation={currentPhrase?.explanation}
          onJudge={judgeQuizRoomBuzz}
        />
      </div>
    );
  }

  return (
    <div className="mb-4 d-flex flex-wrap gap-3 justify-content-center align-items-start">
      <div>
        {/* 管理者セッション復帰（issue #697）: ブラウザを閉じて読み上げ画面へ戻ってきた
            場合でも、保存済みの管理者セッションがあれば新規作成の前に再開できるようにする
            （issue #744: 従来はこの画面に再開の導線が無く、常に新規ルームを作ってしまっていた）。
            再開できる場合は、誤って別の新しいルームを作ってしまわないよう、新規作成ボタン自体を
            隠す（issue #748）。作成ボタンが必要な場合は先にルーム詳細画面から現在のルームを
            閉じることで再開できない状態にできる（issue #748） */}
        {adminSessionRoomId ? (
          <button
            type="button"
            onClick={() => switchToAdminMode(adminSessionRoomId)}
            disabled={isRestoringAdminSession}
            className="btn btn-outline-dark px-4 rounded-pill"
          >
            {isRestoringAdminSession ? "再開中..." : "クイズ大会のルームを再開する"}
          </button>
        ) : (
          <button
            type="button"
            onClick={createQuizRoom}
            disabled={creatingQuizRoom}
            className="btn btn-outline-dark px-4 rounded-pill"
          >
            {creatingQuizRoom ? "作成中..." : "クイズ大会のルームを作成する"}
          </button>
        )}
        {quizRoomCreateError && <p className="text-danger small">{quizRoomCreateError}</p>}
        {adminSessionRestoreError && <p className="text-danger small">{adminSessionRestoreError}</p>}
      </div>
      {division !== "kids" && (
        <PlayerRegistrationPanel
          showPlayerRegistration={showPlayerRegistration}
          setShowPlayerRegistration={setShowPlayerRegistration}
          players={players}
          removePlayer={removePlayer}
          newPlayerName={newPlayerName}
          setNewPlayerName={setNewPlayerName}
          addPlayer={addPlayer}
          maxPlayers={maxPlayers}
        />
      )}
    </div>
  );
}

export default QuizRoomActionsPanel;
