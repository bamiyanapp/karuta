import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { getCategories, getPhrasesList, getComments, postComment, getPhrase, getCongratulationAudio, recordTime } from './handler';
import { Readable } from 'stream';
import { UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const ddbMock = mockClient(DynamoDBDocumentClient);
const pollyMock = mockClient(PollyClient);

vi.spyOn(crypto, 'randomUUID').mockReturnValue('mock-uuid');
vi.spyOn(console, 'error').mockImplementation(() => {});


describe('getCategories', () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.TABLE_NAME = 'TestTable';
  });

  it('should return categories with their group', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { category: 'Category1', group: 'kids' },
        { category: 'Category2', group: 'engineer' },
        { category: 'Category1', group: 'kids' },
      ],
    });

    const response = await getCategories({});
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.categories).toEqual([
      { name: 'Category1', group: 'kids' },
      { name: 'Category2', group: 'engineer' },
    ]);
  });

  it('should default group to kids when missing or unrecognized', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { category: 'Category1' },
        { category: 'Category2', group: 'unknown' },
      ],
    });

    const response = await getCategories({});
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.categories).toEqual([
      { name: 'Category1', group: 'kids' },
      { name: 'Category2', group: 'kids' },
    ]);
  });

  it('should return default category if no items', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [],
    });

    const response = await getCategories({});
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.categories).toEqual([{ name: '大ピンチずかん', group: 'kids' }]);
  });

  it('should handle errors', async () => {
    ddbMock.on(ScanCommand).rejects(new Error('DynamoDB error'));
    const response = await getCategories({});
    expect(response.statusCode).toBe(500);
  });
});

describe('getPhrasesList', () => {
    beforeEach(() => {
      ddbMock.reset();
      process.env.TABLE_NAME = 'TestTable';
    });
  
    it('should return all phrases if no category is provided', async () => {
      ddbMock.on(ScanCommand).resolves({
        Items: [
          { id: '1', category: 'Category1' },
          { id: '2', category: 'Category2' },
        ],
      });
  
      const response = await getPhrasesList({});
      const body = JSON.parse(response.body);
  
      expect(response.statusCode).toBe(200);
      expect(body.phrases).toEqual([
        { id: '1', category: 'Category1' },
        { id: '2', category: 'Category2' },
      ]);
    });
  
    it('should return phrases for a specific category', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { id: '1', category: 'Category1' },
          { id: '3', category: 'Category1' },
        ],
      });

      const event = {
        queryStringParameters: {
          category: 'Category1',
        },
      };

      const response = await getPhrasesList(event);
      const body = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(body.phrases).toEqual([
        { id: '1', category: 'Category1' },
        { id: '3', category: 'Category1' },
      ]);
    });

    it('should request the answer field for the efuda print view (category query)', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await getPhrasesList({ queryStringParameters: { category: 'Category1' } });

      const call = ddbMock.commandCalls(QueryCommand)[0];
      expect(call.args[0].input.ProjectionExpression).toContain('answer');
    });

    it('should request the answer field for the efuda print view (scan all)', async () => {
      ddbMock.on(ScanCommand).resolves({ Items: [] });

      await getPhrasesList({});

      const call = ddbMock.commandCalls(ScanCommand)[0];
      expect(call.args[0].input.ProjectionExpression).toContain('answer');
    });

    it('should handle errors', async () => {
      ddbMock.on(ScanCommand).rejects(new Error('DynamoDB error'));
      const response = await getPhrasesList({});
      expect(response.statusCode).toBe(500);
    });
});

describe('getComments', () => {
    beforeEach(() => {
        ddbMock.reset();
        process.env.COMMENTS_TABLE_NAME = 'CommentsTestTable';
    });

    it('should return sorted comments', async () => {
        const comments = [
            { id: 1, comment: 'Comment 1', createdAt: new Date('2023-01-01').toISOString() },
            { id: 2, comment: 'Comment 2', createdAt: new Date('2023-01-02').toISOString() },
        ];
        ddbMock.on(ScanCommand).resolves({ Items: comments });
        const response = await getComments({});
        const body = JSON.parse(response.body);
        expect(response.statusCode).toBe(200);
        expect(body.comments[0].id).toBe(2);
    });

    it('should handle errors', async () => {
        ddbMock.on(ScanCommand).rejects(new Error('DynamoDB error'));
        const response = await getComments({});
        expect(response.statusCode).toBe(500);
    });
});

