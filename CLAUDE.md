@dev-standards/CLAUDE.md

## karuta固有ルール

### 対象パッケージ（静的チェック関連）

静的チェック（lint / test / build）の対象パッケージは `frontend` と `backend` の両方とする。両方でエラー0件を確認するまで、コミット作成や完了報告に進んではならない。

### E2Eテスト追加時のスクリーンショット添付

`frontend/e2e/*.spec.js` にテストを新規追加・変更する場合、そのテストで検証する主要な画面・状態変化の要所で `frontend/e2e/screenshot.js` の `captureScreenshot(page, testInfo, name, caption)` を呼び出すこと。これによりCI（`reusable-ci.yml`のE2Eスクリーンショット報告機能、`dev-standards/docs/cicd-pipeline-specification.md`「1. CIワークフロー」参照）がPRコメント・Job Summaryへ画像として表示し、スマホオンリーの開発環境でも実装した画面を目視確認できるようになる（「開発環境の制約（スマホオンリー）」参照）。`captureScreenshot`の呼び出しを忘れると、そのテストが検証した画面が人間から見えないまま埋もれる。

- `name`はファイル名・URLの一部になるためASCII安全な識別子にする
- `caption`には表示内容が分かる日本語の説明文を渡す（省略時は`name`がそのまま見出しに使われ英語的で分かりにくくなる）
- 1テスト内で検証する画面ごとに1枚を目安とし、同一画面内の些末な状態変化まで乱発しない（スクリーンショットが多すぎるとPRが見にくくなる問題はissue #628で別途検討中）
