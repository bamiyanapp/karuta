// 描画前に、保存済みのテーマ（ライト/ダーク/システム）を<html>へ反映する（ちらつき防止）。
// CSP（script-src 'self'）でインラインスクリプトを禁止するため、index.htmlのインラインから
// このファイルへ移した（issue #2189）。<head>内の通常スクリプトとして同期実行される
(function () {
  try {
    var theme = localStorage.getItem("theme") || "system";
    var isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-bs-theme", isDark ? "dark" : "light");
  } catch {
    // localStorage/matchMediaが使えない環境ではライトのまま
  }
})();
