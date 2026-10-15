import fs from 'node:fs';
import path from 'node:path';
// @axe-core/playwrightのdefault exportは慣習的にAxeBuilderという名前で使われる（公式ドキュメント通り）
// eslint-disable-next-line import-x/no-named-as-default
import AxeBuilder from '@axe-core/playwright';

// issue #1561: axeによる動的アクセシビリティ検査の結果を、既存のスクリーンショット
// 報告の仕組み（screenshot.js参照）と同じ考え方でJSONとして書き出す。CI側
// （dev-standards reusable-ci.yml）がこのディレクトリを読んでJob Summary・PRコメントへ
// 違反内容を可視化する対応は別issueとして追って行う（本対応時点ではCIでの
// 可視化は未実装。testInfo.attach()によりPlaywright HTMLレポート上では確認できる）
export const AXE_RESULTS_DIR = path.resolve(process.cwd(), 'e2e-axe-results');

// 既知の違反のうち、現時点では個別画面の実装修正まで手が回っていないため
// ブロッキングにしない項目（issue #1561の完了条件: 解消方針・残課題の明記）。
// textlintのsentence-length同様、ここに残っている間は「段階的に解消する」対象であり、
// 新たな違反が増えていないかはこのリストに無いルールであれば検知される。
// issue #1646: division-select-view（フッターリンク等がlandmark外）・
// quiz-room-admin-info-view（main landmark欠落・ラベル無しフォーム要素）で
// 検知された既存の違反。issue #1644でlandmark-no-duplicate-main・
// landmark-uniqueを解消した際に、同じページの他の既存違反が新たに表面化した
const KNOWN_VIOLATION_IDS = ['region', 'label', 'landmark-one-main'];

// ページの現在の状態に対してaxeを実行し、結果をHTMLレポートへ添付・JSON書き出しする。
// nameはscreenshot.jsのcaptureScreenshotと同じ命名規則（ASCII安全な識別子）にする。
// KNOWN_VIOLATION_IDSに無い新規の違反ルールが見つかった場合のみテストを失敗させる
// （ラチェットダウン運用。既知の違反はissue #1561側で解消方針を管理する）
export async function runAxeCheck(page, testInfo, name) {
  const results = await new AxeBuilder({ page }).analyze();

  fs.mkdirSync(AXE_RESULTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(AXE_RESULTS_DIR, `${name}.json`),
    JSON.stringify(results.violations, null, 2),
    'utf-8'
  );
  await testInfo.attach(`axe-${name}`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const newViolations = results.violations.filter((v) => !KNOWN_VIOLATION_IDS.includes(v.id));
  if (newViolations.length > 0) {
    const summary = newViolations.map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}件)`).join('\n');
    throw new Error(`axeアクセシビリティ検査で既知のリストにない違反が見つかりました（${name}）:\n${summary}`);
  }
}
