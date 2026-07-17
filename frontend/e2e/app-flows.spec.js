import { test, expect } from '@playwright/test';
import { startCoverage, stopCoverage, closeContext } from './coverage.js';
import { captureScreenshot } from './screenshot.js';

// issue #576対応: E2EのJSカバレッジを引き上げるため、これまでquiz-room.spec.jsの
// クイズ大会モードでしかカバーできていなかった通常モード（カテゴリ選択→読み上げ→
// 結果表示）と、主要な参照画面（絵札印刷・全札一覧・詳細・更新履歴・指摘一覧）を
// 一連の実操作で通しでカバーする。実際のデプロイ済みバックエンドに対して実行する
// ため（quiz-room.spec.jsと同じ方針）、書き込みを伴う操作のうち本番データを恒久的に
// 汚す可能性があるもの（かるたの誤り指摘の実送信、絵札PDFの実生成）は行わず、
// フォームの表示確認や画面遷移・表示内容の確認にとどめる
test('normal read-aloud flow (category select -> phrase -> result), then browses print/reference views (issue #576)', async ({ browser }, testInfo) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await startCoverage(page);

  // print-efuda画面の「印刷する」ボタンでwindow.print()の実ダイアログを
  // 開かせないよう、ナビゲーション前に上書きしておく
  await page.addInitScript(() => {
    window.__printCalled = false;
    window.print = () => { window.__printCalled = true; };
  });

  // PWAの「オフラインで利用可能になりました」トースト（PwaUpdatePrompt.jsx）は
  // position: fixedで画面下部に表示され、5秒後に自動で消えるが、それまでの間は
  // 同じ位置にあるトップ画面のフッターリンク（全札一覧を見る／更新履歴を見る／
  // 指摘された内容を確認するなど）を覆いクリックをブロックすることがある
  // （PwaUpdatePrompt.jsx自身のコメントに既知の不具合として記載あり）。
  // このテストはそのフッターリンクを実際にクリックするため、都度出現していれば
  // 明示的に閉じる
  const dismissPwaToastIfPresent = async () => {
    try {
      await page.getByRole('button', { name: '閉じる' }).click({ timeout: 500 });
    } catch {
      // トーストが出ていなければ何もしない
    }
  };

  try {
    await page.goto('/');

    // 参照系画面（全札一覧・更新履歴・指摘一覧）は、どなた向けかを選ぶ前の
    // トップ画面（App.jsxの`selectedCategories.length === 0 && !division`）にしか
    // ボタンが無い。カテゴリ選択後のゲーム画面には存在しないため、division選択前に
    // 先に一通り確認しておく
    // 全札一覧画面: 検索・絞り込み・詳細画面への遷移
    await dismissPwaToastIfPresent();
    await page.getByText('全札一覧を見る →').click();
    await expect(page.getByRole('heading', { name: '全札一覧' })).toBeVisible();
    await page.getByPlaceholder('読み札・読み・答えで検索').fill('ふでこぞう');
    const matchedRow = page.getByRole('row', { name: /ふでこぞう/ });
    await expect(matchedRow).toBeVisible();
    await captureScreenshot(page, testInfo, 'all-phrases-search-result', '全札一覧画面：検索結果が絞り込まれた状態');
    await matchedRow.click();

    // 詳細画面（かるたの誤りを指摘するフォームは表示だけ確認し、実送信はしない
    // ——本番データへ恒久的な指摘レコードが残ってしまうため）
    await expect(page.getByRole('heading', { name: /の詳細$/ })).toBeVisible();
    await expect(page.getByText('読み上げる')).toBeVisible();
    await expect(page.getByText('かるたの誤りを指摘する')).toBeVisible();
    await expect(page.getByPlaceholder('例：かなが間違っている、フレーズが違うなど')).toBeVisible();
    await captureScreenshot(page, testInfo, 'detail-view', '詳細画面：かるたの誤りを指摘するフォームが表示された状態');
    await page.getByText('← 戻る').click();
    await expect(page.getByRole('heading', { name: '全札一覧' })).toBeVisible();

    // 全札一覧から戻る（division未選択のままなのでトップ画面に戻る）
    await page.getByText('← 戻る').click();
    await expect(page.getByText('こども向け')).toBeVisible();

    // 更新履歴画面（changelog.jsonをビルド時に同梱しているだけで通信は発生しない）
    await dismissPwaToastIfPresent();
    await page.getByText('更新履歴を見る').click();
    // changelog.json本体の各エントリ文中にも「更新履歴」という語が複数回登場するため
    // （例: 本機能自体の追加を記録したエントリ）、getByTextでは複数要素にマッチして
    // strict mode violationになる。見出し要素に限定する
    await expect(page.getByRole('heading', { name: '更新履歴' })).toBeVisible();
    await captureScreenshot(page, testInfo, 'changelog-view', '更新履歴画面');
    await page.getByText('← 戻る').click();
    await expect(page.getByText('こども向け')).toBeVisible();

    // 指摘一覧画面
    await dismissPwaToastIfPresent();
    await page.getByText('指摘された内容を確認する').click();
    await expect(page.getByRole('heading', { name: '指摘された内容一覧' })).toBeVisible();
    await captureScreenshot(page, testInfo, 'comments-view', '指摘された内容一覧画面');

    // ここから通常の読み上げフロー（カテゴリ選択→読み上げ→結果表示）
    await page.goto('/');
    await dismissPwaToastIfPresent();
    await page.getByText('こども向け').click();
    // こども向けは1タップで即座に読み上げ画面へ遷移する（App.jsxのtoggleDraftCategory）
    await page.getByRole('button', { name: /おばけかるた/ }).click();

    const nextButton = page.getByRole('button', { name: '次の札' });
    await expect(nextButton).toBeVisible();
    await expect(page.getByText('読み上げ済み 0 / 全45枚')).toBeVisible();

    await nextButton.click();
    // /get-phraseはPolly合成（未キャッシュ時）・Lambdaコールドスタートを伴うことがある
    await expect(page.locator('.yomifuda-phrase')).toBeVisible({ timeout: 30000 });

    // もう一度「次の札」を押すと、直前の札の結果（所要時間・答え）が表示されてから
    // 次の札の取得に進む
    await nextButton.click();
    await expect(page.getByText('所要時間')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('読み上げ済み 1 / 全45枚')).toBeVisible();
    await captureScreenshot(page, testInfo, 'normal-mode-result', '通常モード：結果画面（所要時間・答え表示）');
    await expect(page.locator('.yomifuda-phrase')).toBeVisible({ timeout: 30000 });

    // 絵札印刷画面
    await page.getByText('絵札を印刷する').click();
    await expect(page.getByText('おばけかるたの絵札印刷')).toBeVisible();
    await expect(page.locator('.efuda-card-text').first()).toBeVisible();
    await captureScreenshot(page, testInfo, 'print-efuda-front', '絵札印刷画面：表面表示');

    // 裏面表示（種別・レベルのみ、読み札本文は出ない）に切り替える
    await page.getByRole('button', { name: '裏面' }).click();
    await expect(page.locator('.efuda-card-back-category').first()).toBeVisible();
    await captureScreenshot(page, testInfo, 'print-efuda-back', '絵札印刷画面：裏面表示');

    // 印刷ダイアログは開かせず、window.print()が呼ばれたことだけ確認する
    await page.getByText('印刷する', { exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__printCalled)).toBe(true);

    await page.getByText('← 戻る').click();
    await expect(nextButton).toBeVisible();
  } finally {
    await stopCoverage(page, testInfo);
    await closeContext(context);
  }
});
