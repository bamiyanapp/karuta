# WebSocket API仕様書（自動生成）

このファイルは`backend/serverless.yml`のwebsocketイベント定義から`scripts/docs/generate-websocket-api.js`によって自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-websocket-api.js`を実行する（[issue #902](https://github.com/bamiyanapp/karuta/issues/902)）。

クイズ大会モードのリアルタイム通信（読み札・結果画面の同期、早押し判定等）に使うAPI Gateway WebSocket API（`backend/quizRoomHandler.js`）のルート一覧。

| ルート | 関数名 | ハンドラー | 実行権限 | ブロードキャスト |
| :--- | :--- | :--- | :--- | :--- |
| `$connect` | connectQuizRoom | `quizRoomHandler.connectQuizRoom` | 制限なし | なし（呼び出し元のみ） |
| `$disconnect` | disconnectQuizRoom | `quizRoomHandler.disconnectQuizRoom` | 制限なし | あり（ルーム内の全接続へ） |
| `buzz` | buzzQuizRoom | `quizRoomHandler.buzzQuizRoom` | 参加者のみ | あり（ルーム内の全接続へ） |
| `closeRoom` | closeQuizRoom | `quizRoomHandler.closeQuizRoom` | 管理者のみ | あり（ルーム内の全接続へ） |
| `judgeBuzz` | judgeQuizRoomBuzz | `quizRoomHandler.judgeQuizRoomBuzz` | 管理者のみ | あり（ルーム内の全接続へ） |
| `resetPoints` | resetQuizRoomPoints | `quizRoomHandler.resetQuizRoomPoints` | 管理者のみ | あり（ルーム内の全接続へ） |
| `setName` | setQuizRoomName | `quizRoomHandler.setQuizRoomName` | 制限なし | あり（ルーム内の全接続へ） |
| `sync` | syncQuizRoom | `quizRoomHandler.syncQuizRoom` | 制限なし | なし（呼び出し元のみ） |
| `updateState` | updateQuizRoomState | `quizRoomHandler.updateQuizRoomState` | 管理者のみ | あり（ルーム内の全接続へ） |

## 代表的な通信フロー（シーケンス図）

実行権限・ブロードキャスト有無は静的解析（`withRoleGuard`/`broadcastToRoom`呼び出しの検出）で機械的に抽出しているが、下記の呼び出し順序自体はコードの意味的な理解に基づき構成したもので、厳密な自動生成ではない点に留意する。

<details>
<summary>ソースを表示（mermaid記法）</summary>

```mermaid
sequenceDiagram
    participant Admin as クライアント（管理者）
    participant Participant as クライアント（参加者）
    participant GW as API Gateway (WebSocket)
    participant L as Lambda（quizRoomHandler）
    participant Room as ルーム内の全接続

    Admin->>GW: $connect（roomId・adminToken）
    GW->>L: connectQuizRoom
    Participant->>GW: $connect（roomId）
    GW->>L: connectQuizRoom
    Participant->>L: sync
    L-->>Participant: 現在の状態（sync）
    Participant->>L: setName
    L->>Room: participants（ブロードキャスト）
    Admin->>L: updateState（読み札の表示等）
    L->>Room: state（ブロードキャスト）
    Participant->>L: buzz
    L->>Room: buzz（ブロードキャスト）
    Admin->>L: judgeBuzz
    alt 正解
        L->>Room: points（ブロードキャスト）
    else 不正解
        L->>Room: roundReset（ブロードキャスト）
    end
    Admin->>L: resetPoints
    L->>Room: points（リセット後、ブロードキャスト）
    Admin->>L: closeRoom
    L->>Room: roomClosed（ブロードキャスト）
    Participant--)GW: $disconnect
    GW--)L: disconnectQuizRoom
    L->>Room: participants（ブロードキャスト）
```

上記の```mermaid```ブロックはPR差分ビュー・API経由でのファイル取得等ではテキストのまま表示され図として確認できない（[#824](https://github.com/bamiyanapp/karuta/issues/824)）。ソースはこのまま維持しつつ、下記は`enable_mermaid_render` job（[docs/cicd-pipeline-specification.md](../cicd-pipeline-specification.md)参照）が`main`へのマージのたびに再レンダリングし、`docs-diagrams`ブランチの`latest/`へ上書き公開している画像（常に最新版）。

</details>

![WebSocket API 通信フロー (rendered)](https://raw.githubusercontent.com/bamiyanapp/karuta/docs-diagrams/latest/websocket-api.png)
