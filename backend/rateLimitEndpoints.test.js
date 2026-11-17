// issue #2188: 認証なしの公開APIへの送信元IP単位のレート制限の、各エンドポイントでの結線を確認する。
// 回数のカウント（dailyRateLimit.js）自体はdev-standards側のテストで検証済みのため、
// ここでは「超過時に429を返し、高コストの処理を行わない」「キャッシュヒットは数えない」を確認する。
// report-client-errorは、handler.test.jsで確認している
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { postComment, getCongratulationAudio, getPhrase } from './handler';
import { generateEfudaPdf } from './efudaPdfHandler';
import { createQuizRoom } from './quizRoomHandler';

const counterMock = mockClient(DynamoDBClient); // レート制限カウンタ（低レベルクライアント）
const ddbMock = mockClient(DynamoDBDocumentClient);
const pollyMock = mockClient(PollyClient);
const lambdaMock = mockClient(LambdaClient);
vi.spyOn(console, 'error').mockImplementation(() => {});

const event = (extra = {}) => ({
  requestContext: { identity: { sourceIp: '203.0.113.9' } },
  ...extra,
});
const exceeded = () => Object.assign(new Error('limit'), { name: 'ConditionalCheckFailedException' });
const countedKeys = () => counterMock.commandCalls(UpdateItemCommand).map((c) => c.args[0].input.Key.limitKey.S);

beforeEach(() => {
  process.env.RATE_LIMIT_TABLE_NAME = 'rate-limit-table';
  counterMock.reset();
  ddbMock.reset();
  pollyMock.reset();
  lambdaMock.reset();
});

afterEach(() => {
  delete process.env.RATE_LIMIT_TABLE_NAME;
});

describe('レート制限の結線（issue #2188）', () => {
  it('post-comment: 超過時は429を返し、DynamoDBへ書き込まない', async () => {
    counterMock.on(UpdateItemCommand).rejects(exceeded());

    const response = await postComment(event({ body: JSON.stringify({ phraseId: 'p1', comment: 'a' }) }));

    expect(response.statusCode).toBe(429);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    expect(countedKeys()[0]).toMatch(/^post-comment#203\.0\.113\.9#/);
  });

  it('get-congratulation-audio: 超過時は429を返し、Pollyを呼ばない', async () => {
    counterMock.on(UpdateItemCommand).rejects(exceeded());

    const response = await getCongratulationAudio(event({ queryStringParameters: {} }));

    expect(response.statusCode).toBe(429);
    expect(pollyMock.commandCalls(SynthesizeSpeechCommand)).toHaveLength(0);
    expect(countedKeys()[0]).toMatch(/^get-congratulation-audio#/);
  });

  it('generate-efuda-pdf: 超過時は429を返し、ワーカーLambdaを起動しない', async () => {
    counterMock.on(UpdateItemCommand).rejects(exceeded());

    const response = await generateEfudaPdf(event({ body: JSON.stringify({ categoryParam: 'c1', side: 'front' }) }));

    expect(response.statusCode).toBe(429);
    expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
    expect(countedKeys()[0]).toMatch(/^generate-efuda-pdf#/);
  });

  it('quiz-room（POST）: 超過時は429を返し、ルームを作成しない', async () => {
    counterMock.on(UpdateItemCommand).rejects(exceeded());

    const response = await createQuizRoom(event({ body: '{}' }));

    expect(response.statusCode).toBe(429);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    expect(countedKeys()[0]).toMatch(/^quiz-room#/);
  });

  describe('get-phrase（キャッシュミスのみ数える）', () => {
    beforeEach(() => {
      process.env.POLLY_CACHE_TABLE_NAME = 'polly-cache';
      ddbMock.on(ScanCommand).resolves({ Items: [{ id: 'p1', category: 'c1', phrase: 'phrase 1', level: '-' }] });
    });
    afterEach(() => {
      delete process.env.POLLY_CACHE_TABLE_NAME;
    });

    it('キャッシュヒット時は回数を数えない', async () => {
      ddbMock.on(GetCommand).resolves({ Item: { id: 'cache', audioData: 'cached-audio' } });

      const response = await getPhrase(event({ queryStringParameters: { id: 'p1' } }));

      expect(response.statusCode).toBe(200);
      expect(counterMock.commandCalls(UpdateItemCommand)).toHaveLength(0);
      expect(pollyMock.commandCalls(SynthesizeSpeechCommand)).toHaveLength(0);
    });

    it('キャッシュミス時は回数を数え、超過時は429を返してPollyを呼ばない', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });
      counterMock.on(UpdateItemCommand).rejects(exceeded());

      const response = await getPhrase(event({ queryStringParameters: { id: 'p1' } }));

      expect(response.statusCode).toBe(429);
      expect(pollyMock.commandCalls(SynthesizeSpeechCommand)).toHaveLength(0);
      expect(countedKeys()[0]).toMatch(/^get-phrase#203\.0\.113\.9#/);
    });
  });
});
