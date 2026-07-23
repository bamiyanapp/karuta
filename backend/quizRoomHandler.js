const crypto = require("crypto");
const { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand, DeleteConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
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

    const candidates = (result.Items || [])
      .map((item) => {
        const type = item.state?.type;
        const content = item.state?.content;
        const category = content?.category || null;
        // issue #501: ステータス（開始前／進行中／終了）とかるた種別を別フィールドで
        // 返す。「終了」は選択中カテゴリの全札を読み終えた場合（result状態の
        // content.isAllRead、issue #502のブロードキャスト拡張で追加）。それ以外は
        // 状態がphrase（読み上げ中）またはresult（各札の結果表示中）であれば「進行中」、
        // まだ一度も札が出題されていなければ「開始前」とする。categoryは各札の
        // 結果表示（result）の間はcontentに含まれず一時的にnullへ戻ることがあるため、
        // ステータスの判定にはtype自体を使い、categoryの有無には依存させない
        const isAllRead = content?.isAllRead === true;
        const status = isAllRead ? "終了" : (type === "phrase" || type === "result") ? "進行中" : "開始前";
        return {
          roomId: item.roomId,
          createdAt: item.createdAt,
          category,
          status,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    // issue #617: 管理者が既に切断した「幽霊ルーム」は一覧から除外する。接続テーブル側に
    // adminConnected相当のフラグを持たせconnect/disconnect時に更新する方式ではなく、
    // 一覧取得のたびにroomId-indexで実際の接続有無を確認する。ルーム数の上限
    // （MAX_OPEN_ROOMS_DISPLAYED）が小さいため追加Query数は限定的であり、
    // フラグの更新漏れ（異常切断時にdisconnectQuizRoomが呼ばれない等）を
    // 気にしなくてよい利点がある
    const roomsWithAdminPresence = await Promise.all(
      candidates.map(async (room) => {
        const connections = await docClient.send(new QueryCommand({
          TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
          IndexName: "roomId-index",
          KeyConditionExpression: "roomId = :roomId",
          ExpressionAttributeValues: { ":roomId": room.roomId },
        }));
        const hasAdmin = (connections.Items || []).some((conn) => conn.role === "admin");
        return hasAdmin ? room : null;
      })
    );

    const rooms = roomsWithAdminPresence
      .filter((room) => room !== null)
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

// GET /quiz-room?roomId=XXX（REST API、issue #616）。参加者がWebSocket接続を
// 試みる前に、ルームコードが実在し失効していないかを軽量に確認するための専用API。
// listQuizRoomsの流用ではなく専用エンドポイントにしたのは、listQuizRoomsが
// 直近5件（MAX_OPEN_ROOMS_DISPLAYED）しか返さないため、それより古い有効な
// ルームを誤って「存在しない」と判定してしまうのを避けるため
exports.checkQuizRoom = async (event) => {
  const allowedOrigin = resolveAllowedOrigin(event);
  try {
    const roomId = event.queryStringParameters?.roomId;
    if (!roomId) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": allowedOrigin },
        body: JSON.stringify({ message: "roomId is required" }),
      };
    }

    const room = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId },
    }));
    const now = Math.floor(Date.now() / 1000);
    // listQuizRoomsと同様、TTL失効後の実削除には最大48時間程度のラグが
    // 生じ得るため、レコードが残っていてもttlを過ぎていれば存在しない扱いにする
    const exists = !!room.Item && (!room.Item.ttl || room.Item.ttl > now);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": allowedOrigin },
      body: JSON.stringify({ exists }),
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
    const connectionId = event.requestContext.connectionId;
    const connection = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId },
    }));
    await docClient.send(new DeleteCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId },
    }));

    // 参加者一覧（issue #545）: 切断は参加者一覧からも即座に消す。残りの接続へ
    // 更新後の一覧をブロードキャストする（削除済みなので自分自身は含まれない）
    if (connection.Item?.roomId) {
      const { roomId, name } = connection.Item;
      // 名前の重複予約（issue #618）を解放し、同じ名前で他の参加者・自分自身の
      // 再入室が再びできるようにする
      if (name) {
        await releaseQuizRoomName(roomId, name);
      }
      const connections = await docClient.send(new QueryCommand({
        TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
        IndexName: "roomId-index",
        KeyConditionExpression: "roomId = :roomId",
        ExpressionAttributeValues: { ":roomId": roomId },
      }));
      const remaining = connections.Items || [];
      const participantNames = remaining
        .filter((conn) => conn.role === "participant" && conn.name)
        .map((conn) => conn.name);
      const managementApi = buildManagementApiClient(event);
      await Promise.allSettled(
        remaining.map((conn) => postToConnection(managementApi, conn.connectionId, {
          type: "participants",
          names: participantNames,
        }))
      );
    }

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

    // ポイント制（issue #519）・回答数集計（issue #698）: 再接続・遅れて参加した
    // 端末にも現在の集計を伝える
    if (room.Item.points || room.Item.answerCounts) {
      await postToConnection(managementApi, connectionId, {
        type: "points",
        points: room.Item.points || {},
        answerCounts: room.Item.answerCounts || {},
      });
    }

    // 参加者一覧（issue #545）: 再接続・遅れて参加した端末にも現在の参加者一覧を伝える
    const roomConnections = await docClient.send(new QueryCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      IndexName: "roomId-index",
      KeyConditionExpression: "roomId = :roomId",
      ExpressionAttributeValues: { ":roomId": connection.Item.roomId },
    }));
    const participantNames = (roomConnections.Items || [])
      .filter((conn) => conn.role === "participant" && conn.name)
      .map((conn) => conn.name);
    await postToConnection(managementApi, connectionId, {
      type: "participants",
      names: participantNames,
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

    const room = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId },
    }));

    // 読み上げ設定の変更等で、ラウンドが進んだわけではなく同じ札のphraseが
    // 再ブロードキャストされることがある（App.jsxのbroadcast effect参照）。
    // このケースを新しいラウンドの開始と誤認すると、まだ判定が済んでいない
    // 早押し記録を消してしまうため、直前の状態と札のidを比較して区別する
    const isSamePhraseRebroadcast = newState.type === "phrase"
      && room.Item?.state?.type === "phrase"
      && room.Item?.state?.content?.id === newState.content?.id;

    // 早押し正誤判定（issue #546）: ポイント付与は管理者の正誤判定
    // （judgeQuizRoomBuzz）でのみ行う。「次の札」へ進んだ時点でまだ判定されて
    // いない早押しがあっても加点しない（未判定は無効試行として扱う）。
    // 新しい札（次の問題）や、ゲームのリセット等で"initial"に戻った場合は、
    // 前のラウンドの早押し・除外状態をリセットする。result表示中や、同じ札の
    // 再ブロードキャスト中は、まだそのラウンドの判定を確定させたくないため
    // リセットしない
    const resetRound = newState.type !== "result" && !isSamePhraseRebroadcast;
    const updateExpression = resetRound
      ? "SET #state = :state, #ttl = :ttl REMOVE buzz, excludedNames"
      : "SET #state = :state, #ttl = :ttl";
    await docClient.send(new UpdateCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId },
      UpdateExpression: updateExpression,
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