describe('postComment', () => {
    beforeEach(() => {
        ddbMock.reset();
        process.env.COMMENTS_TABLE_NAME = 'CommentsTestTable';
    });

    it('should post a comment', async () => {
        ddbMock.on(PutCommand).resolves({});
        const event = {
            body: JSON.stringify({
                phraseId: 'p1',
                category: 'c1',
                phrase: 'phrase 1',
                comment: 'This is a comment'
            })
        };
        const response = await postComment(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.message).toBe('Comment posted successfully');
    });

    it('should return 400 for invalid input', async () => {
        const event = { body: JSON.stringify({ phraseId: 'p1' }) }; // missing comment
        const response = await postComment(event);
        expect(response.statusCode).toBe(400);
    });

    it('should return 400 when comment exceeds the maximum length', async () => {
        const event = {
            body: JSON.stringify({
                phraseId: 'p1',
                category: 'c1',
                phrase: 'phrase 1',
                comment: 'a'.repeat(1001),
            }),
        };
        const response = await postComment(event);
        expect(response.statusCode).toBe(400);
        expect(ddbMock.commandCalls(PutCommand).length).toBe(0);
    });

    it('should accept a comment exactly at the maximum length', async () => {
        ddbMock.on(PutCommand).resolves({});
        const event = {
            body: JSON.stringify({
                phraseId: 'p1',
                category: 'c1',
                phrase: 'phrase 1',
                comment: 'a'.repeat(1000),
            }),
        };
        const response = await postComment(event);
        expect(response.statusCode).toBe(200);
    });

    it('should return 400 when comment is not a string', async () => {
        const event = {
            body: JSON.stringify({ phraseId: 'p1', category: 'c1', phrase: 'phrase 1', comment: 12345 }),
        };
        const response = await postComment(event);
        expect(response.statusCode).toBe(400);
    });

    it('should only allow the configured frontend origin in CORS headers', async () => {
        ddbMock.on(PutCommand).resolves({});
        const event = {
            body: JSON.stringify({
                phraseId: 'p1',
                category: 'c1',
                phrase: 'phrase 1',
                comment: 'This is a comment',
            }),
        };
        const response = await postComment(event);
        expect(response.headers['Access-Control-Allow-Origin']).toBe('https://bamiyanapp.github.io');
    });

    it('should reflect the local dev server origin so `npm run dev` against the deployed API keeps working', async () => {
        ddbMock.on(PutCommand).resolves({});
        const event = {
            headers: { origin: 'http://localhost:5173' },
            body: JSON.stringify({
                phraseId: 'p1',
                category: 'c1',
                phrase: 'phrase 1',
                comment: 'This is a comment',
            }),
        };
        const response = await postComment(event);
        expect(response.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });

    it('should not reflect an untrusted origin, falling back to the production origin', async () => {
        ddbMock.on(PutCommand).resolves({});
        const event = {
            headers: { origin: 'https://evil.example.com' },
            body: JSON.stringify({
                phraseId: 'p1',
                category: 'c1',
                phrase: 'phrase 1',
                comment: 'This is a comment',
            }),
        };
        const response = await postComment(event);
        expect(response.headers['Access-Control-Allow-Origin']).toBe('https://bamiyanapp.github.io');
    });

    it('should also read a capitalized Origin header (some proxy integrations do not lowercase it)', async () => {
        ddbMock.on(PutCommand).resolves({});
        const event = {
            headers: { Origin: 'http://localhost:5173' },
            body: JSON.stringify({
                phraseId: 'p1',
                category: 'c1',
                phrase: 'phrase 1',
                comment: 'This is a comment',
            }),
        };
        const response = await postComment(event);
        expect(response.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    });

    it('should handle errors', async () => {
        ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));
        const event = {
            body: JSON.stringify({
                phraseId: 'p1',
                category: 'c1',
                phrase: 'phrase 1',
                comment: 'This is a comment'
            })
        };
        const response = await postComment(event);
        expect(response.statusCode).toBe(500);
    });
});


