import { useMemo } from "react";

// 全札読了時の「おめでとう」演出画面（紙吹雪・セッションサマリー・スコア集計）。
// App.jsxのisAllRead===true時に表示する
// （issue #607: App.jsx肥大化解消のためコンポーネントとして切り出し）

// Math.random()はレンダー中（useMemoのファクトリ関数を含む）に呼び出すと
// react-hooks/purityに抵触するため、iから決定的に導出する疑似乱数を使う
// （見た目のランダムさだけが目的で、実際の乱雑さの品質は問わない演出のため）
const buildConfettiPieces = () => {
  const emojis = ["🎉", "✨", "🎊", "⭐"];
  const pseudoRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  return Array.from({ length: 24 }, (_, i) => ({
    id: i,
    emoji: emojis[i % emojis.length],
    left: pseudoRandom(i) * 100,
    delay: pseudoRandom(i + 100) * 0.6,
    duration: 2.2 + pseudoRandom(i + 200) * 1.2,
  }));
};

function QuizCompletionScreen({ sessionSummary, scoreSummary, restartCategory }) {
  const confettiPieces = useMemo(() => buildConfettiPieces(), []);

  return (
    <>
      {confettiPieces.length > 0 && (
        <div className="confetti-container" aria-hidden="true">
          {confettiPieces.map(c => (
            <span
              key={c.id}
              className="confetti-piece"
              style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}
            >
              {c.emoji}
            </span>
          ))}
        </div>
      )}
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
            <h3 className="h5 fw-bold mb-3">
              {scoreSummary.winners.length === 1
                ? `🏆 優勝: ${scoreSummary.winners[0]}`
                : scoreSummary.winners.length > 1
                ? `🏆 優勝: ${scoreSummary.winners.join('・')}（同点）`
                : "取った札の記録はありません"}
            </h3>
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
