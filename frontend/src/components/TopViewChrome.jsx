// DivisionSelectView・CategorySelectViewで一字一句同一だったヒーローヘッダー・
// フッターリンクの共通化（issue #804 16）

import AppVersionInfo from "./AppVersionInfo";

export function HeroHeader() {
  return (
    <header className="text-center mb-5">
      <img src="favicon.png" alt="かるたのアイコン" className="mb-4" style={{ width: "120px", height: "auto" }} />
      <h1 className="display-4 fw-bold">かるた読み上げアプリ</h1>
    </header>
  );
}

export function TopViewFooterLinks({ setView, className = "text-center d-flex flex-column gap-2" }) {
  return (
    <div className={className}>
      <button onClick={() => setView("all-phrases")} className="btn btn-link text-decoration-none text-muted">
        全札一覧を見る →
      </button>
      <button onClick={() => setView("share")} className="btn btn-link text-decoration-none text-muted small">
        このアプリを共有する
      </button>
      <AppVersionInfo setView={setView} />
    </div>
  );
}
