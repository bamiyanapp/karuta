import formatBuildTime from "../formatBuildTime.js"; // symlink
import useBackendVersion from "../hooks/useBackendVersion.js";

// トップページ必須構成（バージョン・更新日時表示、dev-standards
// docs/frontend-ui-conventions.md参照）。__APP_VERSION__・__APP_BUILD_TIME__は
// vite.config.jsのdefineでビルド時にpackage.jsonのversion・ビルド時刻から
// 埋め込まれる。
//
// setViewを渡した場合のみ更新履歴（changelog view）へのリンクにする（issue #1429）。
// 多数の画面（QuizRoomInfoView・ChangelogView・CommentsView等）から素のテキストとして
// 呼ばれているため、setView省略時は従来通りの非リンクテキストのままにする
//
// issue #1462: 今表示中の画面がcanary/stableのどちらか見分ける手段が無かったため、
// ビルド時のモード（npm run build:canary/build:stable）からstageバッジを表示する。
// ローカル開発・開発者向けの素のbuildではcanary/stable以外の値になるため非表示にする
function resolveStage() {
  const mode = import.meta.env.MODE;
  return mode === "canary" || mode === "stable" ? mode : null;
}

export default function AppVersionInfo({ setView }) {
  const stage = resolveStage();
  const backendVersion = useBackendVersion();
  const text = `v${__APP_VERSION__}（更新: ${formatBuildTime(__APP_BUILD_TIME__)}）`;

  // バックエンドのバージョンが取得できており、フロントエンドのバージョンと
  // 異なる場合のみ表示する（#1448の自己修復処理が途中で失敗した場合の検知用）
  const versionMismatch =
    backendVersion?.version && backendVersion.version !== __APP_VERSION__;

  return (
    <div className="mb-3">
      {setView ? (
        <button
          type="button"
          onClick={() => setView("changelog")}
          className="btn btn-link text-muted small p-0 text-decoration-none"
        >
          {text}
        </button>
      ) : (
        <p className="text-muted small mb-0">{text}</p>
      )}
      {stage && (
        <span
          className={`badge small ms-1 ${stage === "canary" ? "bg-warning text-dark" : "bg-secondary"}`}
        >
          {stage === "canary" ? "canary（試験公開中）" : "stable"}
        </span>
      )}
      {versionMismatch && (
        <p className="text-danger small mb-0">
          バックエンドのバージョン（v{backendVersion.version}）と一致していません。時間を置いて再読み込みしてください。
        </p>
      )}
    </div>
  );
}
