// クイズ大会モード（issue #470）のWebSocketハンドラ（quizRoomHandler.js）で
// 重複していた接続取得・ルーム内接続一覧Query・全接続へのブロードキャスト・
// 管理者ガード＋catchブロックの共通実装は、dev-standardsへ切り出された
// （bamiyanapp/dev-standards issue #479、shared/lambda/webSocketBroadcast.js。
// karuta側の反映はissue #1234）。このファイルはkaruta固有の永続化設定
// （DynamoDBクライアント・テーブル名・AWS SDKのCommandクラス）をwebSocketBroadcast.js
// （symlink先）へ注入する薄いラッパーとして残し、呼び出し側（quizRoomHandler.js）の
// 関数シグネチャは変更していない。
//
// judgeQuizRoomBuzz（正解/不正解で2つのブロードキャストを持つ）・closeQuizRoom
// （ブロードキャスト後に追加の切断処理がある）は、配信部分（broadcastToRoom）のみ
// この共通化の対象とし、それぞれの個別ロジックはハンドラ側に残す。
//
// collectParticipantNames（かるた固有の参加者名導出ロジック）は共通化の対象外のため、
// このファイルにローカル実装として残す。

const { GetCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { docClient } = require("./handler");
const shared = require("./webSocketBroadcast.js"); // symlink先（issue #1234）

function tableName() {
  return process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME;
}

async function getConnection(connectionId) {
  return shared.getConnection({ docClient, GetCommand, tableName: tableName(), connectionId });
}

async function queryRoomConnections(roomId) {
  return shared.queryRoomConnections({ docClient, QueryCommand, tableName: tableName(), roomId });
}

function buildManagementApiClient(event) {
  return shared.buildManagementApiClient({ ApiGatewayManagementApiClient, event });
}

async function postToConnection(managementApi, connectionId, payload) {
  return shared.postToConnection({
    docClient, DeleteCommand, PostToConnectionCommand, managementApi, tableName: tableName(), connectionId, payload,
  });
}

async function broadcastToRoom(event, connections, payload, { excludeConnectionId } = {}) {
  const managementApi = buildManagementApiClient(event);
  return shared.broadcastToRoom({
    docClient, DeleteCommand, PostToConnectionCommand, managementApi, tableName: tableName(),
    connections, payload, excludeConnectionId,
  });
}

// ルーム内接続一覧から参加者名一覧を導出する。setQuizRoomNameのように
// 「自分自身の名前だけ確定前の新しい値に差し替える」必要がある場合のみ
// renameConnectionId/renameToを指定する（それ以外の呼び出し側では未指定でよい）
function collectParticipantNames(connections, { renameConnectionId, renameTo } = {}) {
  return connections
    .filter((conn) => conn.role === "participant")
    .map((conn) => (conn.connectionId === renameConnectionId ? renameTo : conn.name))
    .filter(Boolean);
}

// quizRoomHandler.jsはwithRoleGuard(role, handler)の戻り値をモジュール読み込み時点
// （exports.xxx = withRoleGuard(...)）で確定させるため、ここでtableName()を即時解決
// してshared.withRoleGuardへ渡してしまうと、テスト側がprocess.env.
// QUIZ_ROOM_CONNECTIONS_TABLE_NAMEを設定するより前（ESMの静的importはトップレベルの
// 代入文より先に評価される）の値がクロージャに固定されてしまう。実際のリクエスト
// 処理時点までtableNameの解決を遅延させるため、shared.withRoleGuardの呼び出し自体を
// 返す関数でラップする
function withRoleGuard(role, handler) {
  return (event) => shared.withRoleGuard({ docClient, GetCommand, tableName: tableName(), role, handler })(event);
}

const { withCatchAll } = shared;

module.exports = {
  getConnection,
  queryRoomConnections,
  buildManagementApiClient,
  postToConnection,
  broadcastToRoom,
  collectParticipantNames,
  withRoleGuard,
  withCatchAll,
};
