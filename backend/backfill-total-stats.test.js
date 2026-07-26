import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { backfillTotalStats } from './backfill-total-stats';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('backfillTotalStats', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('derives totalTime/totalDifficulty from averageTime/averageDifficulty * readCount for items missing the totals', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [
        { id: 'p1', category: 'c1', readCount: 5, averageTime: 10, averageDifficulty: 2 },
      ],
    });
    ddbMock.on(UpdateCommand).resolves({});

    const updatedCount = await backfillTotalStats();

    expect(updatedCount).toBe(1);
    const updateParams = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateParams.Key).toEqual({ category: 'c1', id: 'p1' });
    expect(updateParams.ConditionExpression).toBe('attribute_not_exists(totalTime)');
    expect(updateParams.ExpressionAttributeValues[':tt']).toBe(50);
    expect(updateParams.ExpressionAttributeValues[':td']).toBe(10);
  });

  it('follows LastEvaluatedKey to migrate every page of a multi-page Scan', async () => {
    ddbMock.on(ScanCommand)
      .resolvesOnce({
        Items: [{ id: 'p1', category: 'c1', readCount: 5, averageTime: 10, averageDifficulty: 2 }],
        LastEvaluatedKey: { category: 'c1', id: 'p1' },
      })
      .resolvesOnce({
        Items: [{ id: 'p2', category: 'c1', readCount: 3, averageTime: 4, averageDifficulty: 1 }],
      });
    ddbMock.on(UpdateCommand).resolves({});

    const updatedCount = await backfillTotalStats();

    expect(updatedCount).toBe(2);
    const scanCalls = ddbMock.commandCalls(ScanCommand);
    expect(scanCalls).toHaveLength(2);
    expect(scanCalls[1].args[0].input.ExclusiveStartKey).toEqual({ category: 'c1', id: 'p1' });
    const updatedIds = ddbMock.commandCalls(UpdateCommand).map(call => call.args[0].input.Key.id);
    expect(updatedIds).toEqual(['p1', 'p2']);
  });

  it('skips (without throwing) an item that live traffic already wrote totalTime for between the Scan and the Update', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [{ id: 'p1', category: 'c1', readCount: 5, averageTime: 10, averageDifficulty: 2 }],
    });
    const conditionalError = new Error('The conditional request failed');
    conditionalError.name = 'ConditionalCheckFailedException';
    ddbMock.on(UpdateCommand).rejects(conditionalError);

    const updatedCount = await backfillTotalStats();

    expect(updatedCount).toBe(0);
  });

  it('treats an unread item (readCount 0) as having zero totals', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [{ id: 'p1', category: 'c1', readCount: 0 }],
    });
    ddbMock.on(UpdateCommand).resolves({});

    await backfillTotalStats();

    const updateParams = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateParams.ExpressionAttributeValues[':tt']).toBe(0);
    expect(updateParams.ExpressionAttributeValues[':td']).toBe(0);
  });

  it('skips items that already have totalTime/totalDifficulty (idempotent re-run)', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [{ id: 'p1', category: 'c1', readCount: 5, totalTime: 50, totalDifficulty: 10 }],
    });

    const updatedCount = await backfillTotalStats();

    expect(updatedCount).toBe(0);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });
});
