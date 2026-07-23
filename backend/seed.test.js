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

  it('carries over stats from the old category name via CATEGORY_RENAMES instead of resetting them, and deletes the old record (モダン開発大ピンチへのリネーム)', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `${CSV_HEADER}\n2001,モダン開発大ピンチ,93,し,リリース直前に重大バグ発覚,A critical bug is discovered right before release.,シフトレフト,engineer`
    );
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { id: '2001', category: 'モダン開発かるた', readCount: 42, averageTime: 8, averageDifficulty: 2, totalTime: 336, totalDifficulty: 84 },
      ],
    });
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(DeleteCommand).resolves({});

    await seed();

    const putItem = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(putItem.category).toBe('モダン開発大ピンチ');
    // リネーム前の統計が引き継がれ、0にリセットされていないこと
    expect(putItem.readCount).toBe(42);
    expect(putItem.averageTime).toBe(8);
    expect(putItem.averageDifficulty).toBe(2);

    // リネーム前の（旧カテゴリ名の）レコードは不要データとして削除される
    const deleteParams = ddbMock.commandCalls(DeleteCommand)[0].args[0].input;
    expect(deleteParams.Key).toEqual({ category: 'モダン開発かるた', id: '2001' });
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

  it('treats a Scan response with no Items field, and blank CSV fields, as defaults instead of throwing', async () => {
    // categoryが空欄の行は「大ピンチずかん」、level/kana/answer/explanationは「-」、
    // phrase/phrase_en/groupは空文字にフォールバックすることを確認する
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      'id,category,level,kana,phrase,phrase_en,answer,group,explanation\n9998,,,,,,,,'
    );
    ddbMock.on(ScanCommand).resolves({}); // Itemsフィールド自体が無いレスポンス
    ddbMock.on(PutCommand).resolves({});

    await seed();

    const putItem = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(putItem.category).toBe('大ピンチずかん');
    expect(putItem.level).toBe('-');
    expect(putItem.kana).toBe('-');
    expect(putItem.phrase).toBe('');
    expect(putItem.phrase_en).toBe('');
    expect(putItem.answer).toBe('-');
    expect(putItem.explanation).toBe('-');
    expect(putItem.group).toBe('kids');
  });

  it('keeps a real explanation value from the CSV instead of falling back to "-"', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      'id,category,level,kana,phrase,phrase_en,answer,group,explanation\n9997,新カテゴリ,-,し,新しい札,new phrase,-,kids,補足説明です'
    );
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});

    await seed();

    const putItem = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(putItem.explanation).toBe('補足説明です');
  });

  it('treats missing averageDifficulty/totalTime/totalDifficulty on an existing item as 0, while still carrying over readCount/averageTime', async () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      `${CSV_HEADER}\n2002,大ピンチずかん,-,あ,テスト,test,-,kids`
    );
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { id: '2002', category: '大ピンチずかん', readCount: 5, averageTime: 3.5 },
      ],
    });
    ddbMock.on(PutCommand).resolves({});

    await seed();

    const putItem = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(putItem.readCount).toBe(5);
    expect(putItem.averageTime).toBe(3.5);
    expect(putItem.averageDifficulty).toBe(0);
    expect(putItem.totalTime).toBe(0);
    expect(putItem.totalDifficulty).toBe(0);
  });
});
