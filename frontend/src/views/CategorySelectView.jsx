import { HeroHeader, TopViewFooterLinks } from "../components/TopViewChrome";

function CategorySelectView({
  division,
  categories,
  categoriesForDivision,
  draftCategories,
  draftCardCount,
  draftCategoriesRequiringPossessionCheck,
  maxEfudaPrintCards,
  goBackToDivisionSelect,
  toggleDraftCategory,
  handleDecideClick,
  handlePrintEfudaClick,
  setView,
}) {
  let categoryListContent = null;
  if (categories.length === 0) {
    categoryListContent = <div className="text-success fw-bold p-3">読み込み中...</div>;
  } else if (categoriesForDivision.length === 0) {
    categoryListContent = <div className="text-muted p-3">このかるたはまだありません。</div>;
  }

  return (
    <div className="container py-5 mx-auto">
      <HeroHeader />

      <main className="category-selection-container p-4 mx-auto mb-5" style={{ maxWidth: "600px" }}>
        <div className="d-flex justify-content-start mb-3">
          <button onClick={goBackToDivisionSelect} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
        </div>
        <h2 className="h4 text-center mb-4 text-dark">
          かるたの種類を選んでね{division === "engineer" ? "（複数選択可）" : ""}
        </h2>
        <div className="d-flex flex-wrap gap-3 justify-content-center">
          {categoryListContent ?? categoriesForDivision.map(cat => {
            const isSelected = draftCategories.includes(cat.name);
            // 選択済みの解除は常に可能。未選択のものだけ、追加すると上限を超える場合に無効化する
            const wouldExceedCap = !isSelected && draftCardCount + (cat.count || 0) > maxEfudaPrintCards;
            return (
              <button
                key={cat.name}
                onClick={() => toggleDraftCategory(cat.name)}
                disabled={wouldExceedCap}
                title={wouldExceedCap ? `印刷できる上限（${maxEfudaPrintCards}枚）を超えるため選択できません` : undefined}
                className={`btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm notranslate btn-karuta ${isSelected ? 'selected' : ''}`}
                aria-pressed={isSelected}
              >
                {isSelected ? '✓ ' : ''}{cat.name}
              </button>
            );
          })}
        </div>
        {division === "engineer" && categoriesForDivision.length > 0 && (
          <div className="text-center mt-4">
            {draftCardCount > 0 && (
              <p className="text-muted small mb-2">
                選択中の合計: {draftCardCount}枚 / 印刷可能な上限: {maxEfudaPrintCards}枚
                {draftCardCount >= maxEfudaPrintCards && "（上限に達しました）"}
              </p>
            )}
            {draftCategoriesRequiringPossessionCheck.length > 0 && (
              <p className="text-muted small mb-2">
                {draftCategoriesRequiringPossessionCheck.map(cat => `「${cat}」`).join("")}をお手元にご用意ください
              </p>
            )}
            <div className="d-flex flex-column align-items-center gap-2">
              <button
                onClick={handleDecideClick}
                disabled={draftCategories.length === 0}
                className="btn btn-success btn-lg px-5 py-2 fw-bold rounded-pill shadow"
              >
                かるたを始める
              </button>
              <button
                onClick={handlePrintEfudaClick}
                disabled={draftCategories.length === 0}
                className="btn btn-outline-dark px-4 rounded-pill"
              >
                絵札を印刷する
              </button>
            </div>
          </div>
        )}
      </main>

      <TopViewFooterLinks setView={setView} />
    </div>
  );
}

export default CategorySelectView;
