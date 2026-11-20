// E2EでCSP違反が1件でもあれば、テストを失敗させる（issue #2189、dev-standards#1407）。
// このリポジトリのE2Eは、各テストが browser.newContext() でページを自分で作るため、
// dev-standardsの自動fixture（cspFixture.js）では監視できない。ページごとにstartCspWatchを呼び、
// 各specファイルのbeforeEach/afterEachで、リセットと判定をする
import { watchCspViolations, formatCspViolations } from './cspWatcher.js'; // symlink

const watched = [];

export async function startCspWatch(page) {
  watched.push(await watchCspViolations(page));
}

export function resetCspWatch() {
  watched.length = 0;
}

export function assertNoCspViolations() {
  const message = formatCspViolations(watched.flat());
  if (message) throw new Error(message);
}
