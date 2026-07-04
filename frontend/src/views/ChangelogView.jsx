import ReactMarkdown from "react-markdown";
import changelogData from "../changelog.json";

function ChangelogView({ setView }) {
  return (
    <div className="container py-4 mx-auto">
      <header className="text-center mb-5 border-bottom pb-3">
          <div className="d-flex justify-content-between align-items-center">
          <button onClick={() => setView("game")} className="btn btn-sm btn-outline-secondary rounded-pill">← 戻る</button>
          <h1 className="h2 fw-bold m-0 text-dark">更新履歴</h1>
          <div style={{ width: "60px" }}></div>
          </div>
      </header>
      <main className="mx-auto" style={{ maxWidth: "800px" }}>
          {changelogData.length === 0 ? (
              <p className="text-muted text-center py-5">履歴はありません。</p>
          ) : (
              <div className="d-flex flex-column gap-4">
                  {changelogData.map((entry, index) => (
                      <div key={index} className="card border-0 shadow-sm rounded-4 bg-white">
                          <div className="card-header bg-transparent border-0 pt-4 px-4 pb-0 d-flex justify-content-between align-items-center">
                              <h2 className="h5 fw-bold m-0">v{entry.version}</h2>
                              <small className="text-muted">{entry.date}</small>
                          </div>
                          <div className="card-body p-4">
                              <ReactMarkdown>{entry.body}</ReactMarkdown>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </main>
    </div>
  );
}

export default ChangelogView;
