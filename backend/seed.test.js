import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import fs from 'fs';
import { seed } from './seed';

const ddbMock = mockClient(DynamoDBDocumentClient);

const CSV_HEADER = 'id,category,level,kana,phrase,phrase_en,answer,group';

describe('seed', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('carries over readCount/averageTime from the existing item when category and id are unchanged', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `${CSV_HEADER}\n2001,大ピンチずかん,-,あ,テスト,test,-,kids`
    );
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { id: '2001', category: '大ピンチずかん', readCount: 7, averageTime: 12.5, averageDifficulty: 3, totalTime: 87.5, totalDifficulty: 21 },
      ],
    });
    ddbMock.on(PutCommand).resolves({});

    await seed();

    const putItem = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(putItem.readCount).toBe(7);
    expect(putItem.averageTime).toBe(12.5);
    expect(putItem.averageDifficulty).toBe(3);
    expect(putItem.totalTime).toBe(87.5);
    expect(putItem.totalDifficulty).toBe(21);
  });

  it('carries over stats from the old category name via CATEGORY_RENAMES instead of resetting them, and deletes the old record (モダン開発かるたへのリネーム)', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `${CSV_HEADER}\n2001,モダン開発かるた,-,し,シフトレフト,shift left,-,engineer`
    );
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { id: '2001', category: 'モダンソフトウェア開発かるた', readCount: 42, averageTime: 8, averageDifficulty: 2, totalTime: 336, totalDifficulty: 84 },
      ],
    });
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(DeleteCommand).resolves({});

    await seed();

    const putItem = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(putItem.category).toBe('モダン開発かるた');
    // リネーム前の統計が引き継がれ、0にリセットされていないこと
    expect(putItem.readCount).toBe(42);
    expect(putItem.averageTime).toBe(8);
    expect(putItem.averageDifficulty).toBe(2);

    // リネーム前の（旧カテゴリ名の）レコードは不要データとして削除される
    const deleteParams = ddbMock.commandCalls(DeleteCommand)[0].args[0].input;
    expect(deleteParams.Key).toEqual({ category: 'モダンソフトウェア開発かるた', id: '2001' });
  });

  it('defaults stats to 0 for a brand-new item with no existing or renamed match', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `${CSV_HEADER}\n9999,新カテゴリ,-,し,新しい札,new phrase,-,kids`
    );
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    await seed();

    const putItem = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(putItem.readCount).toBe(0);
    expect(putItem.averageTime).toBe(0);
    expect(putItem.averageDifficulty).toBe(0);
  });
});
