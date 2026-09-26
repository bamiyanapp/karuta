import { HeroHeader, TopViewFooterLinks } from "../components/TopViewChrome";

function roomStatusBadgeClass(status) {
  if (status === "進行中") return "text-bg-success";
  if (status === "終了") return "text-bg-dark";
  return "text-bg-secondary";
}

// ルーム開設時に選択されていたかるた種類（issue #1256）を一覧表示用の短い文字列にする。
// 複数選択されている場合は代表1件のみを示し「など」を付ける（列挙すると長くなりすぎるため）
function formatRoomCategories(categories) {
  if (!categories || categories.length === 0) return null;
  if (categories.length === 1) return categories[0];
  return `${categories[0]}など`;
}

function DivisionSelectView({
  openQuizRooms,
  joinQuizRoom,
  selectDivision,
  setView,
}) {
  return (
    <div className="container py-5 mx-auto">
      <HeroHeader />

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
                  <span className={`badge rounded-pill ${roomStatusBadgeClass(room.status)}`}>
                    {room.status}
                  </span>
                  {formatRoomCategories(room.categories) && (
                    <span className="text-muted small notranslate">{formatRoomCategories(room.categories)}</span>
                  )}
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

      <TopViewFooterLinks setView={setView} className="text-center d-flex flex-column gap-2 mt-4" />
    </div>
  );
}

export default DivisionSelectView;
