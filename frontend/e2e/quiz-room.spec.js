import { test, expect } from '@playwright/test';

// クイズ大会モード（issue #470）の管理者→参加者リアルタイム同期を、実際にデプロイ済みの
// バックエンド（REST API + WebSocket API）に対してブラウザ2つ（別コンテキスト＝別端末相当）で検証する。
// このリポジトリにはE2E用のモックバックエンドが存在しないため、本番相当のAWS環境に
// 実際にルームを作成する（TTLで24時間後に自動失効するため、テスト実行が残骸を蓄積し続けることはない）。
test('admin creates a quiz room and a participant sees the same card update in real time', async ({ browser }) => {
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

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

  const participantContext = await browser.newContext();
  const participantPage = await participantContext.newPage();
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

  await adminContext.close();
  await participantContext.close();
});
