function DetailView({
  detailPhrase,
  detailPhraseCategory,
  categoryLabel,
  closeDetail,
  repeatPhrase,
  commentText,
  setCommentText,
  postComment,
  postingComment,
  detailPhraseComments,
}) {
  return (
    <div className="container py-4 mx-auto">
      <header className="text-center mb-4 border-bottom pb-3">
        <div className="d-flex justify-content-between align-items-center">
          <button onClick={closeDetail} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
          <h1 className="h4 m-0 fw-bold notranslate">{detailPhrase ? detailPhrase.category : (detailPhraseCategory || categoryLabel)} の詳細</h1>
          <div style={{ width: "60px" }}></div>
        </div>
      </header>

      <main className="text-center py-4">
        {!detailPhrase ? (
          <div className="p-5 text-muted">読み込み中...</div>
        ) : (
          <div className="mx-auto" style={{ maxWidth: "600px" }}>
            <div className="d-flex justify-content-center mb-4">
              <div className="yomifuda-container mb-4" onClick={repeatPhrase} role="button">
                <div className="yomifuda shadow-lg">
                  <div className="yomifuda-kana"><span>{detailPhrase.kana || (detailPhrase.phrase && detailPhrase.phrase[0])}</span></div>
                  <div className="yomifuda-phrase">{detailPhrase.phrase}</div>
                  {detailPhrase.phrase_en && <div className="yomifuda-phrase-en">{detailPhrase.phrase_en}</div>}
                  {detailPhrase.level !== "-" && <div className="yomifuda-level fw-bold">レベル: {detailPhrase.level}</div>}
                </div>
              </div>
            </div>
            <div className="mb-4 text-muted">
              <p>読み上げ回数: {detailPhrase.readCount || 0}回</p>
              <p>平均時間: {(detailPhrase.averageTime || 0).toFixed(2)}秒</p>
              <p>難易度レベル: {(detailPhrase.averageDifficulty || 0).toFixed(2)}</p>
            </div>

            {detailPhrase.answer && detailPhrase.answer !== "-" && (
              <div className="mb-4">
                <div className="text-muted mb-2">答え</div>
                <div className="h4 fw-bold text-dark">{detailPhrase.answer}</div>
              </div>
            )}
            {detailPhrase.explanation && detailPhrase.explanation !== "-" && (
              <div className="mb-4 fs-6 text-dark">{detailPhrase.explanation}</div>
            )}
            <div className="mb-5">
              <button
                onClick={repeatPhrase}
                className="btn btn-lg px-5 py-3 fw-bold rounded-pill shadow btn-karuta"
              >
                読み上げる
              </button>
            </div>

          {detailPhraseComments && detailPhraseComments.length > 0 && (
            <section className="text-start mb-4">
              <h2 className="h6 fw-bold mb-3 text-muted">これまでの指摘（{detailPhraseComments.length}件）</h2>
              <div className="d-flex flex-column gap-2">
                {detailPhraseComments.map(c => (
                  <div key={c.id} className="p-3 bg-light rounded-3 border-start border-4 border-danger">
                    <small className="text-muted d-block mb-1">{new Date(c.createdAt).toLocaleString()}</small>
                    <p className="mb-0 text-dark">{c.comment}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="comment-form-container text-start p-4 bg-light rounded-4 shadow-sm border">
            <h2 className="h5 fw-bold mb-3 text-dark">かるたの誤りを指摘する</h2>
            <form onSubmit={postComment}>
                <div className="mb-3">
                  <textarea
                    className="form-control rounded-3"
                    rows="3"
                    placeholder="例：かなが間違っている、フレーズが違うなど"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    maxLength={1000}
                    required
                  ></textarea>
                </div>
                <button type="submit" disabled={postingComment} className="btn btn-danger w-100 rounded-pill py-2 fw-bold shadow-sm">
                  {postingComment ? "送信中..." : "指摘内容を送信する"}
                </button>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default DetailView;
