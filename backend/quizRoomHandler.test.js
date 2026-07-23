import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import crypto from 'crypto';
import {
  createQuizRoom,
  listQuizRooms,
  checkQuizRoom,
  connectQuizRoom,
  disconnectQuizRoom,
  syncQuizRoom,
  updateQuizRoomState,
  setQuizRoomName,
  buzzQuizRoom,
  judgeQuizRoomBuzz,
  resetQuizRoomPoints,
} from './quizRoomHandler';

const ddbMock = mockClient(DynamoDBDocumentClient);
const managementApiMock = mockClient(ApiGatewayManagementApiClient);

process.env.QUIZ_ROOMS_TABLE_NAME = 'TestQuizRooms';
process.env.QUIZ_ROOM_CONNECTIONS_TABLE_NAME = 'TestQuizRoomConnections';

function wsEvent({ connectionId = 'conn-1', domainName = 'abc123.execute-api.ap-northeast-1.amazonaws.com', stage = 'dev', body } = {}) {
  return {
    requestContext: { connectionId, domainName, stage },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}

beforeEach(() => {
  ddbMock.reset();
  managementApiMock.reset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // 参加者一覧（issue #545）: syncQuizRoom等は無条件でQueryCommandを叩くようになったため、
  // 個々のテストで参加者一覧の内容を検証しない限りは空配列を既定値としておく
  ddbMock.on(QueryCommand).resolves({ Items: [] });
});

describe('createQuizRoom', () => {
  it('creates a room with a unique code and returns roomId/adminToken', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(PutCommand).resolves({});

    const response = await createQuizRoom({ body: '{}' });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.roomId).toMatch(/^[A-Z2-9]{6}$/);
    expect(typeof body.adminToken).toBe('string');

    const putCall = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putCall.TableName).toBe('TestQuizRooms');
    expect(putCall.Item.roomId).toBe(body.roomId);
    expect(putCall.Item.state).toEqual({});
    // 平文のadminTokenはDBに保存せず、ハッシュのみ保存する
    expect(putCall.Item.adminTokenHash).not.toBe(body.adminToken);
    expect(putCall.Item.adminTokenHash).toBe(
      crypto.createHash('sha256').update(body.adminToken).digest('hex')
    );
  });

  it('retries room code generation on collision and gives up after the attempt limit', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { roomId: 'TAKEN1' } });

    const response = await createQuizRoom({ body: '{}' });

    expect(response.statusCode).toBe(500);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('handles errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await createQuizRoom({ body: '{}' });
    expect(response.statusCode).toBe(500);
  });
});

