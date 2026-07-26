import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { backfillPollyCacheTtl } from './backfill-polly-cache-ttl';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('backfillPollyCacheTtl', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('sets ttl (~30 days out) on items missing it', async () => {
    ddbMock.on(ScanCommand).resolves({
      Items: [{ id: 'cache1', audioData: 'data:audio/mp3;base64,xxx' }],
    });
    ddbMock.on(UpdateCommand).resolves({});

    const updatedCount = await backfillPollyCacheTtl();

    expect(updatedCount).toBe(1);
    const updateParams = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(updateParams.Key).toEqual({ id: 'cache1' });
    expect(updateParams.ConditionExpression).toBe('attribute_not_exists(#ttl)');
    const expectedTtl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    expect(updateParams.ExpressionAttributeValues[':ttl']).toBeCloseTo(expectedTtl, -1);
  });

  it('follows LastEvaluatedKey to migrate every page of a multi-page Scan', async () => {
    ddbMock.on(ScanCommand)
      .resolvesOnce({
        Items: [{ id: 'cache1' }],
        LastEvaluatedKey: { id: 'cache1' },
      })
      .resolvesOnce({
        Items: [{ id: 'cache2' }],
      });
    ddbMock.on(UpdateCommand).resolves({});

    const updatedCount = await backfillPollyCacheTtl();

    expect(updatedCount).toBe(2);
    const scanCalls = ddbMock.commandCalls(ScanCommand);
    expect(scanCalls).toHaveLength(2);
    expect(scanCalls[1].args[0].input.ExclusiveStartKey).toEqual({ id: 'cache1' });
  });

  it('skips (without throwing) an item that live traffic already wrote ttl for between the Scan and the Update', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ id: 'cache1' }] });
    const conditionalError = new Error('The conditional request failed');
    conditionalError.name = 'ConditionalCheckFailedException';
    ddbMock.on(UpdateCommand).rejects(conditionalError);

    const updatedCount = await backfillPollyCacheTtl();

    expect(updatedCount).toBe(0);
  });

  it('skips items that already have ttl (idempotent re-run)', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ id: 'cache1', ttl: 1234567890 }] });

    const updatedCount = await backfillPollyCacheTtl();

    expect(updatedCount).toBe(0);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('treats a Scan response with no Items field as an empty page instead of throwing', async () => {
    ddbMock.on(ScanCommand).resolves({});

    const updatedCount = await backfillPollyCacheTtl();

    expect(updatedCount).toBe(0);
  });

  it('rethrows an Update failure that is not a ConditionalCheckFailedException', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ id: 'cache1' }] });
    ddbMock.on(UpdateCommand).rejects(new Error('ProvisionedThroughputExceededException'));

    await expect(backfillPollyCacheTtl()).rejects.toThrow('ProvisionedThroughputExceededException');
  });
});
