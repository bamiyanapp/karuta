// クイズ大会モード（issue #470）のWebSocketハンドラ（quizRoomHandler.js）で
// 重複していた接続取得・ルーム内接続一覧Query・全接続へのブロードキャスト・
// 管理者ガード＋catchブロックを共通化する（issue #804 2）。
//
// judgeQuizRoomBuzz（正解/不正解で2つのブロードキャストを持つ）・closeQuizRoom
// （ブロードキャスト後に追加の切断処理がある）は、配信部分（broadcastToRoom）のみ
// この共通化の対象とし、それぞれの個別ロジックはハンドラ側に残す。

const { GetCommand, QueryCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { docClient } = require("./handler");

async function getConnection(connectionId) {
  const result = await docClient.send(new GetCommand({
    TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
    Key: { connectionId },
  }));
  return result.Item;
}

async function queryRoomConnections(roomId) {
  const result = await docClient.send(new QueryCommand({
    TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
    IndexName: "roomId-index",
    KeyConditionExpression: "roomId = :roomId",
    ExpressionAttributeValues: { ":roomId": roomId },
  }));
  return result.Items || [];
}

function buildManagementApiClient(event) {
  const { domainName, stage } = event.requestContext;
  return new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });
}

// 切断済み接続（GoneException/410）への送信は接続レコードを掃除し、他の接続への
// ブロードキャストは継続できるよう例外を投げずfalseを返す
async function postToConnection(managementApi, connectionId, payload) {
  try {
    await managementApi.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(payload)),
    }));
    return true;
  } catch (error) {
    if (error.name === "GoneException" || error.$metadata?.httpStatusCode === 410) {
      await docClient.send(new DeleteCommand({
        TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
        Key: { connectionId },
      }));
      return false;
    }
    throw error;
  }
}

// 呼び出し側が既にqueryRoomConnections()で取得済みの接続一覧（connections）へ
// payloadを配信する。参加者名の導出等、配信前にconnectionsを使った計算が
// 必要な呼び出し側が多いため、クエリ自体はこの関数の内側では行わない
// （二重クエリを避ける）。除外したい接続があればexcludeConnectionIdで指定する。
// payloadは固定値、または各接続（conn）ごとに内容を変えたい場合は関数を渡せる
// （現状の呼び出し側はすべて固定値のため関数版は使っていないが、拡張の余地として残す）
async function broadcastToRoom(event, connections, payload, { excludeConnectionId } = {}) {
  const managementApi = buildManagementApiClient(event);
  const targets = excludeConnectionId
    ? connections.filter((conn) => conn.connectionId !== excludeConnectionId)
    : connections;
  await Promise.allSettled(
    targets.map((conn) => postToConnection(
      managementApi,
      conn.connectionId,
      typeof payload === "function" ? payload(conn) : payload
    ))
  );
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

// WebSocketカスタムルートの管理者/参加者ガード＋catchブロックの共通化。
// ガードに使う接続の取得（getConnection）自体もここで行うため、ハンドラ側は
// 「ガードを通った後の本処理」だけを書けばよい
function withRoleGuard(role, handler) {
  return async (event) => {
    try {
      const connectionId = event.requestContext.connectionId;
      const connection = await getConnection(connectionId);
      if (!connection || connection.role !== role) {
        return { statusCode: 403, body: "Forbidden" };
      }
      return await handler(event, connection, connectionId);
    } catch (error) {
      console.error(error);
      return { statusCode: 500, body: "Internal Server Error" };
    }
  };
}

// ガード（役割チェック）は不要だがcatchブロックの共通化だけ受けたいハンドラ向け
// （connectQuizRoom・disconnectQuizRoom・syncQuizRoom）
function withCatchAll(handler) {
  return async (event) => {
    try {
      return await handler(event);
    } catch (error) {
      console.error(error);
      return { statusCode: 500, body: "Internal Server Error" };
    }
  };
}

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