describe('listQuizRooms', () => {
  beforeEach(() => {
    // issue #617: 一覧の絞り込みは管理者接続の有無をQueryCommandで確認するため、
    // 個々のテストで参加者一覧の内容を検証しない限りは「管理者接続あり」を既定値にする
    // （フィルタ自体は別テストで検証する）
    ddbMock.on(QueryCommand).resolves({ Items: [{ connectionId: 'admin-conn', role: 'admin' }] });
  });

  it('returns open rooms sorted by newest first, without leaking adminTokenHash', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { roomId: 'ROOM01', createdAt: 1000, state: {}, adminTokenHash: 'secret-hash-1' },
        { roomId: 'ROOM02', createdAt: 3000, state: { type: 'phrase', content: { category: 'Cat1' } }, adminTokenHash: 'secret-hash-2' },
        { roomId: 'ROOM03', createdAt: 2000, state: { type: 'initial' }, adminTokenHash: 'secret-hash-3' },
      ],
    });

    const response = await listQuizRooms({});
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.rooms).toEqual([
      { roomId: 'ROOM02', createdAt: 3000, category: 'Cat1' },
      { roomId: 'ROOM03', createdAt: 2000, category: null },
      { roomId: 'ROOM01', createdAt: 1000, category: null },
    ]);
    // adminTokenHashが応答に含まれていないことを確認する
    expect(JSON.stringify(body)).not.toContain('secret-hash');
  });

  it('returns only the latest 5 rooms even when more are open (issue #500)', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: Array.from({ length: 8 }, (_, i) => ({
        roomId: `ROOM0${i}`,
        createdAt: i,
        state: {},
      })),
    });

    const response = await listQuizRooms({});
    const body = JSON.parse(response.body);

    expect(body.rooms).toHaveLength(5);
    expect(body.rooms.map((r) => r.roomId)).toEqual(['ROOM07', 'ROOM06', 'ROOM05', 'ROOM04', 'ROOM03']);
  });

  it('excludes rooms whose ttl has already passed via the filter expression', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });

    const response = await listQuizRooms({});

    expect(response.statusCode).toBe(200);
    const scanCall = ddbMock.commandCalls(ScanCommand)[0].args[0].input;
    expect(scanCall.FilterExpression).toBe('#ttl > :now');
    expect(scanCall.ExpressionAttributeNames).toEqual({ '#state': 'state', '#ttl': 'ttl' });
  });

  it('returns an empty list when no rooms are open', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [] });

    const response = await listQuizRooms({});
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.rooms).toEqual([]);
  });

  it('handles errors', async () => {
    ddbMock.on(ScanCommand).rejects(new Error('DynamoDB error'));
    const response = await listQuizRooms({});
    expect(response.statusCode).toBe(500);
  });

  it('excludes rooms that have no active admin connection, without affecting the latest-5 slicing of the remaining rooms (issue #617)', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { roomId: 'HAS-ADMIN', createdAt: 2000, state: {} },
        { roomId: 'NO-ADMIN', createdAt: 3000, state: {} },
      ],
    });
    ddbMock.on(QueryCommand).callsFake((input) => {
      const roomId = input.ExpressionAttributeValues[':roomId'];
      if (roomId === 'HAS-ADMIN') {
        return { Items: [{ connectionId: 'admin-conn', role: 'admin' }] };
      }
      // 参加者の接続は残っているが管理者は既に切断している「幽霊ルーム」を模す
      return { Items: [{ connectionId: 'participant-conn', role: 'participant' }] };
    });

    const response = await listQuizRooms({});
    const body = JSON.parse(response.body);

    expect(body.rooms.map((r) => r.roomId)).toEqual(['HAS-ADMIN']);
  });
});

describe('checkQuizRoom', () => {
  it('returns exists:true for a room that has not expired', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { roomId: 'ROOM01', ttl: Math.floor(Date.now() / 1000) + 3600 } });

    const response = await checkQuizRoom({ queryStringParameters: { roomId: 'ROOM01' } });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({ exists: true });
  });

  it('returns exists:false when the room does not exist', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const response = await checkQuizRoom({ queryStringParameters: { roomId: 'MISSING' } });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({ exists: false });
  });

  it('returns exists:false when the room record is still present but its ttl has already passed', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { roomId: 'ROOM01', ttl: Math.floor(Date.now() / 1000) - 3600 } });

    const response = await checkQuizRoom({ queryStringParameters: { roomId: 'ROOM01' } });
    const body = JSON.parse(response.body);

    expect(body).toEqual({ exists: false });
  });

  it('returns 400 when roomId is missing', async () => {
    const response = await checkQuizRoom({ queryStringParameters: {} });
    expect(response.statusCode).toBe(400);
  });

  it('handles errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await checkQuizRoom({ queryStringParameters: { roomId: 'ROOM01' } });
    expect(response.statusCode).toBe(500);
  });
});

