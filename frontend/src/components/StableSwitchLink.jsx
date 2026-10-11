// issue #1329（BG Task 10）: ErrorBoundaryが検知できない軽微な不具合
// （クラッシュに至らない表示崩れ等）向けに、ユーザー自身がstableへ
// 切り替えられる導線。canaryビルド（npm run build:canaryでMODEがcanaryになる）
// でのみ表示し、クリックで/stableへ遷移する。infra/serverless.ymlの
// CloudFront Functions（issue #1328で追加済み）が/stable/への明示アクセスを
// きっかけに以後の通常アクセスもstableへ固定するため、ここでは単に
// 遷移させるだけでよい
export default function StableSwitchLink() {
  if (import.meta.env.MODE !== "canary") {
    return null;
  }

  return (
    <p className="small mt-2">
      {/* issue #1540: 末尾スラッシュ無しの/stableだとCloudFront Functions側の
          index.html自動補完（URIが"/"で終わる場合のみ発生）が効かず、
          実在しないS3オブジェクトキーへのアクセスとなりエラーになる
          （infra/serverless.ymlのViewerRequestFunction参照） */}
      <a href={`/stable/${window.location.search}`} className="text-muted">
        画面に問題がある場合はこちら
      </a>
    </p>
  );
}
