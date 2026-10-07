import formatBuildTime from "../formatBuildTime.js"; // symlink

// トップページ必須構成（バージョン・更新日時表示、dev-standards
// docs/frontend-ui-conventions.md参照）。__APP_VERSION__・__APP_BUILD_TIME__は
// vite.config.jsのdefineでビルド時にpackage.jsonのversion・ビルド時刻から
// 埋め込まれる。
//
// setViewを渡した場合のみ更新履歴（changelog view）へのリンクにする（issue #1429）。
// 多数の画面（QuizRoomInfoView・ChangelogView・CommentsView等）から素のテキストとして
// 呼ばれているため、setView省略時は従来通りの非リンクテキストのままにする
export default function AppVersionInfo({ setView }) {
  const text = `v${__APP_VERSION__}（更新: ${formatBuildTime(__APP_BUILD_TIME__)}）`;

  if (!setView) {
    return <p className="text-muted small mb-3">{text}</p>;
  }

  return (
    <button
      type="button"
      onClick={() => setView("changelog")}
      className="btn btn-link text-muted small mb-3 p-0 text-decoration-none"
    >
      {text}
    </button>
  );
}