describe('connectQuizRoom', () => {
  it('rejects when roomId is missing', async () => {
    const response = await connectQuizRoom(wsEvent());
    expect(response.statusCode).toBe(400);
  });

  it('rejects when the room does not exist', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const response = await connectQuizRoom({
      ...wsEvent(),
      queryStringParameters: { roomId: 'NOPE01' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('connects as a participant when no adminToken is given', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { roomId: 'ROOM01', adminTokenHash: 'hash' } });
    ddbMock.on(PutCommand).resolves({});

    const response = await connectQuizRoom({
      ...wsEvent({ connectionId: 'conn-participant' }),
      queryStringParameters: { roomId: 'ROOM01' },
    });

    expect(response.statusCode).toBe(200);
    const putCall = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putCall.Item).toMatchObject({ connectionId: 'conn-participant', roomId: 'ROOM01', role: 'participant' });
  });

  it('connects as admin when adminToken matches the stored hash', async () => {
    const adminToken = 'correct-token';
    const adminTokenHash = crypto.createHash('sha256').update(adminToken).digest('hex');
    ddbMock.on(GetCommand).resolves({ Item: { roomId: 'ROOM01', adminTokenHash } });
    ddbMock.on(PutCommand).resolves({});

    const response = await connectQuizRoom({
      ...wsEvent({ connectionId: 'conn-admin' }),
      queryStringParameters: { roomId: 'ROOM01', adminToken },
    });

    expect(response.statusCode).toBe(200);
    const putCall = ddbMock.commandCalls(PutCommand)[0].args[0].input;
    expect(putCall.Item.role).toBe('admin');
  });

  it('rejects when adminToken does not match the stored hash', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { roomId: 'ROOM01', adminTokenHash: 'correct-hash' } });

    const response = await connectQuizRoom({
      ...wsEvent(),
      queryStringParameters: { roomId: 'ROOM01', adminToken: 'wrong-token' },
    });

    expect(response.statusCode).toBe(403);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('handles errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await connectQuizRoom({
      ...wsEvent(),
      queryStringParameters: { roomId: 'ROOM01' },
    });
    expect(response.statusCode).toBe(500);
  });
});

describe('disconnectQuizRoom', () => {
  it('deletes the connection record', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(DeleteCommand).resolves({});
    const response = await disconnectQuizRoom(wsEvent({ connectionId: 'conn-1' }));
    expect(response.statusCode).toBe(200);
    expect(ddbMock.commandCalls(DeleteCommand)[0].args[0].input.Key).toEqual({ connectionId: 'conn-1' });
  });

  it('does not broadcast when the disconnected connection had no room (e.g. already gone)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    ddbMock.on(DeleteCommand).resolves({});
    await disconnectQuizRoom(wsEvent({ connectionId: 'conn-1' }));
    expect(managementApiMock.commandCalls(PostToConnectionCommand)).toHaveLength(0);
  });

  it('broadcasts the updated participant list (excluding the departed participant) to the remaining connections (issue #545)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant', name: 'たろう' } });
    ddbMock.on(DeleteCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
        { connectionId: 'conn-2', roomId: 'ROOM01', role: 'participant', name: 'はなこ' },
      ],
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await disconnectQuizRoom(wsEvent({ connectionId: 'conn-1' }));

    expect(response.statusCode).toBe(200);
    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    expect(postCalls).toHaveLength(2);
    const targets = postCalls.map((call) => call.args[0].input.ConnectionId).sort();
    expect(targets).toEqual(['conn-2', 'conn-admin']);
    const payload = JSON.parse(Buffer.from(postCalls[0].args[0].input.Data).toString('utf-8'));
    expect(payload).toEqual({ type: 'participants', names: ['はなこ'] });
  });

  it('handles errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await disconnectQuizRoom(wsEvent());
    expect(response.statusCode).toBe(500);
  });
});

