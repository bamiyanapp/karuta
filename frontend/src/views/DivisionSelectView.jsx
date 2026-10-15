import { HeroHeader, TopViewFooterLinks } from "../components/TopViewChrome";
import CanaryStableToggleLink from "../components/CanaryStableToggleLink";

// issue #1519: 進行状況をテキストバッジではなくボタンの背景色で表現する
function roomStatusButtonClass(status) {
  if (status === "進行中") return "selected";
  if (status === "終了") return "btn-karuta-room-finished";
  return "btn-karuta-room-pending";
}

// ルーム開設時に選択されていたかるた種類（issue #1256）を一覧表示用の短い文字列にする。
// 複数選択されている場合は代表1件のみを示し「など」を付ける（列挙すると長くなりすぎるため）
function formatRoomCategories(categories) {
  if (!categories || categories.length === 0) return null;
  if (categories.length === 1) return categories[0];
  return `${categories[0]}など`;
}

// issue #1581: 「開催中」のルームを一覧の先頭へ表示する。取得順（createdAt降順）は
// 同じstatus内の並びとして維持したいので、安定ソートを前提にstatusのみで比較する
function sortRoomsByStatus(rooms) {
  return [...rooms].sort((a, b) => {
    const aIsInProgress = a.status === "進行中" ? 0 : 1;
    const bIsInProgress = b.status === "進行中" ? 0 : 1;
    return aIsInProgress - bIsInProgress;
  });
}

function DivisionSelectView({
  openQuizRooms,
  joinQuizRoom,
  selectDivision,
  setView,
}) {
  const sortedOpenQuizRooms = sortRoomsByStatus(openQuizRooms);

  return (
    <div className="container py-5 mx-auto">
      <HeroHeader />

      <main className="category-selection-container p-4 mx-auto mb-4" style={{ maxWidth: "600px" }}>
        <h2 className="h4 text-center mb-4 text-dark">じぶんではじめる</h2>
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

      <main className="category-selection-container p-4 mx-auto mb-5" style={{ maxWidth: "600px" }}>
        <h2 className="h4 text-center mb-4 text-dark">クイズ大会に参加する</h2>
        {sortedOpenQuizRooms.length > 0 && (
          <div className="mx-auto mb-4" style={{ maxWidth: "400px" }}>
            <p className="text-muted small text-center mb-2">開設中のクイズ大会ルーム</p>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              {sortedOpenQuizRooms.map((room) => (
                <button
                  key={room.roomId}
                  onClick={() => joinQuizRoom(room.roomId)}
                  className={`btn fw-bold rounded-pill shadow-sm btn-karuta text-nowrap ${roomStatusButtonClass(room.status)}`}
                >
                  <span className="notranslate">
                    {formatRoomCategories(room.categories)
                      ? `${formatRoomCategories(room.categories)}（${room.roomId}）`
                      : room.roomId}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="d-flex flex-wrap gap-3 justify-content-center">
          <button
            onClick={() => setView("quiz-room")}
            className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm btn-karuta"
          >
            {sortedOpenQuizRooms.length > 0 ? "他の大会に参加する" : "クイズ大会に参加する"}
          </button>
        </div>
      </main>

      <TopViewFooterLinks setView={setView} className="text-center d-flex flex-column gap-2 mt-4" />
      <CanaryStableToggleLink />
    </div>
  );
}

export default DivisionSelectView;