describe('getCongratulationAudio', () => {
    beforeEach(() => {
        pollyMock.reset();
    });

    it('should return audio data', async () => {
        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { lang: 'ja' } };
        const response = await getCongratulationAudio(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.audioData).toBeDefined();
    });

    it('should return audio data for english', async () => {
        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { lang: 'en' } };
        const response = await getCongratulationAudio(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.audioData).toBeDefined();
    });

    it('should handle errors', async () => {
        pollyMock.on(SynthesizeSpeechCommand).rejects(new Error('Polly error'));
        const response = await getCongratulationAudio({});
        expect(response.statusCode).toBe(500);
    });

    it('should handle speechRate with %', async () => {
        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { lang: 'ja', speechRate: '120%' } };
        await getCongratulationAudio(event);
        
        const pollyCalls = pollyMock.calls();
        expect(pollyCalls.length).toBe(1);
        const pollyParams = pollyCalls[0].args[0].input;
        expect(pollyParams.Text).toContain('<prosody rate="120%">');
    });

    it('should fall back to the default speechRate when given a value not on the allowlist (SSML injection attempt)', async () => {
        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        // 数字始まりでない文字列を使い、キーワード許可リストのフォールバック分岐を確実に通す
        const event = {
            queryStringParameters: { lang: 'ja', speechRate: 'x-slow"/></prosody><speak>injected' },
        };
        await getCongratulationAudio(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toContain('<prosody rate="90%">');
        expect(pollyParams.Text).not.toContain('injected');
    });

    it('should allow a known SSML rate keyword through unchanged', async () => {
        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { lang: 'ja', speechRate: 'slow' } };
        await getCongratulationAudio(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toContain('<prosody rate="slow">');
    });
});

