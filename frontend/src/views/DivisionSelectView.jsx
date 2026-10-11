import { HeroHeader, TopViewFooterLinks } from "../components/TopViewChrome";
import CanaryStableToggleLink from "../components/CanaryStableToggleLink";
import StableSwitchLink from "../components/StableSwitchLink";

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

function DivisionSelectView({
  openQuizRooms,
  joinQuizRoom,
  selectDivision,
  setView,
}) {
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
        <div className="d-flex flex-wrap gap-3 justify-content-center">
          <button
            onClick={() => setView("quiz-room")}
            className="btn btn-lg px-4 py-3 fw-bold rounded-pill shadow-sm btn-karuta"
          >
            {openQuizRooms.length > 0 ? "他の大会に参加する" : "クイズ大会に参加する"}
          </button>
        </div>
        {openQuizRooms.length > 0 && (
          <div className="mx-auto mt-4" style={{ maxWidth: "400px" }}>
            <p className="text-muted small text-center mb-2">開設中のクイズ大会ルーム</p>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              {openQuizRooms.map((room) => (
                <button
                  key={room.roomId}
                  onClick={() => joinQuizRoom(room.roomId)}
                  className={`btn fw-bold rounded-pill shadow-sm btn-karuta ${roomStatusButtonClass(room.status)}`}
                >
                  <span className="d-block notranslate">{room.roomId}</span>
                  {formatRoomCategories(room.categories) && (
                    <span className="d-block fw-normal small notranslate">{formatRoomCategories(room.categories)}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <TopViewFooterLinks setView={setView} className="text-center d-flex flex-column gap-2 mt-4" />
      <CanaryStableToggleLink />
      {/* issue #1540: StableSwitchLinkはApp.jsxのフッター内にしか置かれておらず、
          別レイアウトで早期returnするこの画面には表示されていなかった */}
      <StableSwitchLink />
    </div>
  );
}

export default DivisionSelectView;
