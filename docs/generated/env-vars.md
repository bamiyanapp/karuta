# 環境変数一覧（自動生成）

このファイルは`backend/serverless.yml`の`environment:`定義、および`frontend/src/config.js`の`import.meta.env.VITE_*`参照から`scripts/docs/generate-env-vars.js`によって自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-env-vars.js`を実行する（[issue #908](https://github.com/bamiyanapp/karuta/issues/908)）。

フラットな一覧であり、自然なグラフ構造を持たないため図式化の対象とはしない。

## frontend（Vite環境変数、frontend/src/config.js）

| 環境変数名 | 参照している定数 |
| :--- | :--- |
| `VITE_API_BASE_URL` | `API_BASE_URL`（frontend/src/config.js） |
| `VITE_WS_BASE_URL` | `WS_BASE_URL`（frontend/src/config.js） |

## backend（Lambda環境変数、serverless.yml）

### provider.environment（全関数で共有）

| 環境変数名 | 値 |
| :--- | :--- |
| `TABLE_NAME` | `karuta-phrases` |
| `COMMENTS_TABLE_NAME` | `karuta-comments` |
| `POLLY_CACHE_TABLE_NAME` | `karuta-polly-cache` |
| `EFUDA_PDF_BUCKET_NAME` | `karuta-efuda-pdf-${aws:accountId}` |
| `QUIZ_ROOMS_TABLE_NAME` | `karuta-quiz-rooms` |
| `QUIZ_ROOM_CONNECTIONS_TABLE_NAME` | `karuta-quiz-room-connections` |

### 関数固有の環境変数（上記に追加・上書き）

| 関数名 | 環境変数名 | 値 |
| :--- | :--- | :--- |
| generateEfudaPdf | `RENDER_WORKER_FUNCTION_NAME` | `{"Fn::GetAtt":"RenderEfudaPdfWorkerLambdaFunction.Arn"}` |

