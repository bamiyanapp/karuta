# 外部サービス一覧（自動生成）

このファイルは`backend/serverless.yml`のIAMポリシーステートメント（`Action`）、および設定ファイルの存在・`package.json`のスクリプト内容から`scripts/docs/generate-external-services.js`によって自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-external-services.js`を実行する（[issue #907](https://github.com/bamiyanapp/karuta/issues/907)）。

## AWSサービス（IAM Actionから検出）

| サービス | 使用するAction |
| :--- | :--- |
| Amazon DynamoDB | `dynamodb:DeleteItem`, `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:Query`, `dynamodb:Scan`, `dynamodb:UpdateItem` |
| Amazon API Gateway（Management API、WebSocket接続へのブロードキャスト送信） | `execute-api:ManageConnections` |
| AWS Lambda | `lambda:InvokeFunction` |
| Amazon Polly | `polly:SynthesizeSpeech` |
| Amazon S3 | `s3:GetObject`, `s3:PutObject` |

## AWS以外の外部サービス（設定ファイル・スクリプトから検出）

| サービス | 検出内容 |
| :--- | :--- |
| GitHub Actions | .github/workflows配下のワークフロー（CI/CD） |
| Renovate | renovate.jsonによる依存関係更新PRの自動作成 |
| semantic-release | CD（reusable-cd.yml）でのバージョニング・リリースノート生成 |
| GitHub Pages | frontend/package.jsonの`deploy`スクリプト（gh-pages）によるホスティング |

図式化については、依存元（どのLambda関数・ワークフローが依存するか）まで対応付けるとflowchartとして表現できるが、現状のサービス数・依存元数では表形式でも十分把握できるため、優先度は低いものとして表形式に留める（issue #907のコメント参照）。
