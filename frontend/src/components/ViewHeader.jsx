// CommentsView・ChangelogView・AllPhrasesView・DetailView・PrintEfudaViewで
// ダミースペーサーdivまで含めて同一構造だった「← 戻る/タイトル/幅合わせ
// スペーサー」ヘッダーの共通化（issue #804 5）。
//
// 見出しサイズ・余白・notranslateの有無は画面ごとに意図的に異なるため、
// headingClassName/marginBottomをそのままpropsで渡し、暗黙のマッピングにしない。
// E2Eが← 戻るのテキストを複数箇所で掴んでいるため、文言・DOM構造は変更しない。
function ViewHeader({ onBack, title, headingClassName = "h2 fw-bold m-0 text-dark", marginBottom = "mb-4", noPrint = false }) {
  return (
    <header className={`text-center ${marginBottom} border-bottom pb-3${noPrint ? " no-print" : ""}`}>
      <div className="d-flex justify-content-between align-items-center">
        <button onClick={onBack} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
        <h1 className={headingClassName}>{title}</h1>
        <div style={{ width: "60px" }}></div>
      </div>
    </header>
  );
}

export default ViewHeader;
