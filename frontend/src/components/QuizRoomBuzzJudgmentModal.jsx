// 早押し正誤判定モーダル（issue #546）。管理者が参加者の早押しを正誤判定するための
// ポップアップで、以前はApp.jsxのゲーム画面のレンダー内にのみ存在していた。
// ルーム情報画面（QuizRoomInfoView）を開いている間はこの分岐を通らずモーダルが
// 描画されず、参加者が早押ししても管理者が気づけない不具合があった（issue #613）。
// ゲーム画面・ルーム情報画面の両方から共通で呼び出せるよう、独立したコンポーネントへ
// 切り出した
// issue #782: 解説文（explanation）が長い場合、スマートフォンの縦画面のような
// 狭いビューポートではモーダル全体の高さが画面をはみ出し、内容が読めなくなったり
// ボタンが隠れてしまうことがあった。Bootstrapの`modal-dialog-scrollable`を付与し、
// モーダルの高さをビューポート内に収めたうえで、内容が収まらない場合は
// `.modal-body`内でスクロールできるようにする
function QuizRoomBuzzJudgmentModal({ buzzedBy, answer, explanation, onJudge }) {
  if (!buzzedBy) {
    return null;
  }

  return (
    <div className="modal fade show d-block modal-overlay" tabIndex="-1">
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content rounded-4 border-0 shadow">
          <div className="modal-body p-5 text-center">
            <h3 className="h5 mb-4 fw-bold">🔔 {buzzedBy.name} さんが回答中</h3>
            {answer && answer !== "-" && (
              <>
                <div className="text-muted mb-2">答え</div>
                <div className="h4 fw-bold text-dark mb-4">{answer}</div>
              </>
            )}
            {explanation && explanation !== "-" && (
              <div className="fs-6 text-dark mb-4">{explanation}</div>
            )}
            <div className="d-flex gap-2 justify-content-center">
              <button onClick={() => onJudge(true)} className="btn btn-primary btn-lg px-4 rounded-pill shadow-sm fs-6">正解</button>
              <button onClick={() => onJudge(false)} className="btn btn-outline-secondary btn-lg px-4 rounded-pill fs-6">不正解</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QuizRoomBuzzJudgmentModal;