// WebSocketカスタムルート"judgeBuzz"（issue #546）。管理者のみが早押しの正誤を
// 判定できる。正解の場合はその参加者に1ポイント加点し、buzz/excludedNamesを
// リセットする（次のラウンドまで早押しは確定済みのまま据え置かれる）。
// 不正解の場合はbuzzのみリセットして他の参加者が再度早押しできるようにしつつ、
// 誤答した本人は今ラウンドの早押し対象から除外し、ルーム内の全接続へ
// ラウンドリセットを通知する
exports.judgeQuizRoomBuzz = async (event) => {
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
    const correct = body.correct === true;
    const { roomId } = connection.Item;

    const room = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId },
    }));
    const buzzedName = room.Item?.buzz?.name;
    if (!buzzedName) {
      // 判定対象の早押しが既に無い（タイミングのズレ等）。何もしない
      return { statusCode: 200, body: "" };
    }

    const connections = await docClient.send(new QueryCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      IndexName: "roomId-index",
      KeyConditionExpression: "roomId = :roomId",
      ExpressionAttributeValues: { ":roomId": roomId },
    }));
    const managementApi = buildManagementApiClient(event);

    // 回答数集計（issue #698）: 早押しして正誤判定された累計回数（attempts）と、
    // そのうち正解と判定された累計回数（correct）を、正解・不正解いずれの
    // 判定でも記録する。pointsと同様にDynamoDBのルームアイテムへ保持するため、
    // 切断・退室後も（pointsと同じ寿命で）残り続ける
    const updatedAnswerCounts = { ...(room.Item.answerCounts || {}) };
    const previousCount = updatedAnswerCounts[buzzedName] || { attempts: 0, correct: 0 };
    updatedAnswerCounts[buzzedName] = {
      attempts: previousCount.attempts + 1,
      correct: previousCount.correct + (correct ? 1 : 0),
    };

    if (correct) {
      const updatedPoints = { ...(room.Item.points || {}) };
      updatedPoints[buzzedName] = (updatedPoints[buzzedName] || 0) + 1;
      await docClient.send(new UpdateCommand({
        TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
        Key: { roomId },
        UpdateExpression: "SET points = :points, answerCounts = :answerCounts REMOVE buzz, excludedNames",
        ExpressionAttributeValues: { ":points": updatedPoints, ":answerCounts": updatedAnswerCounts },
      }));
      await Promise.allSettled(
        (connections.Items || []).map((conn) => postToConnection(managementApi, conn.connectionId, {
          type: "points",
          points: updatedPoints,
          answerCounts: updatedAnswerCounts,
        }))
      );
    } else {
      await docClient.send(new UpdateCommand({
        TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
        Key: { roomId },
        UpdateExpression: "SET answerCounts = :answerCounts REMOVE buzz ADD excludedNames :names",
        ExpressionAttributeValues: { ":answerCounts": updatedAnswerCounts, ":names": new Set([buzzedName]) },
      }));
      await Promise.allSettled(
        (connections.Items || []).map((conn) => postToConnection(managementApi, conn.connectionId, {
          type: "roundReset",
          excludedName: buzzedName,
          answerCounts: updatedAnswerCounts,
        }))
      );
    }

    return { statusCode: 200, body: "" };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

