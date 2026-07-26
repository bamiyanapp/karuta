import { useMemo } from "react";
import Confetti from "./Confetti";
import { buildConfettiPieces } from "../utils/confetti";

// 全札読了時の「おめでとう」演出画面（紙吹雪・セッションサマリー・スコア集計）。
// App.jsxのisAllRead===true時に表示する
// （issue #607: App.jsx肥大化解消のためコンポーネントとして切り出し）

function QuizCompletionScreen({ sessionSummary, scoreSummary, restartCategory }) {
  const confettiPieces = useMemo(() => buildConfettiPieces(), []);

  let winnerHeading = "取った札の記録はありません";
  if (scoreSummary?.winners.length === 1) winnerHeading = `🏆 優勝: ${scoreSummary.winners[0]}`;
  else if (scoreSummary?.winners.length > 1) winnerHeading = `🏆 優勝: ${scoreSummary.winners.join('・')}（同点）`;

  return (
    <>
      <Confetti pieces={confettiPieces} />
      <div className="alert alert-success py-5 mb-5 shadow-sm rounded-4 border-0">
        <h2 className="display-5 fw-bold mb-3">🎉 おめでとう！ 🎉</h2>
        <p className="lead mb-4">すべての札を読み上げました！</p>
        {sessionSummary && (
          <div className="row justify-content-center g-3 mb-4 text-dark">
            <div className="col-6 col-md-4">
              <div className="bg-white rounded-3 shadow-sm p-3 h-100">
                <div className="text-muted small">合計所要時間</div>
                <div className="h4 fw-bold mb-0">{sessionSummary.totalTime.toFixed(2)}秒</div>
              </div>
            </div>
            <div className="col-6 col-md-4">
              <div className="bg-white rounded-3 shadow-sm p-3 h-100">
                <div className="text-muted small">最速の札</div>
                <div className="fw-bold text-truncate">{sessionSummary.fastest.phrase}</div>
                <div className="small text-muted">{sessionSummary.fastest.elapsedTime}秒</div>
              </div>
            </div>
            <div className="col-6 col-md-4">
              <div className="bg-white rounded-3 shadow-sm p-3 h-100">
                <div className="text-muted small">最も時間がかかった札</div>
                <div className="fw-bold text-truncate">{sessionSummary.slowest.phrase}</div>
                <div className="small text-muted">{sessionSummary.slowest.elapsedTime}秒</div>
              </div>
            </div>
          </div>
        )}
        {scoreSummary && (
          <div className="mb-4 text-dark">
            <h3 className="h5 fw-bold mb-3">{winnerHeading}</h3>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              {scoreSummary.entries.map(e => (
                <div key={e.name} className="bg-white rounded-3 shadow-sm px-3 py-2">
                  <span className="fw-bold">{e.name}</span>: {e.count}枚
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={restartCategory} className="btn btn-primary btn-lg px-5 rounded-pill shadow">もう一度最初から遊ぶ</button>
      </div>
    </>
  );
}

export default QuizCompletionScreen;
