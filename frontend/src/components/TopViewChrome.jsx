// DivisionSelectView・CategorySelectViewで一字一句同一だったヒーローヘッダー・
// フッターリンクの共通化（issue #804 16）

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
      <button onClick={() => setView("comments")} className="btn btn-link text-decoration-none text-muted small">
        指摘された内容を確認する
      </button>
      <button onClick={() => setView("changelog")} className="btn btn-link text-decoration-none text-muted small">
        更新履歴を見る
      </button>
    </div>
  );
}
