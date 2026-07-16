const crypto = require("crypto");
const { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { docClient, resolveAllowedOrigin } = require("./handler");

// issue #470: クイズ大会モード（管理者ルーム開設＋複数端末同期）の最小構成。
// 音声の同期再生・参加者一覧表示等は初回リリースのスコープ外とし、
// 「同じ札が見える」ことだけをWebSocket経由でリアルタイムに実現する

const ROOM_TTL_SECONDS = 60 * 60 * 24; // ルームは24時間で自動失効させる（無人ルームの残存を防ぐ）
const CONNECTION_TTL_SECONDS = 60 * 60 * 24; // $disconnectが確実に呼ばれない異常切断時の保険
// 誤読・誤入力しやすい0/O・1/I/Lはルームコードから除外する
const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const MAX_CREATE_ROOM_ATTEMPTS = 5; // ルームコード衝突時の再採番の上限
const MAX_STATE_JSON_LENGTH = 8000; // 状態データの肥大化・課金濫用を防ぐ上限

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_CHARS[crypto.randomInt(ROOM_CODE_CHARS.length)];
  }
  return code;
}

// 管理者トークンはDynamoDBにハッシュのみ保存し、平文はレスポンス経由で
// 管理者の端末にのみ渡す（DB漏洩時にトークンそのものが漏れないようにする）
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// POST /quiz-room（REST API）。管理者用のルームを新規作成し、ルームIDと管理者トークンを返す
exports.createQuizRoom = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    let roomId = null;
    for (let attempt = 0; attempt < MAX_CREATE_ROOM_ATTEMPTS; attempt += 1) {
      const candidate = generateRoomCode();
      const existing = await docClient.send(new GetCommand({
        TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
        Key: { roomId: candidate },
      }));
      if (!existing.Item) {
        roomId = candidate;
        break;
      }
    }
    if (!roomId) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ message: "ルームコードの採番に失敗しました。もう一度お試しください。" }),
      };
    }

    const adminToken = crypto.randomUUID();
    const now = Date.now();
    await docClient.send(new PutCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Item: {
        roomId,
        adminTokenHash: hashToken(adminToken),
        state: {},
        createdAt: now,
        ttl: Math.floor(now / 1000) + ROOM_TTL_SECONDS,
      },
    }));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ roomId, adminToken }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};

// WebSocket $connect。roomId（必須）はクエリパラメータで受け取り、
// adminTokenの有無・一致で管理者/参加者の役割を判定する
exports.connectQuizRoom = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const { roomId, adminToken } = params;
    if (!roomId) {
      return { statusCode: 400, body: "roomId is required" };
    }

    const room = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId },
    }));
    if (!room.Item) {
      return { statusCode: 404, body: "Room not found" };
    }

    let role = "participant";
    if (adminToken) {
      if (hashToken(adminToken) !== room.Item.adminTokenHash) {
        return { statusCode: 403, body: "Invalid admin token" };
      }
      role = "admin";
    }

    const now = Date.now();
    await docClient.send(new PutCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Item: {
        connectionId: event.requestContext.connectionId,
        roomId,
        role,
        connectedAt: now,
        ttl: Math.floor(now / 1000) + CONNECTION_TTL_SECONDS,
      },
    }));

    return { statusCode: 200, body: "Connected" };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

// WebSocket $disconnect
exports.disconnectQuizRoom = async (event) => {
  try {
    await docClient.send(new DeleteCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId: event.requestContext.connectionId },
    }));
    return { statusCode: 200, body: "Disconnected" };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

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

// WebSocketカスタムルート"sync"（routeSelectionExpression: $request.body.action）。
// 接続直後にクライアント側から呼ばれ、現在のルーム状態を呼び出し元1件にだけ返す
exports.syncQuizRoom = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const connection = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId },
    }));
    if (!connection.Item) {
      return { statusCode: 200, body: "" };
    }

    const room = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId: connection.Item.roomId },
    }));
    if (!room.Item) {
      return { statusCode: 200, body: "" };
    }

    const managementApi = buildManagementApiClient(event);
    await postToConnection(managementApi, connectionId, {
      type: "state",
      state: room.Item.state || {},
      role: connection.Item.role,
    });

    return { statusCode: 200, body: "" };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

// WebSocketカスタムルート"updateState"。管理者のみが状態を更新でき、
// 更新後はルーム内の全接続（管理者自身を含む）へブロードキャストする
exports.updateQuizRoomState = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const connection = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId },
    }));
    if (!connection.Item || connection.Item.role !== "admin") {
      return { statusCode: 403, body: "Forbidden" };
    }

    const body = JSON.parse(event.body || "{}");
    const newState = body.state;
    const stateJson = JSON.stringify(newState ?? null);
    if (!newState || typeof newState !== "object" || Array.isArray(newState) || stateJson.length > MAX_STATE_JSON_LENGTH) {
      return { statusCode: 400, body: "Invalid state" };
    }

    const { roomId } = connection.Item;
    await docClient.send(new UpdateCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId },
      UpdateExpression: "SET #state = :state, #ttl = :ttl",
      ExpressionAttributeNames: { "#state": "state", "#ttl": "ttl" },
      ExpressionAttributeValues: {
        ":state": newState,
        ":ttl": Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
      },
    }));

    const connections = await docClient.send(new QueryCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      IndexName: "roomId-index",
      KeyConditionExpression: "roomId = :roomId",
      ExpressionAttributeValues: { ":roomId": roomId },
    }));

    const managementApi = buildManagementApiClient(event);
    await Promise.allSettled(
      (connections.Items || []).map((conn) => postToConnection(managementApi, conn.connectionId, {
        type: "state",
        state: newState,
        role: conn.role,
      }))
    );

    return { statusCode: 200, body: "" };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
