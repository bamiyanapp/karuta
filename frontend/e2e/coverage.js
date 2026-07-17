import { addCoverageReport } from 'monocart-reporter';

// E2Eテスト実行中に読み込まれたJSのカバレッジ（issue #541）を計測するヘルパー。
// page.coverage.*はChromium限定のCDP APIのため、このリポジトリのE2E設定
// （Chromiumのみを対象、playwright.config.js参照）でのみ使う前提とする。
// startCoverageはページ作成直後・最初のgoto()より前に呼び、resetOnNavigation: false
// によりページ内遷移をまたいで蓄積する。stopCoverageで収集した結果は
// monocart-reporter（playwright.config.jsのreporter設定）のグローバルカバレッジ
// レポートへ集約され、frontend/coverage/coverage-summary.jsonへ出力される。
export async function startCoverage(page) {
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
}

export async function stopCoverage(page, testInfo) {
  // テストタイムアウト等でこの呼び出し前にPlaywrightがページ/コンテキストを
  // 強制的に閉じることがある（実機検証で確認済み）。カバレッジ収集はあくまで
  // 補助的な計測であり、その失敗が本来のテスト失敗原因を上書き・隠蔽して
  // しまわないよう、ここでの例外は握りつぶしログのみ出す
  if (page.isClosed()) {
    return;
  }
  try {
    const coverage = await page.coverage.stopJSCoverage();
    await addCoverageReport(coverage, testInfo);
  } catch (error) {
    console.warn(`Failed to collect JS coverage: ${error.message}`);
  }
}

// テストタイムアウト等でPlaywrightがコンテキストを既に強制的に閉じていることがあり、
// そのままcontext.close()を呼ぶと「Target...has been closed」という無関係な二次エラーで
// 本来のテスト失敗原因を上書きしてしまう（実機検証で確認済み）。finally節での後始末を
// 安全に行うためのヘルパー
export async function closeContext(context) {
  try {
    await context.close();
  } catch (error) {
    console.warn(`Failed to close browser context: ${error.message}`);
  }
}
