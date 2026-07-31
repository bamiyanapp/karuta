# WebSocket API仕様書（自動生成）

このファイルは`backend/serverless.yml`のwebsocketイベント定義から`scripts/docs/generate-websocket-api.js`によって自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-websocket-api.js`を実行する（[issue #902](https://github.com/bamiyanapp/karuta/issues/902)）。

クイズ大会モードのリアルタイム通信（読み札・結果画面の同期、早押し判定等）に使うAPI Gateway WebSocket API（`backend/quizRoomHandler.js`）のルート一覧。

| ルート | 関数名 | ハンドラー |
| :--- | :--- | :--- |
| `$connect` | connectQuizRoom | `quizRoomHandler.connectQuizRoom` |
| `$disconnect` | disconnectQuizRoom | `quizRoomHandler.disconnectQuizRoom` |
| `buzz` | buzzQuizRoom | `quizRoomHandler.buzzQuizRoom` |
| `closeRoom` | closeQuizRoom | `quizRoomHandler.closeQuizRoom` |
| `judgeBuzz` | judgeQuizRoomBuzz | `quizRoomHandler.judgeQuizRoomBuzz` |
| `resetPoints` | resetQuizRoomPoints | `quizRoomHandler.resetQuizRoomPoints` |
| `setName` | setQuizRoomName | `quizRoomHandler.setQuizRoomName` |
| `sync` | syncQuizRoom | `quizRoomHandler.syncQuizRoom` |
| `updateState` | updateQuizRoomState | `quizRoomHandler.updateQuizRoomState` |