describe('syncQuizRoom', () => {
  it('does nothing when the connection is unknown (e.g. already disconnected)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const response = await syncQuizRoom(wsEvent());
    expect(response.statusCode).toBe(200);
    expect(managementApiMock.commandCalls(PostToConnectionCommand)).toHaveLength(0);
  });

  it('sends the current room state back to the caller only', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: { roomId: 'ROOM01', state: { type: 'phrase', phrase: { id: 'p1' } } },
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await syncQuizRoom(wsEvent({ connectionId: 'conn-1' }));

    expect(response.statusCode).toBe(200);
    const call = managementApiMock.commandCalls(PostToConnectionCommand)[0].args[0].input;
    expect(call.ConnectionId).toBe('conn-1');
    const payload = JSON.parse(Buffer.from(call.Data).toString('utf-8'));
    expect(payload).toEqual({ type: 'state', state: { type: 'phrase', phrase: { id: 'p1' } }, role: 'participant' });
  });

  it('also sends the current buzz status to a reconnecting/late-joining participant when someone has already buzzed this round (issue #510)', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: {
        roomId: 'ROOM01',
        state: { type: 'phrase', content: { id: 'p1' } },
        buzz: { connectionId: 'conn-2', name: 'たろう', buzzedAt: 1000 },
      },
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await syncQuizRoom(wsEvent({ connectionId: 'conn-1' }));

    expect(response.statusCode).toBe(200);
    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    expect(postCalls).toHaveLength(3);
    const buzzPayload = JSON.parse(Buffer.from(postCalls[1].args[0].input.Data).toString('utf-8'));
    expect(buzzPayload).toEqual({ type: 'buzz', name: 'たろう', connectionId: 'conn-2' });
  });

  it('does not send a buzz message when no one has buzzed this round', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: { roomId: 'ROOM01', state: { type: 'phrase', content: { id: 'p1' } } },
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    await syncQuizRoom(wsEvent({ connectionId: 'conn-1' }));

    expect(managementApiMock.commandCalls(PostToConnectionCommand)).toHaveLength(2);
  });

  it('also sends the current point standings to a reconnecting/late-joining participant (issue #519)', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: { roomId: 'ROOM01', state: { type: 'phrase', content: { id: 'p1' } }, points: { たろう: 2, はなこ: 1 } },
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    await syncQuizRoom(wsEvent({ connectionId: 'conn-1' }));

    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    expect(postCalls).toHaveLength(3);
    const pointsPayload = JSON.parse(Buffer.from(postCalls[1].args[0].input.Data).toString('utf-8'));
    expect(pointsPayload).toEqual({ type: 'points', points: { たろう: 2, はなこ: 1 }, answerCounts: {} });
  });

  it('also sends the current answer counts (attempts/correct) to a reconnecting/late-joining participant (issue #698)', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: {
        roomId: 'ROOM01',
        state: { type: 'phrase', content: { id: 'p1' } },
        answerCounts: { たろう: { attempts: 3, correct: 2 } },
      },
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    await syncQuizRoom(wsEvent({ connectionId: 'conn-1' }));

    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    const pointsPayload = JSON.parse(Buffer.from(postCalls[1].args[0].input.Data).toString('utf-8'));
    expect(pointsPayload).toEqual({ type: 'points', points: {}, answerCounts: { たろう: { attempts: 3, correct: 2 } } });
  });

  it('does not send a points message when no one has scored yet', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: { roomId: 'ROOM01', state: { type: 'phrase', content: { id: 'p1' } } },
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    await syncQuizRoom(wsEvent({ connectionId: 'conn-1' }));

    expect(managementApiMock.commandCalls(PostToConnectionCommand)).toHaveLength(2);
  });

  it('sends the current participant list to a reconnecting/late-joining connection (issue #545)', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: { roomId: 'ROOM01', state: { type: 'phrase', content: { id: 'p1' } } },
    });
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
        { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant', name: 'たろう' },
        { connectionId: 'conn-2', roomId: 'ROOM01', role: 'participant', name: 'はなこ' },
        { connectionId: 'conn-3', roomId: 'ROOM01', role: 'participant' },
      ],
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    await syncQuizRoom(wsEvent({ connectionId: 'conn-1' }));

    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    const participantsPayload = JSON.parse(
      Buffer.from(postCalls[postCalls.length - 1].args[0].input.Data).toString('utf-8')
    );
    expect(participantsPayload).toEqual({ type: 'participants', names: ['たろう', 'はなこ'] });
  });

  it('handles errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await syncQuizRoom(wsEvent());
    expect(response.statusCode).toBe(500);
  });
});

