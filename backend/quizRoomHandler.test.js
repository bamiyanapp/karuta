import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import crypto from 'crypto';
import {
  createQuizRoom,
  listQuizRooms,
  connectQuizRoom,
  disconnectQuizRoom,
  syncQuizRoom,
  updateQuizRoomState,
  setQuizRoomName,
  buzzQuizRoom,
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
    ddbMock.on(DeleteCommand).resolves({});
    const response = await disconnectQuizRoom(wsEvent({ connectionId: 'conn-1' }));
    expect(response.statusCode).toBe(200);
    expect(ddbMock.commandCalls(DeleteCommand)[0].args[0].input.Key).toEqual({ connectionId: 'conn-1' });
  });

  it('handles errors', async () => {
    ddbMock.on(DeleteCommand).rejects(new Error('DynamoDB error'));
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
    expect(postCalls).toHaveLength(2);
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

    expect(managementApiMock.commandCalls(PostToConnectionCommand)).toHaveLength(1);
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

  it('resets (removes) the buzz field when broadcasting a new phrase, so the next round starts unbuzzed (issue #510)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' } });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const newState = { type: 'phrase', phrase: { id: 'p2', category: 'Cat1' } };
    await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.UpdateExpression).toContain('REMOVE buzz');
  });

  it('does not reset the buzz field when broadcasting a result (so the responder stays visible during the result screen)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' } });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const newState = { type: 'result', content: { time: 1.2 } };
    await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.UpdateExpression).not.toContain('REMOVE buzz');
  });

  it('resets the buzz field when broadcasting back to the initial/idle state (e.g. the admin resets the game), so stale buzz info does not leak into the next round', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { connectionId: 'conn-admin', roomId: 'ROOM01', role: 'admin' } });
    ddbMock.on(UpdateCommand).resolves({});
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const newState = { type: 'initial' };
    await updateQuizRoomState(wsEvent({ connectionId: 'conn-admin', body: { state: newState } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.UpdateExpression).toContain('REMOVE buzz');
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
    ddbMock.on(UpdateCommand).resolves({});

    const response = await setQuizRoomName(wsEvent({ connectionId: 'conn-1', body: { name: '  たろう  ' } }));

    expect(response.statusCode).toBe(200);
    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.Key).toEqual({ connectionId: 'conn-1' });
    expect(updateCall.ExpressionAttributeValues[':name']).toBe('たろう');
  });

  it('truncates names longer than the configured limit', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await setQuizRoomName(wsEvent({ body: { name: 'x'.repeat(50) } }));

    const updateCall = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateCall.ExpressionAttributeValues[':name']).toHaveLength(20);
  });

  it('rejects an empty (or whitespace-only) name', async () => {
    const response = await setQuizRoomName(wsEvent({ body: { name: '   ' } }));
    expect(response.statusCode).toBe(400);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('silently no-ops when the connection record no longer exists (e.g. already disconnected)', async () => {
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('cond failed'), { name: 'ConditionalCheckFailedException' }));

    const response = await setQuizRoomName(wsEvent({ body: { name: 'たろう' } }));

    expect(response.statusCode).toBe(200);
  });

  it('handles unexpected errors', async () => {
    ddbMock.on(UpdateCommand).rejects(new Error('DynamoDB error'));
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
    expect(updateCall.ConditionExpression).toBe('attribute_not_exists(buzz)');
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

  it('handles unexpected errors', async () => {
    ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));
    const response = await buzzQuizRoom(wsEvent());
    expect(response.statusCode).toBe(500);
  });
});
