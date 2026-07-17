import { test, expect } from '@playwright/test';
import { startCoverage, stopCoverage, closeContext } from './coverage.js';
import { captureScreenshot } from './screenshot.js';

// クイズ大会モード（issue #470）の管理者→参加者リアルタイム同期を、実際にデプロイ済みの
// バックエンド（REST API + WebSocket API）に対してブラウザ2つ（別コンテキスト＝別端末相当）で検証する。
// このリポジトリにはE2E用のモックバックエンドが存在しないため、本番相当のAWS環境に
// 実際にルームを作成する（TTLで24時間後に自動失効するため、テスト実行が残骸を蓄積し続けることはない）。
test('admin creates a quiz room and a participant sees the same card update in real time', async ({ browser }, testInfo) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await startCoverage(adminPage);

  const participantContext = await browser.newContext();
  let participantPage = null;

  try {
    await adminPage.goto('/');
    await adminPage.getByText('こども向け').click();
    await adminPage.getByRole('button', { name: /おばけかるた/ }).click();
    const nextButton = adminPage.getByRole('button', { name: '次の札' });
    await expect(nextButton).toBeVisible();

    await adminPage.getByText('クイズ大会のルームを作成する').click();
    const roomInfoLink = adminPage.getByText('ルーム情報を表示（クイズ大会モード）');
    await expect(roomInfoLink).toBeVisible({ timeout: 15000 });
    await roomInfoLink.click();

    const roomCode = (await adminPage.locator('p.h3.fw-bold.notranslate').innerText()).trim();
    expect(roomCode).toMatch(/^[A-Z2-9]{6}$/);

    // ルーム情報表示は別画面への遷移になった（issue #547）。通常のゲーム画面に戻る
    await adminPage.getByText('← 戻る').click();
    await expect(nextButton).toBeVisible();

    participantPage = await participantContext.newPage();
    await startCoverage(participantPage);
    await participantPage.goto(`/?view=quiz-room&roomId=${roomCode}`);

    await expect(participantPage.getByText('クイズ大会モード（参加者）')).toBeVisible();
    // 早押し機能（issue #510）: 参加者はまず名前を入力してから通常の参加者画面へ進む
    await participantPage.getByPlaceholder('お名前').fill('たろう');
    await participantPage.getByText('決定').click();
    await expect(participantPage.getByText('接続状態: 接続済み')).toBeVisible({ timeout: 15000 });
    await expect(participantPage.getByText('ホストの操作を待っています...')).toBeVisible();

    await nextButton.click();

    // /get-phraseはPolly音声合成（未キャッシュ時）を伴うため、Lambdaコールドスタートを
    // 含めると数秒〜十数秒かかることがある
    await expect(adminPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 30000 });
    await expect(participantPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 15000 });
    const adminPhraseText = await adminPage.locator('.yomifuda-phrase').innerText();
    const participantPhraseText = await participantPage.locator('.yomifuda-phrase').innerText();
    expect(participantPhraseText).toBe(adminPhraseText);
  } finally {
    // カバレッジ計測（issue #541）: 失敗時も可能な範囲でカバレッジを収集するため、
    // コンテキストを閉じる前にtry節の成否に関わらず停止・収集する
    await stopCoverage(adminPage, testInfo);
    if (participantPage) {
      await stopCoverage(participantPage, testInfo);
    }
    await closeContext(adminContext);
    await closeContext(participantContext);
  }
});

