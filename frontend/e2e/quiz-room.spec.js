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

// issue #640: 管理者側でadminTokenが失われた場合（今回はページのリロードで再現する）の
// 実際の挙動を固定化する回帰テスト。adminTokenはReact stateにのみ保持されており
// （useQuizRoomAdmin.js）永続化されていないため、リロード後は同じルームへ管理者として
// 戻る手段が無い。「治る」ことを検証するテストではなく、現状の既知の制約
// （参加者側にも通知が一切届かない）をそのまま記録することが目的
test('when the admin reloads mid-game, the quiz room association is lost and the participant gets no notification (issue #640)', async ({ browser }, testInfo) => {
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
    await adminPage.getByText('← 戻る').click();
    await expect(nextButton).toBeVisible();

    participantPage = await participantContext.newPage();
    await startCoverage(participantPage);
    await participantPage.goto(`/?view=quiz-room&roomId=${roomCode}`);
    await participantPage.getByPlaceholder('お名前').fill('たろう');
    await participantPage.getByText('決定').click();
    await expect(participantPage.getByText('接続状態: 接続済み')).toBeVisible({ timeout: 15000 });

    await nextButton.click();
    await expect(adminPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 30000 });
    await expect(participantPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 15000 });
    const phraseBeforeReload = await participantPage.locator('.yomifuda-phrase').innerText();

    // 管理者側でJS stateが失われる状況を、ページのリロードで再現する
    await adminPage.reload();

    // division・カテゴリ選択はURLクエリパラメータ経由で復元される（useUrlQuerySync）ため
    // ゲーム画面自体には戻るが、quizRoom（roomId・adminToken）はReact stateにしか
    // 保持されておらず永続化されていないため失われ、「ルームを作成する」ボタンが
    // 再度表示される（＝管理者は同じルームへの管理者としての復帰手段を持たない）
    await expect(nextButton).toBeVisible({ timeout: 15000 });
    await expect(adminPage.getByText('クイズ大会のルームを作成する')).toBeVisible();
    await captureScreenshot(adminPage, testInfo, 'admin-lost-room-after-reload', '管理者：リロード後にルーム作成前の状態へ戻り、同じルームへの復帰手段が無い状態');

    // 参加者側は管理者の切断について一切通知を受け取らず、リロード直前の画面のまま
    // 変化しない（現状の既知の制約）
    await participantPage.waitForTimeout(2000);
    await expect(participantPage.locator('.yomifuda-phrase')).toHaveText(phraseBeforeReload);
    await expect(participantPage.getByText('接続状態: 接続済み')).toBeVisible();
    await captureScreenshot(participantPage, testInfo, 'participant-unaware-after-admin-reload', '参加者：管理者がリロードした後も通知なく元の画面のまま変化しない状態');
  } finally {
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

    // 参加者一覧（issue #545）: 管理者側はルーム情報画面の下部に表形式で反映される（issue #587）
    await roomInfoLink.click();
    await expect(adminPage.getByRole('row').nth(1)).toHaveText('たろう接続中0pt', { timeout: 15000 });
    await expect(adminPage.getByRole('row').nth(2)).toHaveText('はなこ接続中0pt');
    await adminPage.getByText('← 戻る').click();
    await expect(nextButton).toBeVisible();

    await nextButton.click();
    await expect(adminPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 30000 });
    await expect(responderPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 15000 });
    await expect(otherPage.locator('.yomifuda-phrase')).toBeVisible({ timeout: 15000 });

    // 回答者が早押しする
    await responderPage.getByRole('button', { name: '回答する' }).click();

    // 管理者に判定モーダルが自動表示される（issue #546）
    await expect(adminPage.getByText('🔔 たろう さんが回答中')).toBeVisible({ timeout: 15000 });
    await captureScreenshot(adminPage, testInfo, 'admin-judgment-modal', '管理者：早押し判定モーダルが表示された状態');

    // 回答者本人・未回答参加者のどちらの画面にも回答者名が表示され、早押しボタンは無くなる
    await expect(responderPage.getByText('🔔 たろう さんが回答中')).toBeVisible({ timeout: 15000 });
    await expect(otherPage.getByText('🔔 たろう さんが回答中')).toBeVisible({ timeout: 15000 });
    await expect(otherPage.getByRole('button', { name: '回答する' })).not.toBeVisible();

    // 管理者が不正解と判定する
    await adminPage.getByRole('button', { name: '不正解', exact: true }).click();

    // 未回答参加者（はなこ）は早押しボタンが復活するが、誤答した本人（たろう）は
    // このラウンド中は復活しない（issue #546）
    await expect(otherPage.getByRole('button', { name: '回答する' })).toBeVisible({ timeout: 15000 });
    await expect(responderPage.getByRole('button', { name: '回答する' })).not.toBeVisible();
    await captureScreenshot(otherPage, testInfo, 'other-participant-can-rebuzz', '未回答参加者（はなこ）：不正解判定後も回答ボタンが再表示された状態');
    await captureScreenshot(responderPage, testInfo, 'responder-excluded-this-round', '誤答した本人（たろう）：このラウンド中は回答ボタンが再表示されない状態');

    // 未回答参加者（はなこ）が早押しする
    await otherPage.getByRole('button', { name: '回答する' }).click();
    await expect(adminPage.getByText('🔔 はなこ さんが回答中')).toBeVisible({ timeout: 15000 });

    // 管理者が正解と判定する
    await adminPage.getByRole('button', { name: '正解', exact: true }).click();
    await expect(otherPage.getByText('獲得ポイント: 1')).toBeVisible({ timeout: 15000 });
    await captureScreenshot(adminPage, testInfo, 'admin-after-correct-judgment', '管理者：正解判定後の状態');

    // ポイントが参加者一覧（管理者側、ルーム情報画面、issue #587）に反映される
    // （参加者側は獲得ポイント表示で確認済み、issue #519, #545）
    await roomInfoLink.click();
    await expect(adminPage.getByRole('row').nth(1)).toHaveText('はなこ接続中1pt', { timeout: 15000 });
    await expect(adminPage.getByRole('row').nth(2)).toHaveText('たろう接続中0pt');
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

// issue #616: 存在しないルームコードで参加しようとした場合、原因不明のまま
// WebSocket接続のリトライ（約15秒）を待たされることなく、即座にエラーが
// 表示されることを検証する。"NOPE99"は"O"を含む（backend/quizRoomHandler.jsの
// ROOM_CODE_CHARSは0/O/1/I/Lを除外しているため実際のルームコードには絶対に
// 出現しない文字）ため、既存ルームと衝突する心配がなく安定して「存在しない」ケースを再現できる
test('joining with a room code that does not exist shows an immediate error instead of retrying the WebSocket connection (issue #616)', async ({ browser }, testInfo) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await startCoverage(page);

  try {
    await page.goto('/?view=quiz-room&roomId=NOPE99');
    await expect(page.getByText('ルームが見つかりませんでした。ルームコードを確認してください。')).toBeVisible({ timeout: 15000 });
    await captureScreenshot(page, testInfo, 'invalid-room-code-error', '参加者：存在しないルームコードで即座にエラーが表示された状態');
  } finally {
    await stopCoverage(page, testInfo);
    await closeContext(context);
  }
});
