# Backend API仕様書（自動生成）

このファイルは`backend/serverless.yml`のhttpApiイベント定義から`scripts/docs/generate-backend-api.js`によって自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-backend-api.js`を実行する（[issue #901](https://github.com/bamiyanapp/karuta/issues/901)）。

| 関数名 | パス | メソッド | ハンドラー |
| :--- | :--- | :--- | :--- |
| generateEfudaPdf | `/generate-efuda-pdf` | POST | `efudaPdfHandler.generateEfudaPdf` |
| getEfudaPdfStatus | `/generate-efuda-pdf-status` | GET | `efudaPdfHandler.getEfudaPdfStatus` |
| getCategories | `/get-categories` | GET | `handler.getCategories` |
| getComments | `/get-comments` | GET | `handler.getComments` |
| getCongratulationAudio | `/get-congratulation-audio` | GET | `handler.getCongratulationAudio` |
| getPhrase | `/get-phrase` | GET | `handler.getPhrase` |
| getPhrasesList | `/get-phrases-list` | GET | `handler.getPhrasesList` |
| postComment | `/post-comment` | POST | `handler.postComment` |
| checkQuizRoom | `/quiz-room` | GET | `quizRoomHandler.checkQuizRoom` |
| createQuizRoom | `/quiz-room` | POST | `quizRoomHandler.createQuizRoom` |
| listQuizRooms | `/quiz-rooms` | GET | `quizRoomHandler.listQuizRooms` |
| recordTime | `/record-time` | POST | `handler.recordTime` |
