import formatBuildTime from "../formatBuildTime.js"; // symlink

// トップページ必須構成（バージョン・更新日時表示、dev-standards
// docs/frontend-ui-conventions.md参照）。__APP_VERSION__・__APP_BUILD_TIME__は
// vite.config.jsのdefineでビルド時にpackage.jsonのversion・ビルド時刻から
// 埋め込まれる。
export default function AppVersionInfo() {
  return (
    <p className="text-muted small mb-3">
      v{__APP_VERSION__}（更新: {formatBuildTime(__APP_BUILD_TIME__)}）
    </p>
  );
}
