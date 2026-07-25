import ViewHeader from "../components/ViewHeader";

function CommentsView({ allComments, setView }) {
  return (
    <div className="container py-4 mx-auto">
      <ViewHeader onBack={() => setView("game")} title="指摘された内容一覧" marginBottom="mb-5" />

      <main className="mx-auto" style={{ maxWidth: "800px" }}>
        {allComments.length === 0 ? (
          <p className="text-muted text-center py-5">まだ指摘はありません。</p>
        ) : (
          <div className="row g-4">
            {allComments.map(c => (
              <div key={c.id} className="col-12">
                <div className="card border-0 shadow-sm rounded-4 h-100 bg-white">
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <span className="badge bg-secondary rounded-pill">{c.category}</span>
                      <small className="text-muted">{new Date(c.createdAt).toLocaleString()}</small>
                    </div>
                    <h5 className="card-title fw-bold text-dark mb-3">「{c.phrase}」</h5>
                    <div className="p-3 bg-light rounded-3 border-start border-4 border-danger">
                      <p className="card-text mb-0 text-dark">{c.comment}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default CommentsView;
