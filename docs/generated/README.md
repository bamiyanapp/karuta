# 自動生成ドキュメント

このディレクトリのファイルは、`scripts/docs/`配下のスクリプトによってコード・設定ファイルの静的解析から自動生成される。**手動で編集しないこと**（再生成すると上書きされる）。

再生成するには、リポジトリルートで以下を実行する。

```
npm run docs:generate
```

| ファイル | 生成元 | 対応Issue |
| :--- | :--- | :--- |
| [backend-api.md](./backend-api.md) | `backend/serverless.yml`のhttpApiイベント定義 | [#901](https://github.com/bamiyanapp/karuta/issues/901) |
| [websocket-api.md](./websocket-api.md) | `backend/serverless.yml`のwebsocketイベント定義（Mermaidシーケンス図を含む） | [#902](https://github.com/bamiyanapp/karuta/issues/902) |
| [dynamodb-tables.md](./dynamodb-tables.md) | `backend/serverless.yml`の`AWS::DynamoDB::Table`リソース定義（Mermaid ER図を含む） | [#903](https://github.com/bamiyanapp/karuta/issues/903) |
| [serverless-architecture.md](./serverless-architecture.md) | `backend/serverless.yml`のリソース定義・各Lambda関数コードの環境変数参照（Mermaidフロー図） | [#904](https://github.com/bamiyanapp/karuta/issues/904) |
| [cicd-architecture.md](./cicd-architecture.md) | dev-standardsの`reusable-ci.yml`・karutaの`ci.yml`/`cd.yml`のjob依存関係（Mermaidフロー図） | [#905](https://github.com/bamiyanapp/karuta/issues/905) |
| [api-usage.md](./api-usage.md) | `frontend/src`配下のAPI呼び出し箇所 | [#909](https://github.com/bamiyanapp/karuta/issues/909) |

生成タイミングのCI組み込み（PRごとの自動再生成・ドリフト検知等）は未対応。方針は[issue #900](https://github.com/bamiyanapp/karuta/issues/900)の検討事項を参照し、別途フォローアップで対応する。