describe('getPhrase', () => {
    beforeEach(() => {
        ddbMock.reset();
        pollyMock.reset();
        process.env.TABLE_NAME = 'TestTable';
        process.env.POLLY_CACHE_TABLE_NAME = 'CacheTable';
    });

    it('should return a phrase with audio from Polly and cache it', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: 'phrase 1', level: '1' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({}); // Cache put

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1' } };
        const response = await getPhrase(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe('p1');
        expect(body.audioData).toBeDefined();
    });

    it('should return a phrase with audio from cache', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: 'phrase 1', level: '1' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: { id: 'cache-id', audioData: 'cached-audio-data' } }); // Cache hit

        const event = { queryStringParameters: { id: 'p1' } };
        const response = await getPhrase(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe('p1');
        expect(body.audioData).toBe('cached-audio-data');
    });

    it('should return 404 if phrase not found', async () => {
        ddbMock.on(ScanCommand).resolves({ Items: [] });
        const event = { queryStringParameters: { id: 'p1' } };
        const response = await getPhrase(event);
        expect(response.statusCode).toBe(404);
    });

    it('should handle errors', async () => {
        ddbMock.on(ScanCommand).rejects(new Error('DynamoDB error'));
        const response = await getPhrase({});
        expect(response.statusCode).toBe(500);
    });

    it('should select a random phrase when no id is provided', async () => {
        const items = [{ id: 'p1', category: 'c1', phrase: 'phrase 1', level: '1', readCount: 5, averageTime: 12.3 }];
        ddbMock.on(ScanCommand).resolves({
            Items: items,
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined });
        ddbMock.on(PutCommand).resolves({});

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { category: 'c1' } };
        const response = await getPhrase(event);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.id).toBe('p1');
        expect(body.readCount).toBe(5);
        expect(body.averageTime).toBe(12.3);
    });

    it('should include the answer field in the response when present', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: 'phrase 1', level: '1', answer: '回答A' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({}); // Cache put

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1' } };
        const response = await getPhrase(event);
        const body = JSON.parse(response.body);
        expect(body.answer).toBe('回答A');
    });

    it('should handle speechRate with %', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: 'phrase 1', level: '1' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({}); // Cache put

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1', speechRate: '110%' } };
        await getPhrase(event);

        const pollyCalls = pollyMock.calls();
        expect(pollyCalls.length).toBe(1);
        const pollyParams = pollyCalls[0].args[0].input;
        expect(pollyParams.Text).toContain('<prosody rate="110%">');
    });

    it('should escape SSML special characters in the phrase text', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: 'A & B <are> "friends"', level: '-' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined });
        ddbMock.on(PutCommand).resolves({});

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1', repeatCount: '1' } };
        await getPhrase(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toBe('<speak><prosody rate="90%">A &amp; B &lt;are&gt; "friends"</prosody></speak>');
    });

    it('should escape SSML special characters in the level text', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: 'phrase 1', level: '<injected>' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined });
        ddbMock.on(PutCommand).resolves({});

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1', repeatCount: '1' } };
        await getPhrase(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toContain('&lt;injected&gt;');
        expect(pollyParams.Text).not.toContain('<injected>');
    });

    it('should fall back to the default speechRate when given a value not on the allowlist (SSML injection attempt)', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: 'phrase 1', level: '-' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined });
        ddbMock.on(PutCommand).resolves({});

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        // 数字始まりでない文字列を使い、キーワード許可リストのフォールバック分岐を確実に通す
        const event = {
            queryStringParameters: { id: 'p1', speechRate: 'x-slow"/></prosody><speak>injected' },
        };
        await getPhrase(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toContain('<prosody rate="90%">');
        expect(pollyParams.Text).not.toContain('injected');
    });

    it('should allow a known SSML rate keyword through unchanged', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: 'phrase 1', level: '-' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined });
        ddbMock.on(PutCommand).resolves({});

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1', speechRate: 'slow' } };
        await getPhrase(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toContain('<prosody rate="slow">');
    });

    it('should append the category once at the end when announceCategory is true', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: '犬棒かるた', phrase: 'phrase 1', level: '-' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({}); // Cache put

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1', repeatCount: '1', announceCategory: 'true' } };
        await getPhrase(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toBe('<speak><prosody rate="90%">phrase 1<break time="800ms"/>犬棒かるた</prosody></speak>');
    });

    it('should append the category only once after both repeats when repeatCount is 2', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: '犬棒かるた', phrase: 'phrase 1', level: '-' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({}); // Cache put

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1', repeatCount: '2', announceCategory: 'true' } };
        await getPhrase(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toBe(
            '<speak><prosody rate="90%">phrase 1<break time="1500ms"/>phrase 1<break time="800ms"/>犬棒かるた</prosody></speak>'
        );
        // カテゴリの読み上げは1回のみ含まれる
        expect(pollyParams.Text.split('犬棒かるた').length - 1).toBe(1);
    });

    it('should not append the category when announceCategory is not set', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: '犬棒かるた', phrase: 'phrase 1', level: '-' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({}); // Cache put

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1', repeatCount: '1' } };
        await getPhrase(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).not.toContain('犬棒かるた');
    });

    it('should announce the category in Japanese even when lang is en', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: '犬棒かるた', phrase: 'phrase 1', phrase_en: 'Phrase 1', level: '-' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({}); // Cache put

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1', repeatCount: '1', announceCategory: 'true', lang: 'en' } };
        await getPhrase(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toContain('犬棒かるた');
        expect(pollyParams.Text).toContain('Phrase 1');
    });

    it('should escape SSML-significant characters in the category name', async () => {
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'A&B<C>', phrase: 'phrase 1', level: '-' }],
        });
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({}); // Cache put

        const audioStream = new Readable();
        audioStream.push('audio data');
        audioStream.push(null);
        pollyMock.on(SynthesizeSpeechCommand).resolves({ AudioStream: audioStream });

        const event = { queryStringParameters: { id: 'p1', repeatCount: '1', announceCategory: 'true' } };
        await getPhrase(event);

        const pollyParams = pollyMock.calls()[0].args[0].input;
        expect(pollyParams.Text).toContain('A&amp;B&lt;C&gt;');
        expect(pollyParams.Text).not.toContain('A&B<C>');
    });

    it('should use a different cache key when announceCategory changes', async () => {
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({});

        const audioStream = () => {
            const s = new Readable();
            s.push('audio data');
            s.push(null);
            return s;
        };
        pollyMock.on(SynthesizeSpeechCommand).callsFake(() => ({ AudioStream: audioStream() }));

        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: '犬棒かるた', phrase: 'phrase 1', level: '-' }],
        });
        const baseEvent = { queryStringParameters: { id: 'p1' } };
        await getPhrase(baseEvent);
        const firstCacheId = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item.id;

        const announceEvent = { queryStringParameters: { id: 'p1', announceCategory: 'true' } };
        await getPhrase(announceEvent);
        const secondCacheId = ddbMock.commandCalls(PutCommand)[1].args[0].input.Item.id;

        expect(secondCacheId).not.toBe(firstCacheId);
    });

    it('should use a different cache key when the phrase text changes for the same id', async () => {
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({});

        const audioStream = () => {
            const s = new Readable();
            s.push('audio data');
            s.push(null);
            return s;
        };
        pollyMock.on(SynthesizeSpeechCommand).callsFake(() => ({ AudioStream: audioStream() }));

        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: '元の読み札', level: '1' }],
        });
        const event = { queryStringParameters: { id: 'p1' } };
        await getPhrase(event);
        const firstCacheId = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item.id;

        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: '変更後の読み札', level: '1' }],
        });
        await getPhrase(event);
        const secondCacheId = ddbMock.commandCalls(PutCommand)[1].args[0].input.Item.id;

        expect(secondCacheId).not.toBe(firstCacheId);
    });

    it('should keep the same cache key for a language when only the other language text changes', async () => {
        ddbMock.on(GetCommand).resolves({ Item: undefined }); // Cache miss
        ddbMock.on(PutCommand).resolves({});

        const audioStream = () => {
            const s = new Readable();
            s.push('audio data');
            s.push(null);
            return s;
        };
        pollyMock.on(SynthesizeSpeechCommand).callsFake(() => ({ AudioStream: audioStream() }));

        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: '元の読み札', phrase_en: 'Original phrase', level: '1' }],
        });
        const jaEvent = { queryStringParameters: { id: 'p1', lang: 'ja' } };
        await getPhrase(jaEvent);
        const firstJaCacheId = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item.id;

        // phrase_en changes but the ja phrase stays the same; ja audio is unaffected.
        ddbMock.on(ScanCommand).resolves({
            Items: [{ id: 'p1', category: 'c1', phrase: '元の読み札', phrase_en: 'Changed phrase', level: '1' }],
        });
        await getPhrase(jaEvent);
        const secondJaCacheId = ddbMock.commandCalls(PutCommand)[1].args[0].input.Item.id;

        expect(secondJaCacheId).toBe(firstJaCacheId);
    });
});

