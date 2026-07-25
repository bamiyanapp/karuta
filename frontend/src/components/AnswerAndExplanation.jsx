// issue #800: 答え・解説の表示ブロックが、ResultCard.jsx（通常モード・クイズ大会
// 参加者の結果画面）とQuizRoomBuzzJudgmentModal.jsx（クイズ大会の早押し判定モーダル）
// の3箇所に同型で存在していたため共通化した。
// variant="card"（既定）: 所要時間等の他の項目に続けて表示する想定で、見出しに
// mt-4を付ける（ResultCard.jsx・QuizRoomView.jsxの結果画面）。
// variant="modal": タイトル直下に表示する想定で見出しにmt-4を付けず、解説には
// 見出しを出さずボタン等との間隔（mb-4）を確保する（QuizRoomBuzzJudgmentModal.jsx）
function AnswerAndExplanation({ answer, explanation, variant = "card" }) {
  const labelClassName = variant === "modal" ? "text-muted mb-2" : "text-muted mt-4 mb-2";
  const answerClassName = variant === "modal" ? "h4 fw-bold text-dark mb-4" : "h4 fw-bold text-dark";

  return (
    <>
      {answer && answer !== "-" && (
        <>
          <div className={labelClassName}>答え</div>
          <div className={answerClassName}>{answer}</div>
        </>
      )}
      {explanation && explanation !== "-" && (
        variant === "modal" ? (
          <div className="fs-6 text-dark mb-4">{explanation}</div>
        ) : (
          <>
            <div className="text-muted mt-4 mb-2">解説</div>
            <div className="fs-6 text-dark">{explanation}</div>
          </>
        )
      )}
    </>
  );
}

export default AnswerAndExplanation;
