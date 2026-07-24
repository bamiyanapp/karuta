function AllPhrasesView({
  allPhrases,
  filterCategory,
  setFilterCategory,
  filterDivision,
  setFilterDivision,
  searchQuery,
  setSearchQuery,
  uniqueCategories,
  categoryCount,
  filteredPhrases,
  renderSortArrow,
  handleSort,
  sortConfig,
  openDetail,
  setView,
  setSelectedCategories,
}) {
  // uniqueCategoriesは呼び出し元（App.jsx）でfilterDivisionに応じて既に絞り込まれた
  // 一覧が渡ってくるため、種別ボタン一覧を切り替えるたびdivisionを跨いだ絞り込みが
  // 残らないよう、division切り替え時は種別フィルタをリセットする
  const changeFilterDivision = (division) => {
    setFilterDivision(division);
    setFilterCategory('');
  };

  // 「すべて」ボタンの件数は、選択中のdivisionに属する種別だけの合計にする
  // （division未選択時はuniqueCategoriesが全種別のためallPhrases.length相当になる）
  const visibleTotal = uniqueCategories.reduce((sum, cat) => sum + (categoryCount[cat] || 0), 0);
  const getAriaSort = (key) => {
    if (sortConfig.key !== key) return 'none';
    return sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  };

  const handleHeaderKeyDown = (key) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSort(key);
    }
  };

  return (
    <div className="container py-4 mx-auto">
      <header className="text-center mb-4 border-bottom pb-3">
        <div className="d-flex justify-content-between align-items-center">
          <button onClick={() => { setView("game"); setSelectedCategories([]); setFilterCategory(''); setFilterDivision(''); setSearchQuery(''); }} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
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
              <span className="text-muted small fw-bold me-1">対象:</span>
              <button
                className={`btn btn-sm rounded-pill ${filterDivision === '' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => changeFilterDivision('')}
              >
                すべて
              </button>
              <button
                className={`btn btn-sm rounded-pill ${filterDivision === 'kids' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => changeFilterDivision('kids')}
              >
                こども向け
              </button>
              <button
                className={`btn btn-sm rounded-pill ${filterDivision === 'engineer' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => changeFilterDivision('engineer')}
              >
                エンジニア向け
              </button>
            </div>
            <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
              <span className="text-muted small fw-bold me-1">種別:</span>
              <button
                className={`btn btn-sm rounded-pill ${filterCategory === '' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setFilterCategory('')}
              >
                すべて ({visibleTotal})
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
            <div className="mb-3">
              <input
                type="search"
                className="form-control"
                style={{ maxWidth: "360px" }}
                placeholder="読み札・読み・答えで検索"
                aria-label="読み札・読み・答えで検索"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {filteredPhrases.length === 0 && (
              <p className="text-muted text-center py-4">該当する札が見つかりません。</p>
            )}
            <div className="all-phrases-table-container shadow-sm rounded-4 bg-white">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col" className="ps-4" style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-sort={getAriaSort('category')} onClick={() => handleSort('category')} onKeyDown={handleHeaderKeyDown('category')}>
                      カテゴリ{renderSortArrow('category')}
                    </th>
                    <th scope="col" className="all-phrases-col-balanced" style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-sort={getAriaSort('phrase')} onClick={() => handleSort('phrase')} onKeyDown={handleHeaderKeyDown('phrase')}>
                      読み札{renderSortArrow('phrase')}
                    </th>
                    <th scope="col" className="all-phrases-col-balanced" style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-sort={getAriaSort('answer')} onClick={() => handleSort('answer')} onKeyDown={handleHeaderKeyDown('answer')}>
                      答え{renderSortArrow('answer')}
                    </th>
                    <th scope="col" style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-sort={getAriaSort('level')} onClick={() => handleSort('level')} onKeyDown={handleHeaderKeyDown('level')}>
                      Lv{renderSortArrow('level')}
                    </th>
                    <th scope="col" style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-sort={getAriaSort('readCount')} onClick={() => handleSort('readCount')} onKeyDown={handleHeaderKeyDown('readCount')}>
                      回数{renderSortArrow('readCount')}
                    </th>
                    <th scope="col" style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-sort={getAriaSort('averageTime')} onClick={() => handleSort('averageTime')} onKeyDown={handleHeaderKeyDown('averageTime')}>
                      平均時間{renderSortArrow('averageTime')}
                    </th>
                    <th scope="col" style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-sort={getAriaSort('averageDifficulty')} onClick={() => handleSort('averageDifficulty')} onKeyDown={handleHeaderKeyDown('averageDifficulty')}>
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
