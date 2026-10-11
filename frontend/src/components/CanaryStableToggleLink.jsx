// issue #1499: トップ画面でcanary/stableを能動的に見比べられるようにする。
// 既存のStableSwitchLink（issue #1329）はcanary→stableの一方向のみで
// 「画面に問題がある場合はこちら」という控えめなテキストリンクであり、
// 不具合発生時の退避用途に特化している。本コンポーネントはトップ画面
// （division選択画面）専用で、現在表示中でない側へ相互に切り替えられる
// ボタンとして両方を残す（役割が異なるため置き換えない）
export default function CanaryStableToggleLink() {
  const mode = import.meta.env.MODE;
  if (mode !== "canary" && mode !== "stable") {
    return null;
  }

  const target = mode === "canary" ? "stable" : "canary";
  const label = mode === "canary" ? "stable版を見る" : "canary版を見る";

  return (
    <div className="text-center mt-2">
      {/* issue #1540で判明した同根の不具合（StableSwitchLink参照）: 末尾
          スラッシュ無しだとCloudFront Functions側のindex.html自動補完が
          効かずエラーになるため、スラッシュを付与する */}
      <a href={`/${target}/${window.location.search}`} className="btn btn-sm btn-outline-secondary rounded-pill">
        {label}
      </a>
    </div>
  );
}
