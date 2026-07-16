const crypto = require("crypto");
const { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
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
const MAX_NAME_LENGTH = 20; // 早押し機能（issue #510）: 参加者名の肥大化・表示崩れを防ぐ上限
const MAX_OPEN_ROOMS_DISPLAYED = 5; // トップページの一覧が無制限に肥大化しないための上限（issue #500）

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

// GET /quiz-rooms（REST API、issue #489）。開設中（TTLで失効していない）のルームを
// 一覧で返す。トップページから、参加者がルームコードを知らなくても一覧から直接参加できる
// ようにするための機能。管理者トークンのハッシュ等、参加者に不要な情報は返さない
exports.listQuizRooms = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await docClient.send(new ScanCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      ProjectionExpression: "roomId, createdAt, #state, #ttl",
      ExpressionAttributeNames: { "#state": "state", "#ttl": "ttl" },
      // TTLによる実際の削除には失効後最大48時間程度のラグが生じ得るため、
      // 削除待ちの失効済みルームを一覧から明示的に除外する
      FilterExpression: "#ttl > :now",
      ExpressionAttributeValues: { ":now": now },
    }));

    const rooms = (result.Items || [])
      .map((item) => ({
        roomId: item.roomId,
        createdAt: item.createdAt,
        category: item.state?.content?.category || null,
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_OPEN_ROOMS_DISPLAYED);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ rooms }),
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

    // 早押し機能（issue #510）: 再接続・遅れて参加した端末でも、現在のラウンドで
    // 既に誰かが早押し済みであることが分かるようにする
    if (room.Item.buzz) {
      await postToConnection(managementApi, connectionId, {
        type: "buzz",
        name: room.Item.buzz.name,
        connectionId: room.Item.buzz.connectionId,
      });
    }

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
    // 早押し機能（issue #510）: 新しい札（次の問題）や、ゲームのリセット等で"initial"に
    // 戻った場合は、前のラウンドの早押し結果をリセットする。result表示中だけは次の札が
    // 出るまで回答者を表示し続けたいため、typeが"result"のときだけリセットしない
    const resetBuzz = newState.type !== "result" ? " REMOVE buzz" : "";
    await docClient.send(new UpdateCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId },
      UpdateExpression: `SET #state = :state, #ttl = :ttl${resetBuzz}`,
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

// WebSocketカスタムルート"setName"（早押し機能、issue #510）。参加者（管理者含む、
// ただし実際に使うのは参加者のみ）が自分の表示名を接続情報へ保存する
exports.setQuizRoomName = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body || "{}");
    const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
    if (!name) {
      return { statusCode: 400, body: "Invalid name" };
    }

    await docClient.send(new UpdateCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId },
      UpdateExpression: "SET #name = :name",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: { ":name": name },
      ConditionExpression: "attribute_exists(connectionId)",
    }));

    return { statusCode: 200, body: "" };
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      // 接続情報が既に無い（切断済み等）。名前の保存自体は無意味なので何もしない
      return { statusCode: 200, body: "" };
    }
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

// WebSocketカスタムルート"buzz"（早押し機能、issue #510）。参加者のみが押せる。
// 同一ラウンド内で最初の1件だけを条件付き書き込みで確定させ、ルーム内の全接続へ
// 回答者名をブロードキャストする（早押し結果のリセットはupdateQuizRoomState側で行う）
exports.buzzQuizRoom = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const connection = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId },
    }));
    if (!connection.Item || connection.Item.role !== "participant") {
      return { statusCode: 403, body: "Forbidden" };
    }

    const { roomId, name } = connection.Item;
    const buzz = {
      connectionId,
      name: name || "名無しさん",
      buzzedAt: Date.now(),
    };

    try {
      await docClient.send(new UpdateCommand({
        TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
        Key: { roomId },
        UpdateExpression: "SET buzz = :buzz",
        ConditionExpression: "attribute_not_exists(buzz)",
        ExpressionAttributeValues: { ":buzz": buzz },
      }));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        // 既に他の参加者が先に押している。早押しの結果は変えず、何もしない
        return { statusCode: 200, body: "" };
      }
      throw error;
    }

    const connections = await docClient.send(new QueryCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      IndexName: "roomId-index",
      KeyConditionExpression: "roomId = :roomId",
      ExpressionAttributeValues: { ":roomId": roomId },
    }));

    const managementApi = buildManagementApiClient(event);
    await Promise.allSettled(
      (connections.Items || []).map((conn) => postToConnection(managementApi, conn.connectionId, {
        type: "buzz",
        name: buzz.name,
        connectionId: buzz.connectionId,
      }))
    );

    return { statusCode: 200, body: "" };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};
