import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { getCategories, getPhrasesList, getComments, postComment, getPhrase, getCongratulationAudio, recordTime } from './handler';
import { Readable } from 'stream';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
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

  it('should return categories', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { category: 'Category1' },
        { category: 'Category2' },
        { category: 'Category1' },
      ],
    });

    const response = await getCategories({});
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.categories).toEqual(['Category1', 'Category2']);
  });

  it('should return default category if no items', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [],
    });

    const response = await getCategories({});
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.categories).toEqual(['大ピンチずかん']);
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
      ddbMock.on(ScanCommand).resolves({
        Items: [
          { id: '1', category: 'Category1' },
          { id: '2', category: 'Category2' },
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
});

describe('recordTime', () => {
    beforeEach(() => {
        ddbMock.reset();
        process.env.TABLE_NAME = 'TestTable';
    });

    it('should record time and update statistics', async () => {
        ddbMock.on(GetCommand).resolves({
            Item: { id: 'p1', readCount: 1, averageTime: 10 }
        });
        ddbMock.on(UpdateCommand).resolves({});

        const event = {
            body: JSON.stringify({ id: 'p1', time: 20 })
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
        const event = { body: JSON.stringify({ id: 'p1', time: 10 }) };
        const response = await recordTime(event);
        expect(response.statusCode).toBe(404);
    });

    it('should return 400 for invalid input', async () => {
        const event = { body: JSON.stringify({ id: 'p1' }) }; // missing time
        const response = await recordTime(event);
        expect(response.statusCode).toBe(400);
    });
});
