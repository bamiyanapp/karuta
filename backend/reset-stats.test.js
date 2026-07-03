import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { resetStats } from './reset-stats';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('resetStats', () => {
  beforeEach(() => {
    ddbMock.reset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = 0;
  });

  it('resets readCount/averageTime/averageDifficulty to 0 for the given category and id', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await resetStats('c1', 'p1');

    const calls = ddbMock.commandCalls(UpdateCommand);
    expect(calls.length).toBe(1);
    const input = calls[0].args[0].input;
    expect(input.Key).toEqual({ category: 'c1', id: 'p1' });
    expect(input.ExpressionAttributeValues[':zero']).toBe(0);
    expect(input.UpdateExpression).toContain('readCount = :zero');
    expect(input.UpdateExpression).toContain('averageTime = :zero');
    expect(input.UpdateExpression).toContain('averageDifficulty = :zero');
    expect(process.exitCode).toBe(0);
  });

  it('does not call DynamoDB and sets a non-zero exit code when category or id is missing', async () => {
    await resetStats(undefined, 'p1');

    expect(ddbMock.commandCalls(UpdateCommand).length).toBe(0);
    expect(process.exitCode).toBe(1);
  });

  it('reports a clear error instead of creating a stray item when category/id do not match an existing phrase', async () => {
    const error = new Error('The conditional request failed');
    error.name = 'ConditionalCheckFailedException';
    ddbMock.on(UpdateCommand).rejects(error);

    await resetStats('typo-category', 'p1');

    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('typo-category'));
  });

  it('rethrows unexpected errors', async () => {
    ddbMock.on(UpdateCommand).rejects(new Error('network error'));

    await expect(resetStats('c1', 'p1')).rejects.toThrow('network error');
  });
});
