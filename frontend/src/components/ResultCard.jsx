// 1札の読み上げ結果画面。App.jsxのdisplayContent.type === 'result'時に表示する
// （issue #607: App.jsx肥大化解消のためコンポーネントとして切り出し）
function ResultCard({ result, division }) {
  if (!result) return null;
  return (
    <div className="yomifuda shadow-lg">
      <div className="d-flex flex-column justify-content-center align-items-center h-100">
        <div className="text-muted mb-2">所要時間</div>
        <div className="display-4 fw-bold text-dark mb-2">{result.time.toFixed(2)}<span className="fs-4">秒</span></div>

        {result.isFast && (
          <div className="badge bg-warning text-dark fs-6 mb-4 px-3 py-2 rounded-pill shadow-sm">
            🎉 平均より速い！
          </div>
        )}

        {division !== "kids" && (
          <>
            <div className="text-muted mb-2">難易度レベル</div>
            <div className="h3 fw-bold text-danger">{result.difficulty.toFixed(2)}</div>
          </>
        )}

        {result.answer && result.answer !== "-" && (
          <>
            <div className="text-muted mt-4 mb-2">答え</div>
            <div className="h4 fw-bold text-dark">{result.answer}</div>
          </>
        )}

        {result.explanation && result.explanation !== "-" && (
          <>
            <div className="text-muted mt-4 mb-2">解説</div>
            <div className="fs-6 text-dark">{result.explanation}</div>
          </>
        )}
      </div>
    </div>
  );
}

export default ResultCard;
