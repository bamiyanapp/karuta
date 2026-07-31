# API利用一覧（自動生成）

このファイルはfrontend側のAPI呼び出し箇所（`frontend/src`配下）を`scripts/docs/generate-api-usage.js`で正規表現ベースに静的解析して自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-api-usage.js`を実行する（[issue #909](https://github.com/bamiyanapp/karuta/issues/909)）。

HTTPメソッドは呼び出し箇所付近に`method:`指定が見つからない場合はGETとみなす（fetchの既定メソッドと同じ扱い）。

## HTTP APIの呼び出し箇所

| パス | メソッド | 呼び出し元ファイル |
| :--- | :--- | :--- |
| `/generate-efuda-pdf-status` | GET | `frontend/src/views/PrintEfudaView.jsx` |
| `/get-categories` | GET | `frontend/src/App.jsx` |
| `/get-comments` | GET | `frontend/src/App.jsx` |
| `/get-congratulation-audio` | GET | `frontend/src/hooks/useKarutaReading.js` |
| `/get-phrase` | GET | `frontend/src/App.jsx`<br>`frontend/src/hooks/useKarutaReading.js`<br>`frontend/src/views/QuizRoomView.jsx` |
| `/get-phrases-list` | GET | `frontend/src/App.jsx` |
| `/quiz-room` | GET | `frontend/src/views/QuizRoomView.jsx` |
| `/quiz-rooms` | GET | `frontend/src/hooks/useQuizRoomAdmin.js` |
| `/generate-efuda-pdf` | POST | `frontend/src/views/PrintEfudaView.jsx` |
| `/post-comment` | POST | `frontend/src/App.jsx` |
| `/quiz-room` | POST | `frontend/src/hooks/useQuizRoomAdmin.js` |
| `/record-time` | POST | `frontend/src/hooks/useKarutaReading.js` |

## WebSocket APIの呼び出し箇所

`action`フィールドが、対応する[WebSocket API仕様書](./websocket-api.md)のルート名に対応する。

| action | 呼び出し元ファイル |
| :--- | :--- |
| `buzz` | `frontend/src/hooks/useQuizRoomSync.js` |
| `closeRoom` | `frontend/src/hooks/useQuizRoomSync.js` |
| `judgeBuzz` | `frontend/src/hooks/useQuizRoomSync.js` |
| `resetPoints` | `frontend/src/hooks/useQuizRoomSync.js` |
| `setName` | `frontend/src/hooks/useQuizRoomSync.js` |
| `sync` | `frontend/src/hooks/useQuizRoomSync.js` |
| `updateState` | `frontend/src/hooks/useQuizRoomSync.js` |
