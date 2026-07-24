function DivisionSelectView({
  openQuizRooms,
  joinQuizRoom,
  selectDivision,
  setView,
}) {
  return (
    <div className="container py-5 mx-auto">
      <header className="text-center mb-5">
        <img src="favicon.png" alt="かるたのアイコン" className="mb-4" style={{ width: "120px", height: "auto" }} />
        <h1 className="display-4 fw-bold">かるた読み上げアプリ</h1>
      </header>

      <main className="category-selection-container p-4 mx-auto mb-5" style={{ maxWidth: "600px" }}>
        <h2 className="h4 text-center mb-4 text-dark">どなた向けに遊びますか？</h2>
        <div className="d-flex flex-wrap gap-3 justify-content-center">
          <button
            onClick={() => selectDivision("kids")}
            className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm btn-karuta"
          >
            こども向け
          </button>
          <button
            onClick={() => selectDivision("engineer")}
            className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm btn-karuta"
          >
            エンジニア向け
          </button>
        </div>
      </main>

      {openQuizRooms.length > 0 && (
        <div className="mx-auto mt-4" style={{ maxWidth: "400px" }}>
          <p className="text-muted small text-center mb-2">開設中のクイズ大会ルーム</p>
          <div className="list-group shadow-sm rounded">
            {openQuizRooms.map((room) => (
              <button
                key={room.roomId}
                onClick={() => joinQuizRoom(room.roomId)}
                className="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
              >
                <span className="fw-bold notranslate">{room.roomId}</span>
                <span className="d-flex align-items-center gap-2">
                  <span className={`badge rounded-pill ${
                    room.status === "進行中" ? "text-bg-success"
                      : room.status === "終了" ? "text-bg-dark"
                        : "text-bg-secondary"
                  }`}
                  >
                    {room.status}
                  </span>
                  {room.category && <span className="text-muted small notranslate">{room.category}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="text-center mt-4">
        <button onClick={() => setView("quiz-room")} className="btn btn-link text-decoration-none text-muted small">
          {openQuizRooms.length > 0 ? "他のクイズ大会に参加する" : "クイズ大会に参加する"}
        </button>
      </div>

      <div className="text-center d-flex flex-column gap-2 mt-4">
        <button onClick={() => setView("all-phrases")} className="btn btn-link text-decoration-none text-muted">
          全札一覧を見る →
        </button>
        <button onClick={() => setView("comments")} className="btn btn-link text-decoration-none text-muted small">
          指摘された内容を確認する
        </button>
        <button onClick={() => setView("changelog")} className="btn btn-link text-decoration-none text-muted small">
          更新履歴を見る
        </button>
      </div>
    </div>
  );
}

export default DivisionSelectView;