describe('recordTime', () => {
    beforeEach(() => {
        ddbMock.reset();
        process.env.TABLE_NAME = 'TestTable';
    });

    it('should record time and update statistics', async () => {
        ddbMock.on(GetCommand).resolves({
            Item: { id: 'p1', category: 'c1', readCount: 1, averageTime: 10 }
        });
        ddbMock.on(UpdateCommand).resolves({});

        const event = {
            body: JSON.stringify({ id: 'p1', category: 'c1', time: 20 })
        };
        const response = await recordTime(event);
        expect(response.statusCode).toBe(200);

        const updateCalls = ddbMock.commandCalls(UpdateCommand);
        expect(updateCalls.length).toBe(1);
        const updateParams = updateCalls[0].args[0].input;
        expect(updateParams.ExpressionAttributeValues[':rc']).toBe(2);
        expect(updateParams.ExpressionAttributeValues[':at']).toBe(15);
    });

    it('should return 404 if phrase not found', async () => {
        ddbMock.on(GetCommand).resolves({ Item: undefined });
        const event = { body: JSON.stringify({ id: 'p1', category: 'c1', time: 10 }) };
        const response = await recordTime(event);
        expect(response.statusCode).toBe(404);
    });

    it('should return 400 for invalid input', async () => {
        const event = { body: JSON.stringify({ id: 'p1' }) }; // missing category and time
        const response = await recordTime(event);
        expect(response.statusCode).toBe(400);
    });

    it('should return 400 when time is zero', async () => {
        const event = { body: JSON.stringify({ id: 'p1', category: 'c1', time: 0 }) };
        const response = await recordTime(event);
        expect(response.statusCode).toBe(400);
    });

    it('should return 400 when time is negative', async () => {
        const event = { body: JSON.stringify({ id: 'p1', category: 'c1', time: -5 }) };
        const response = await recordTime(event);
        expect(response.statusCode).toBe(400);
    });

    it('should accept time exactly at the abnormal-value cap boundary and update the average', async () => {
        ddbMock.on(GetCommand).resolves({
            Item: { id: 'p1', category: 'c1', readCount: 0, averageTime: 0 }
        });
        ddbMock.on(UpdateCommand).resolves({});

        const event = { body: JSON.stringify({ id: 'p1', category: 'c1', time: 300 }) };
        const response = await recordTime(event);
        expect(response.statusCode).toBe(200);

        const updateParams = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
        expect(updateParams.ExpressionAttributeValues[':at']).toBe(300);
    });

    it('should reject (400) time above the abnormal-value cap without writing to DynamoDB, so readCount/averageTime stay consistent (e.g. left idle for hours)', async () => {
        const event = { body: JSON.stringify({ id: 'p1', category: 'c1', time: 21673.39 }) };
        const response = await recordTime(event);
        expect(response.statusCode).toBe(400);
        // readCountとaverageTimeが常に対応するサンプル数を保つよう、
        // 異常値のときはDB書き込み自体を行わない（部分更新はしない）
        expect(ddbMock.commandCalls(GetCommand).length).toBe(0);
        expect(ddbMock.commandCalls(UpdateCommand).length).toBe(0);
    });
});
