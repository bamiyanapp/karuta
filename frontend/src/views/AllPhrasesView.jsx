function AllPhrasesView({
  allPhrases,
  filterCategory,
  setFilterCategory,
  uniqueCategories,
  categoryCount,
  filteredPhrases,
  renderSortArrow,
  handleSort,
  openDetail,
  setView,
  setSelectedCategories,
}) {
  return (
    <div className="container py-4 mx-auto">
      <header className="text-center mb-4 border-bottom pb-3">
        <div className="d-flex justify-content-between align-items-center">
          <button onClick={() => { setView("game"); setSelectedCategories([]); setFilterCategory(''); }} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
          <h1 className="h2 fw-bold m-0 text-dark">全札一覧</h1>
          <div style={{ width: "60px" }}></div>
        </div>
      </header>

      <main className="mx-auto" style={{ maxWidth: "1200px" }}>
        {allPhrases.length === 0 ? (
          <p className="text-muted text-center py-5">読み込み中...</p>
        ) : (
          <div className="all-phrases-scroll-container">
            <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
              <span className="text-muted small fw-bold me-1">種別:</span>
              <button
                className={`btn btn-sm rounded-pill ${filterCategory === '' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setFilterCategory('')}
              >
                すべて ({allPhrases.length})
              </button>
              {uniqueCategories.map(cat => (
                <button
                  key={cat}
                  className={`btn btn-sm rounded-pill notranslate ${filterCategory === cat ? 'btn-karuta' : 'btn-outline-secondary'}`}
                  onClick={() => setFilterCategory(cat)}
                >
                  {cat} ({categoryCount[cat] || 0})
                </button>
              ))}
            </div>
            <div className="all-phrases-table-container shadow-sm rounded-4 bg-white">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col" className="ps-4" style={{ cursor: "pointer" }} onClick={() => handleSort('category')}>
                      カテゴリ{renderSortArrow('category')}
                    </th>
                    <th scope="col" className="all-phrases-col-balanced" style={{ cursor: "pointer" }} onClick={() => handleSort('phrase')}>
                      読み札{renderSortArrow('phrase')}
                    </th>
                    <th scope="col" className="all-phrases-col-balanced" style={{ cursor: "pointer" }} onClick={() => handleSort('answer')}>
                      答え{renderSortArrow('answer')}
                    </th>
                    <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('level')}>
                      Lv{renderSortArrow('level')}
                    </th>
                    <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('readCount')}>
                      回数{renderSortArrow('readCount')}
                    </th>
                    <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('averageTime')}>
                      平均時間{renderSortArrow('averageTime')}
                    </th>
                    <th scope="col" style={{ cursor: "pointer" }} onClick={() => handleSort('averageDifficulty')}>
                      難易度{renderSortArrow('averageDifficulty')}
                    </th>
                    <th scope="col" className="text-end pe-4">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPhrases.map((p) => (
                    <tr key={`${p.category}-${p.id}`} style={{ cursor: "pointer" }} onClick={() => openDetail(p.id, p.category)}>
                      <td className="ps-4 text-muted small">{p.category}</td>
                      <td className="fw-bold">{p.phrase}</td>
                      <td>{p.answer && p.answer !== "-" ? p.answer : ""}</td>
                      <td>{p.level !== "-" ? p.level : ""}</td>
                      <td>{p.readCount || 0}</td>
                      <td>{(p.averageTime || 0).toFixed(2)}s</td>
                      <td>{(p.averageDifficulty || 0).toFixed(2)}</td>
                      <td className="text-end pe-4 text-primary">→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default AllPhrasesView;
