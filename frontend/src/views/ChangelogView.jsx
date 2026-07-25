import ReactMarkdown from "react-markdown";
import changelogData from "../changelog.json";
import ViewHeader from "../components/ViewHeader";

function ChangelogView({ setView }) {
  return (
    <div className="container py-4 mx-auto">
      <ViewHeader onBack={() => setView("game")} title="更新履歴" marginBottom="mb-5" />
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
