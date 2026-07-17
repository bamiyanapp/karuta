import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// スクリーンショットの保存先（issue #568）。testInfo.attach()によるPlaywright
// HTMLレポートへの添付だけでは、特にスマホ版GitHubアプリからアーティファクトzipを
// ダウンロード・展開する手段が事実上無く閲覧しづらいため、CI側（reusable-ci.yml）が
// このディレクトリのPNGを別ブランチへ公開し、Job Summary・PRコメントへ
// raw.githubusercontent.comのURLとして埋め込めるようにする
export const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'e2e-screenshots');

// ページのスクリーンショットを撮影し、(1) 既存のPlaywright HTMLレポートへの
// 添付、(2) CI側が公開できるようSCREENSHOT_DIRへのファイル書き出し、の両方を行う。
// nameはファイル名（URLの一部になるため引き続きASCII安全な識別子を渡すこと）、
// captionはPRコメント・Job Summaryの見出しに使われる日本語の説明文（issue #601）。
// captionを省略した場合はCI側（dev-standards）がnameをそのまま見出しとして使う
export async function captureScreenshot(page, testInfo, name, caption) {
  const body = await page.screenshot({ fullPage: true });
  await testInfo.attach(name, { body, contentType: 'image/png' });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCREENSHOT_DIR, `${name}.png`), body);
  if (caption) {
    fs.writeFileSync(path.join(SCREENSHOT_DIR, `${name}.caption.txt`), caption, 'utf-8');
  }
  // issue #628: PRの変更と無関係なスクリーンショットをCI側（reusable-ci.yml）で
  // 折りたたむため、どのスペックファイルが撮影したかを記録する。testInfo.fileは
  // Playwrightが自動的に持つ絶対パスなのでスペック側の追加対応は不要。CI側は
  // これとspec-source-map.jsonの宣言、PRの変更ファイル一覧を突き合わせて
  // 関連の有無を判定する
  fs.writeFileSync(path.join(SCREENSHOT_DIR, `${name}.spec.txt`), path.basename(testInfo.file), 'utf-8');
}