// WebSocketカスタムルート"resetPoints"（issue #615）。管理者のみがポイント集計を
// 初期化できる。同じルームで2ゲーム目を始める際、前のゲームのポイントを引き継がずに
// 再スタートしたい場合に使う。ゲームリセット（"initial"へ戻る）のたびに自動では
// リセットしない。カテゴリを切り替えても通算得点で戦い続けたいユースケースもあり、
// 自動リセットにするとそれを一律に壊してしまうため、管理者の明示操作のみで行う
exports.resetQuizRoomPoints = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const connection = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId },
    }));
    if (!connection.Item || connection.Item.role !== "admin") {
      return { statusCode: 403, body: "Forbidden" };
    }

    const { roomId } = connection.Item;
    // 回答数集計（issue #698）: 同じルームで2ゲーム目を始める際の再スタートなので、
    // pointsと同じタイミングでanswerCountsもリセットする
    await docClient.send(new UpdateCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId },
      UpdateExpression: "REMOVE points, answerCounts",
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
        type: "points",
        points: {},
        answerCounts: {},
      }))
    );

    return { statusCode: 200, body: "" };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

// WebSocketカスタムルート"closeRoom"（issue #748）。管理者のみルームを明示的に終了できる。
// ルームレコード自体を削除するため、以後の$connect試行は404で拒否される。ルーム内の
// 全接続（参加者・管理者自身の他接続含む）へ終了をブロードキャストしたうえで、
// 各接続をDeleteConnectionCommandで強制切断する。切断により$disconnectが呼ばれ、
// 既存のdisconnectQuizRoom（接続レコード削除・予約名の解放）が自然に走るため、
// このハンドラ側で接続レコードを個別に掃除する必要はない
exports.closeQuizRoom = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const connection = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId },
    }));
    if (!connection.Item || connection.Item.role !== "admin") {
      return { statusCode: 403, body: "Forbidden" };
    }

    const { roomId } = connection.Item;

    await docClient.send(new DeleteCommand({
      TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
      Key: { roomId },
    }));

    const connections = await docClient.send(new QueryCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      IndexName: "roomId-index",
      KeyConditionExpression: "roomId = :roomId",
      ExpressionAttributeValues: { ":roomId": roomId },
    }));
    const managementApi = buildManagementApiClient(event);
    const items = connections.Items || [];
    await Promise.allSettled(
      items.map((conn) => postToConnection(managementApi, conn.connectionId, { type: "roomClosed" }))
    );
    await Promise.allSettled(
      items.map((conn) => managementApi.send(new DeleteConnectionCommand({ ConnectionId: conn.connectionId })).catch(() => {}))
    );

    return { statusCode: 200, body: "" };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

// WebSocketカスタムルート"setName"（早押し機能、issue #510）。参加者（管理者含む、
// ただし実際に使うのは参加者のみ）が自分の表示名を接続情報へ保存する
// QuizRoomsTable.names（String Set）へ名前を原子的に予約する。ADD ... NOT contains(...)は
// DynamoDBが単一の条件付き書き込みとして原子的に評価するため、2接続がほぼ同時に同じ名前を
// 予約しようとしても一方だけが必ず成功する（issue #618。従来のread-then-write方式は
// Query→比較→Updateの間に他方の書き込みが割り込むと両方のQueryが互いを観測できずすり抜けていた）
async function reserveQuizRoomName(roomId, name) {
  await docClient.send(new UpdateCommand({
    TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
    Key: { roomId },
    UpdateExpression: "ADD #names :nameSet",
    ConditionExpression: "attribute_not_exists(#names) OR NOT contains(#names, :name)",
    ExpressionAttributeNames: { "#names": "names" },
    ExpressionAttributeValues: { ":nameSet": new Set([name]), ":name": name },
  }));
}