describe('updateQuizRoomState', () => {
  it('rejects when the caller is not an admin', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' } });
    const response = await updateQuizRoomState(wsEvent({ body: { state: { type: 'phrase' } } }));
    expect(response.statusCode).toBe(403);
  });

  it('rejects when the connection record is missing', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const response = await updateQuizRoomState(wsEvent({ body: { state: { type: 'phrase' } } }));
    expect(response.statusCode).toBe(403);
  });

  it('rejects an invalid (non-object) state', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'admin' } });
    const response = await updateQuizRoomState(wsEvent({ body: { state: 'not-an-object' } }));
    expect(response.statusCode).toBe(400);
  });

  it('rejects an oversized state payload', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'admin' } });
    const response = await updateQuizRoomState(wsEvent({ body: { state: { big: 'x'.repeat(9000) } } }));
    expect(response.statusCode).toBe(400);
  });

  it('updates room state and broadcasts it to every connection in the room', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' } });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
        { connectionId: 'conn-participant', roomId: 'ROOM01', role: 'participant' },
      ],
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const newState = { type: 'phrase', phrase: { id: 'p1', category: 'Cat1' } };
    const response = await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    expect(response.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.Key).toEqual({ roomId: 'ROOM01' });
    expect(updateCall.ExpressionAttributeValues[':state']).toEqual(newState);

    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    expect(postCalls).toHaveLength(2);
    const targets = postCalls.map((call) => call.args[0].input.ConnectionId).sort();
    expect(targets).toEqual(['conn-admin', 'conn-participant']);
    const payload = JSON.parse(Buffer.from(postCalls[0].args[0].input.Data).toString('utf-8'));
    expect(payload.state).toEqual(newState);
  });

  it('resets (removes) the buzz and excludedNames fields when broadcasting a new phrase, so the next round starts unbuzzed (issue #510, #546)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' } });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const newState = { type: 'phrase', phrase: { id: 'p2', category: 'Cat1' } };
    await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.UpdateExpression).toContain('REMOVE buzz, excludedNames');
  });

  it('does not reset the buzz field when broadcasting a result (so the responder stays visible during the result screen)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' } });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const newState = { type: 'result', content: { time: 1.2 } };
    await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.UpdateExpression).not.toContain('REMOVE');
  });

  it('resets the buzz field when broadcasting back to the initial/idle state (e.g. the admin resets the game), so stale buzz info does not leak into the next round', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' } });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const newState = { type: 'initial' };
    await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.UpdateExpression).toContain('REMOVE buzz, excludedNames');
  });

  it('does not touch points when advancing to a new phrase, even if someone had buzzed (points are only awarded via judgeQuizRoomBuzz, issue #546)', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: { roomId: 'ROOM01', buzz: { connectionId: 'conn-p', name: 'たろう', buzzedAt: 1000 } },
    });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
        { connectionId: 'conn-p', roomId: 'ROOM01', role: 'participant' },
      ],
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const newState = { type: 'phrase', phrase: { id: 'p2', category: 'Cat1' } };
    const response = await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    expect(response.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.ExpressionAttributeValues[':points']).toBeUndefined();
    expect(updateCall.UpdateExpression).not.toContain('points');

    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    const pointsMessages = postCalls
      .map((call) => JSON.parse(Buffer.from(call.args[0].input.Data).toString('utf-8')))
      .filter((payload) => payload.type === 'points');
    expect(pointsMessages).toHaveLength(0);
  });

  it('does not reset the buzz/excludedNames fields when the same phrase is merely re-broadcast (e.g. a mid-round settings change), since the round has not actually advanced (issue #519, #546)', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: {
        roomId: 'ROOM01',
        state: { type: 'phrase', content: { id: 'p1', category: 'Cat1' } },
        buzz: { connectionId: 'conn-p', name: 'たろう', buzzedAt: 1000 },
      },
    });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    // 同じ札(id: 'p1')が、speechRate等の変更により再ブロードキャストされたケース
    const newState = { type: 'phrase', content: { id: 'p1', category: 'Cat1' } };
    await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.UpdateExpression).not.toContain('REMOVE');
  });

  it('resets the buzz/excludedNames fields when a genuinely new phrase follows one that was re-broadcast (issue #519, #546)', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: {
        roomId: 'ROOM01',
        state: { type: 'phrase', content: { id: 'p1', category: 'Cat1' } },
        buzz: { connectionId: 'conn-p', name: 'たろう', buzzedAt: 1000 },
      },
    });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const newState = { type: 'phrase', content: { id: 'p2', category: 'Cat1' } };
    await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.UpdateExpression).toContain('REMOVE buzz, excludedNames');
  });

  it('removes a stale connection record when broadcasting hits a GoneException, without failing the whole update', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' } });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({
      Items: [{ connectionId: 'conn-stale', roomId: 'ROOM01', role: 'participant' }],
    });
    ddbMock.on(DeleteCommand).resolves({});
    managementApiMock.on(PostToConnectionCommand).rejects(Object.assign(new Error('Gone'), { name: 'GoneException' }));

    const response = await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: { type: 'phrase' } } }));

    expect(response.statusCode).toBe(200);
    expect(ddbMock.commandCalls(DeleteCommand)[0].args[0].input.Key).toEqual({ connectionId: 'conn-stale' });
  });

  it('handles unexpected errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await updateQuizRoomState(wsEvent({ body: { state: { type: 'phrase' } } }));
    expect(response.statusCode).toBe(500);
  });
});

