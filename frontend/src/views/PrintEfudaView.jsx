const getEfudaText = (p) => (p.answer && p.answer !== "-") ? p.answer : p.phrase;

function PrintEfudaView({ categoryLabel, setView, selectedCategories, allPhrasesForCategory, efudaPages, efudaPerPage }) {
  return (
    <div className="container efuda-print-container py-4 mx-auto">
      <header className="text-center mb-4 border-bottom pb-3 no-print">
        <div className="d-flex justify-content-between align-items-center">
          <button onClick={() => setView("game")} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
          <h1 className="h4 m-0 fw-bold notranslate">{categoryLabel}の絵札印刷</h1>
          <div style={{ width: "60px" }}></div>
        </div>
      </header>

      {selectedCategories.length === 0 ? (
        <p className="text-muted text-center py-5 no-print">カテゴリを選択してください。</p>
      ) : allPhrasesForCategory.length === 0 ? (
        <p className="text-muted text-center py-5 no-print">読み込み中...</p>
      ) : (
        <>
          <div className="no-print text-center mb-4">
            <p className="text-muted small mb-3">
              用紙: <a href="https://www.a-one.co.jp/product/search/detail.php?id=51677" target="_blank" rel="noopener noreferrer">エーワン マルチカード（マイクロミシン・厚口）A4・10面用</a><br />
              印刷ダイアログで「用紙サイズ: A4」「余白: なし」「拡大縮小: 実際のサイズ(100%)」「ヘッダーとフッター: オフ」に設定してください。
            </p>
            <button onClick={() => window.print()} className="btn btn-lg px-5 py-2 fw-bold rounded-pill shadow btn-karuta">
              印刷する
            </button>
          </div>

          <div className="efuda-print-area">
            {efudaPages.map((page, pageIndex) => (
              <div className="efuda-page" key={pageIndex}>
                <div className="efuda-grid">
                  {Array.from({ length: efudaPerPage }).map((_, slotIndex) => {
                    const p = page.items[slotIndex];
                    return (
                      <div className="efuda-card" key={slotIndex}>
                        {p && (
                          <>
                            <p className="no-print text-muted small efuda-card-category">{p.category}</p>
                            <div className="efuda-card-kana">{p.kana}</div>
                            <div className="efuda-card-text">{getEfudaText(p)}</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PrintEfudaView;