// 予約済みの名前を解放する（切断時・別名への変更時）。namesが未作成でも
// DynamoDBのDELETEは対象要素が無ければ何もしないため、事前の存在確認は不要
async function releaseQuizRoomName(roomId, name) {
  if (!name) return;
  await docClient.send(new UpdateCommand({
    TableName: process.env.QUIZ_ROOMS_TABLE_NAME,
    Key: { roomId },
    UpdateExpression: "DELETE #names :nameSet",
    ExpressionAttributeNames: { "#names": "names" },
    ExpressionAttributeValues: { ":nameSet": new Set([name]) },
  }));
}

exports.setQuizRoomName = async (event) => {
  try {
    const connectionId = event.requestContext.connectionId;
    const body = JSON.parse(event.body || "{}");
    const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
    if (!name) {
      return { statusCode: 400, body: "Invalid name" };
    }

    const connection = await docClient.send(new GetCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      Key: { connectionId },
    }));
    if (!connection.Item) {
      // 接続情報が既に無い（切断済み等）。名前の保存自体は無意味なので何もしない
      return { statusCode: 200, body: "" };
    }

    // ポイント制（issue #519）はnameを集計キーにするため、同一ルーム内で名前が
    // 重複すると他人のポイントと混ざってしまう。参加時点で重複を禁止する
    const { roomId, name: previousName } = connection.Item;
    const isRenaming = previousName !== name;

    if (isRenaming) {
      try {
        await reserveQuizRoomName(roomId, name);
      } catch (reserveError) {
        if (reserveError.name === "ConditionalCheckFailedException") {
          const managementApi = buildManagementApiClient(event);
          await postToConnection(managementApi, connectionId, {
            type: "nameError",
            message: "その名前は既に使われています。別の名前を入力してください。",
          });
          return { statusCode: 200, body: "" };
        }
        throw reserveError;
      }
    }

    try {
      await docClient.send(new UpdateCommand({
        TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
        Key: { connectionId },
        UpdateExpression: "SET #name = :name",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: { ":name": name },
        ConditionExpression: "attribute_exists(connectionId)",
      }));
    } catch (updateError) {
      // 接続が消えていた場合、予約した名前を解放してから終了する
      if (isRenaming) {
        await releaseQuizRoomName(roomId, name);
      }
      if (updateError.name === "ConditionalCheckFailedException") {
        return { statusCode: 200, body: "" };
      }
      throw updateError;
    }

    if (isRenaming && previousName) {
      await releaseQuizRoomName(roomId, previousName);
    }

    // 参加者一覧（issue #545）: 名前が確定したら、ルーム内の全接続（管理者含む）へ
    // 更新後の参加者一覧をブロードキャストする
    const connections = await docClient.send(new QueryCommand({
      TableName: process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME,
      IndexName: "roomId-index",
      KeyConditionExpression: "roomId = :roomId",
      ExpressionAttributeValues: { ":roomId": roomId },
    }));
    const managementApi = buildManagementApiClient(event);
    const participantNames = (connections.Items || [])
      .filter((conn) => conn.role === "participant")
      .map((conn) => (conn.connectionId === connectionId ? name : conn.name))
      .filter(Boolean);
    await Promise.allSettled(
      (connections.Items || []).map((conn) => postToConnection(managementApi, conn.connectionId, {
        type: "participants",
        names: participantNames,
      }))
    );

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
// 回答者名をブロードキャストする（早押し結果のリセットはupdateQuizRoomState側で行う）。
// 正誤判定（issue #546）で不正解と判定された参加者は、そのラウンド中は
// 再度早押しできない（excludedNamesに含まれる名前を条件付き書き込みで弾く）
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
        ConditionExpression: "attribute_not_exists(buzz) AND (attribute_not_exists(excludedNames) OR NOT contains(excludedNames, :name))",
        ExpressionAttributeValues: { ":buzz": buzz, ":name": buzz.name },
      }));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        // 既に他の参加者が先に押している、またはこのラウンドで不正解判定済みで
        // 除外されている。いずれも早押しの結果は変えず、何もしない
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