// issue #559: 管理者・回答者（早押しした本人）・未回答参加者（早押ししていない他の参加者）の
// 3ロールを同時に登場させ、正誤判定（issue #546）後にロールごとに画面の見え方が異なることを
// 確認する。あわせて参加者一覧（issue #545）が管理者・参加者双方に反映されることも検証する。
// 要所ではcaptureScreenshot()でスクリーンショットをHTMLレポートへ添付しつつ、
// CI側（reusable-ci.yml）が公開できるファイルとしても書き出す（issue #568）。
// これによりCIログだけで挙動確認が完結するようにする（打鍵による再現確認の負担を下げる）
test('admin judges a buzz, and the responder vs. other participants end up in different states (issue #545, #546)', async ({ browser }, testInfo) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await startCoverage(adminPage);

  const responderContext = await browser.newContext();
  const otherContext = await browser.newContext();
  let responderPage = null;
  let otherPage = null;

  try {
    await adminPage.goto('/');
    await adminPage.getByText('こども向け').click();
    await adminPage.getByRole('button', { name: /おばけかるた/ }).click();
    const nextButton = adminPage.getByRole('button', { name: '次の札' });
    await expect(nextButton).toBeVisible();

    await adminPage.getByText('クイズ大会のルームを作成する').click();
    const roomInfoLink = adminPage.getByText('ルーム情報を表示（クイズ大会モード）');
    await expect(roomInfoLink).toBeVisible({ timeout: 15000 });
    await roomInfoLink.click();
    const roomCode = (await adminPage.locator('p.h3.fw-bold.notranslate').innerText()).trim();

    // ルーム情報表示は別画面への遷移になった（issue #547）。通常のゲーム画面に戻る
    await adminPage.getByText('← 戻る').click();
    await expect(nextButton).toBeVisible();

    // 回答者役（このラウンドで実際に早押しする本人）
    responderPage = await responderContext.newPage();
    await startCoverage(responderPage);
    await responderPage.goto(`/?view=quiz-room&roomId=${roomCode}`);
    await responderPage.getByPlaceholder('お名前').fill('たろう');
    await responderPage.getByText('決定').click();
    await expect(responderPage.getByText('接続状態: 接続済み')).toBeVisible({ timeout: 15000 });

    // 未回答参加者役（早押しせず様子を見る側）
    otherPage = await otherContext.newPage();
    await startCoverage(otherPage);
    await otherPage.goto(`/?view=quiz-room&roomId=${roomCode}`);
    await otherPage.getByPlaceholder('お名前').fill('はなこ');
    await otherPage.getByText('決定').click();
    await expect(otherPage.getByText('接続状態: 接続済み')).toBeVisible({ timeout: 15000 });

    // 参加者一覧（issue #545）: 管理者画面に両参加者が反映される
    await expect(adminPage.getByText('たろう: 0pt')).toBeVisible({ timeout: 15000 });
    await expect(adminPage.getByText('はなこ: 0pt')).toBeVisible();

    await nextButton.click();
    await expect(adminPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 30000 });
    await expect(responderPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 15000 });
    await expect(otherPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 15000 });

    // 回答者が早押しする
    await responderPage.getByRole('button', { name: '回答する' }).click();

    // 管理者に判定モーダルが自動表示される（issue #546）
    await expect(adminPage.getByText('🔔 たろう さんが回答しました')).toBeVisible({ timeout: 15000 });
    await captureScreenshot(adminPage, testInfo, 'admin-judgment-modal');

    // 回答者本人・未回答参加者のどちらの画面にも回答者名が表示され、早押しボタンは無くなる
    await expect(responderPage.getByText('🔔 たろう さんが回答しました')).toBeVisible({ timeout: 15000 });
    await expect(otherPage.getByText('🔔 たろう さんが回答しました')).toBeVisible({ timeout: 15000 });
    await expect(otherPage.getByRole('button', { name: '回答する' })).not.toBeVisible();

    // 管理者が不正解と判定する
    await adminPage.getByRole('button', { name: '不正解', exact: true }).click();

    // 未回答参加者（はなこ）は早押しボタンが復活するが、誤答した本人（たろう）は
    // このラウンド中は復活しない（issue #546）
    await expect(otherPage.getByRole('button', { name: '回答する' })).toBeVisible({ timeout: 15000 });
    await expect(responderPage.getByRole('button', { name: '回答する' })).not.toBeVisible();
    await captureScreenshot(otherPage, testInfo, 'other-participant-can-rebuzz');
    await captureScreenshot(responderPage, testInfo, 'responder-excluded-this-round');

    // 未回答参加者（はなこ）が早押しする
    await otherPage.getByRole('button', { name: '回答する' }).click();
    await expect(adminPage.getByText('🔔 はなこ さんが回答しました')).toBeVisible({ timeout: 15000 });

    // 管理者が正解と判定する
    await adminPage.getByRole('button', { name: '正解', exact: true }).click();

    // ポイントが参加者一覧に反映される（管理者・参加者双方、issue #519, #545）
    await expect(adminPage.getByText('はなこ: 1pt')).toBeVisible({ timeout: 15000 });
    await expect(adminPage.getByText('たろう: 0pt')).toBeVisible();
    await expect(otherPage.getByText('獲得ポイント: 1')).toBeVisible({ timeout: 15000 });
    await captureScreenshot(adminPage, testInfo, 'admin-after-correct-judgment');
  } finally {
    // カバレッジ計測（issue #541）: 失敗時も可能な範囲でカバレッジを収集するため、
    // コンテキストを閉じる前にtry節の成否に関わらず停止・収集する
    await stopCoverage(adminPage, testInfo);
    if (responderPage) {
      await stopCoverage(responderPage, testInfo);
    }
    if (otherPage) {
      await stopCoverage(otherPage, testInfo);
    }
    await closeContext(adminContext);
    await closeContext(responderContext);
    await closeContext(otherContext);
  }
});