describe('setQuizRoomName', () => {
  it('saves a trimmed name on the connection record', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' } });
    ddbMock.on(QueryCommand).resolves({ Items: [{ connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' }] });
    ddbMock.on(UpdateCommand).resolves({});
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await setQuizRoomName(wsEvent({ connectionId: 'conn-1', body: { name: '  たろう  ' } }));

    expect(response.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.Key).toEqual({ connectionId: 'conn-1' });
    expect(updateCall.ExpressionAttributeValues[':name']).toBe('たろう');
  });

  it('truncates names longer than the configured limit', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' } });
    ddbMock.on(QueryCommand).resolves({ Items: [{ connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' }] });
    ddbMock.on(UpdateCommand).resolves({});
    managementApiMock.on(PostToConnectionCommand).resolves({});

    await setQuizRoomName(wsEvent({ body: { name: 'x'.repeat(50) } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.ExpressionAttributeValues[':name']).toHaveLength(20);
  });

  it('broadcasts the updated participant list (including the newly-named connection) to every connection in the room (issue #545)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' } });
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
        { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' },
        { connectionId: 'conn-2', roomId: 'ROOM01', role: 'participant', name: 'はなこ' },
      ],
    });
    ddbMock.on(UpdateCommand).resolves({});
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await setQuizRoomName(wsEvent({ connectionId: 'conn-1', body: { name: 'たろう' } }));

    expect(response.statusCode).toBe(200);
    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    expect(postCalls).toHaveLength(3);
    const targets = postCalls.map((call) => call.args[0].input.ConnectionId).sort();
    expect(targets).toEqual(['conn-1', 'conn-2', 'conn-admin']);
    const payload = JSON.parse(Buffer.from(postCalls[0].args[0].input.Data).toString('utf-8'));
    expect(payload).toEqual({ type: 'participants', names: ['たろう', 'はなこ'] });
  });

  it('rejects an empty (or whitespace-only) name', async () => {
    const response = await setQuizRoomName(wsEvent({ body: { name: '   ' } }));
    expect(response.statusCode).toBe(400);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('silently no-ops when the connection record no longer exists (e.g. already disconnected)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const response = await setQuizRoomName(wsEvent({ body: { name: 'たろう' } }));

    expect(response.statusCode).toBe(200);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('rejects a name already used by another connection in the same room, without saving it (issue #519)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-2', roomId: 'ROOM01', role: 'participant' } });
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-1', roomId: 'ROOM01', name: 'たろう' },
        { connectionId: 'conn-2', roomId: 'ROOM01' },
      ],
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await setQuizRoomName(wsEvent({ connectionId: 'conn-2', body: { name: 'たろう' } }));

    expect(response.statusCode).toBe(200);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
    const postCall = managementApiMock.commandCalls(PostToConnectionCommand)[0].args[0].input;
    expect(postCall.ConnectionId).toBe('conn-2');
    const payload = JSON.parse(Buffer.from(postCall.Data).toString('utf-8'));
    expect(payload.type).toBe('nameError');
  });

  it('allows re-saving the same name for the same connection (not a duplicate of itself)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant', name: 'たろう' } });
    ddbMock.on(QueryCommand).resolves({
      Items: [{ connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant', name: 'たろう' }],
    });
    ddbMock.on(UpdateCommand).resolves({});
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await setQuizRoomName(wsEvent({ connectionId: 'conn-1', body: { name: 'たろう' } }));

    expect(response.statusCode).toBe(200);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);
  });

  it('handles unexpected errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await setQuizRoomName(wsEvent({ body: { name: 'たろう' } }));
    expect(response.statusCode).toBe(500);
  });
});

