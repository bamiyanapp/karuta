# DynamoDBテーブル定義書（自動生成）

このファイルは`backend/serverless.yml`の`AWS::DynamoDB::Table`リソース定義から`scripts/docs/generate-dynamodb-tables.js`によって自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-dynamodb-tables.js`を実行する（[issue #903](https://github.com/bamiyanapp/karuta/issues/903)）。

ORM（Prisma/TypeORM等）は使わずAWS SDKを直接呼び出す構成のため、外部キー制約に基づく古典的なER図は対象外とし、各テーブルのキー構造のみを一覧化する。

## karuta-comments

- リソース名（CloudFormation）: `CommentsTable`
- キースキーマ: id (HASH)

## karuta-phrases

- リソース名（CloudFormation）: `KarutaTable`
- キースキーマ: category (HASH), id (RANGE)

## karuta-polly-cache

- リソース名（CloudFormation）: `PollyCacheTable`
- キースキーマ: id (HASH)
- TTL: `ttl`属性（有効）

## karuta-quiz-room-connections

- リソース名（CloudFormation）: `QuizRoomConnectionsTable`
- キースキーマ: connectionId (HASH)
- GSI: `roomId-index`（roomId (HASH)）
- TTL: `ttl`属性（有効）

## karuta-quiz-rooms

- リソース名（CloudFormation）: `QuizRoomsTable`
- キースキーマ: roomId (HASH)
- TTL: `ttl`属性（有効）