describe('buzzQuizRoom', () => {
  it('rejects when the caller is not a participant (e.g. the admin)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' } });
    const response = await buzzQuizRoom(wsEvent({ connectionId: 'conn-admin' }));
    expect(response.statusCode).toBe(403);
  });

  it('rejects when the connection record is missing', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const response = await buzzQuizRoom(wsEvent());
    expect(response.statusCode).toBe(403);
  });

  it('records the first buzz and broadcasts the responder name to every connection in the room', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { connectionId: 'conn-participant', roomId: 'ROOM01', role: 'participant', name: 'たろう' },
    });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
        { connectionId: 'conn-participant', roomId: 'ROOM01', role: 'participant' },
      ],
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await buzzQuizRoom(wsEvent({ connectionId: 'conn-participant' }));

    expect(response.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.Key).toEqual({ roomId: 'ROOM01' });
    expect(updateCall.ConditionExpression).toBe('attribute_not_exists(buzz) AND (attribute_not_exists(excludedNames) OR NOT contains(excludedNames, :name))');
    expect(updateCall.ExpressionAttributeValues[':buzz']).toMatchObject({
      connectionId: 'conn-participant',
      name: 'たろう',
    });

    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    expect(postCalls).toHaveLength(2);
    const payload = JSON.parse(Buffer.from(postCalls[0].args[0].input.Data).toString('utf-8'));
    expect(payload).toEqual({ type: 'buzz', name: 'たろう', connectionId: 'conn-participant' });
  });

  it('falls back to a default label when the participant never set a name', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { connectionId: 'conn-participant', roomId: 'ROOM01', role: 'participant' },
    });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    await buzzQuizRoom(wsEvent({ connectionId: 'conn-participant' }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.ExpressionAttributeValues[':buzz'].name).toBe('名無しさん');
  });

  it('silently no-ops (does not broadcast) when someone has already buzzed this round', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { connectionId: 'conn-participant', roomId: 'ROOM01', role: 'participant', name: 'はなこ' },
    });
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('cond failed'), { name: 'ConditionalCheckFailedException' }));

    const response = await buzzQuizRoom(wsEvent({ connectionId: 'conn-participant' }));

    expect(response.statusCode).toBe(200);
    expect(managementApiMock.commandCalls(PostToConnectionCommand)).toHaveLength(0);
  });

  it('includes the participant name in the condition check, so a participant excluded this round (judged incorrect, issue #546) cannot re-buzz', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { connectionId: 'conn-participant', roomId: 'ROOM01', role: 'participant', name: 'はなこ' },
    });
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('cond failed'), { name: 'ConditionalCheckFailedException' }));

    const response = await buzzQuizRoom(wsEvent({ connectionId: 'conn-participant' }));

    expect(response.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.ExpressionAttributeValues[':name']).toBe('はなこ');
    expect(managementApiMock.commandCalls(PostToConnectionCommand)).toHaveLength(0);
  });

  it('handles unexpected errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await buzzQuizRoom(wsEvent());
    expect(response.statusCode).toBe(500);
  });
});

describe('judgeQuizRoomBuzz', () => {
  it('rejects when the caller is not an admin', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' } });
    const response = await judgeQuizRoomBuzz(wsEvent({ body: { correct: true } }));
    expect(response.statusCode).toBe(403);
  });

  it('rejects when the connection record is missing', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const response = await judgeQuizRoomBuzz(wsEvent({ body: { correct: true } }));
    expect(response.statusCode).toBe(403);
  });

  it('does nothing when there is no active buzz to judge (e.g. timing mismatch)', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({ Item: { roomId: 'ROOM01' } });

    const response = await judgeQuizRoomBuzz(wsEvent({ connectionId: 'conn-admin', body: { correct: true } }));

    expect(response.statusCode).toBe(200);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('awards a point to the buzzer, clears buzz/excludedNames, and broadcasts updated points when judged correct', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: {
        roomId: 'ROOM01',
        buzz: { connectionId: 'conn-p', name: 'たろう', buzzedAt: 1000 },
        points: { たろう: 1 },
        answerCounts: { たろう: { attempts: 1, correct: 1 } },
      },
    });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
        { connectionId: 'conn-p', roomId: 'ROOM01', role: 'participant' },
      ],
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await judgeQuizRoomBuzz(wsEvent({ connectionId: 'conn-admin', body: { correct: true } }));

    expect(response.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.Key).toEqual({ roomId: 'ROOM01' });
    expect(updateCall.ExpressionAttributeValues[':points']).toEqual({ たろう: 2 });
    // 回答数集計（issue #698）: 正解判定でもattempts/correctを両方インクリメントする
    expect(updateCall.ExpressionAttributeValues[':answerCounts']).toEqual({ たろう: { attempts: 2, correct: 2 } });
    expect(updateCall.UpdateExpression).toBe('SET points = :points, answerCounts = :answerCounts REMOVE buzz, excludedNames');

    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    expect(postCalls).toHaveLength(2);
    const payload = JSON.parse(Buffer.from(postCalls[0].args[0].input.Data).toString('utf-8'));
    expect(payload).toEqual({ type: 'points', points: { たろう: 2 }, answerCounts: { たろう: { attempts: 2, correct: 2 } } });
  });

  it('clears buzz, excludes the participant from the round, and broadcasts a roundReset when judged incorrect', async () => {
    ddbMock.on(GetCommand, { TableName: 'TestQuizRoomConnections' }).resolves({
      Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
    });
    ddbMock.on(GetCommand, { TableName: 'TestQuizRooms' }).resolves({
      Item: { roomId: 'ROOM01', buzz: { connectionId: 'conn-p', name: 'たろう', buzzedAt: 1000 } },
    });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
        { connectionId: 'conn-p', roomId: 'ROOM01', role: 'participant' },
      ],
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await judgeQuizRoomBuzz(wsEvent({ connectionId: 'conn-admin', body: { correct: false } }));

    expect(response.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.Key).toEqual({ roomId: 'ROOM01' });
    expect(updateCall.UpdateExpression).toBe('SET answerCounts = :answerCounts REMOVE buzz ADD excludedNames :names');
    expect(updateCall.ExpressionAttributeValues[':names']).toEqual(new Set(['たろう']));
    expect(updateCall.ExpressionAttributeValues[':points']).toBeUndefined();
    // 回答数集計（issue #698）: 不正解判定でもattemptsはインクリメントされるが、correctはされない
    expect(updateCall.ExpressionAttributeValues[':answerCounts']).toEqual({ たろう: { attempts: 1, correct: 0 } });

    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    expect(postCalls).toHaveLength(2);
    const payload = JSON.parse(Buffer.from(postCalls[0].args[0].input.Data).toString('utf-8'));
    expect(payload).toEqual({ type: 'roundReset', excludedName: 'たろう', answerCounts: { たろう: { attempts: 1, correct: 0 } } });
  });

  it('handles unexpected errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await judgeQuizRoomBuzz(wsEvent({ body: { correct: true } }));
    expect(response.statusCode).toBe(500);
  });
});

describe('resetQuizRoomPoints', () => {
  it('rejects when the caller is not an admin', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-1', roomId: 'ROOM01', role: 'participant' } });
    const response = await resetQuizRoomPoints(wsEvent({}));
    expect(response.statusCode).toBe(403);
  });

  it('rejects when the connection record is missing', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const response = await resetQuizRoomPoints(wsEvent({}));
    expect(response.statusCode).toBe(403);
  });

  it('removes the points attribute and broadcasts an empty points map to every connection (issue #615)', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
    });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' },
        { connectionId: 'conn-p', roomId: 'ROOM01', role: 'participant' },
      ],
    });
    managementApiMock.on(PostToConnectionCommand).resolves({});

    const response = await resetQuizRoomPoints(wsEvent({ connectionId: 'conn-admin' }));

    expect(response.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.Key).toEqual({ roomId: 'ROOM01' });
    // 回答数集計（issue #698）: 2ゲーム目の再スタートとしてanswerCountsもpointsと
    // 同時にリセットする
    expect(updateCall.UpdateExpression).toBe('REMOVE points, answerCounts');

    const postCalls = managementApiMock.commandCalls(PostToConnectionCommand);
    expect(postCalls).toHaveLength(2);
    const payload = JSON.parse(Buffer.from(postCalls[0].args[0].input.Data).toString('utf-8'));
    expect(payload).toEqual({ type: 'points', points: {}, answerCounts: {} });
  });

  it('handles unexpected errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await resetQuizRoomPoints(wsEvent({}));
    expect(response.statusCode).toBe(500);
  });
});
