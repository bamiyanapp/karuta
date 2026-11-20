import { describe, it, expect } from 'vitest';
import { toLevelNum, comparePhraseValues } from './phraseSort';

const asc = (key) => ({ key, direction: 'asc' });
const desc = (key) => ({ key, direction: 'desc' });
const sortBy = (items, config) => [...items].sort((a, b) => comparePhraseValues(a, b, config));

describe('toLevelNum', () => {
  it('maps 初級・上級 to fixed large numbers, numeric strings to numbers, and others to the largest', () => {
    expect(toLevelNum('初級')).toBe(1_000_000);
    expect(toLevelNum('上級')).toBe(1_000_001);
    expect(toLevelNum('12')).toBe(12);
    expect(toLevelNum('-')).toBe(1_000_002);
    expect(toLevelNum(undefined)).toBe(1_000_002);
  });
});

describe('comparePhraseValues', () => {
  it('sorts the level column numerically, with 初級 < 上級 after numbers', () => {
    const items = [{ level: '上級' }, { level: '10' }, { level: '2' }, { level: '初級' }];
    expect(sortBy(items, asc('level')).map((i) => i.level)).toEqual(['2', '10', '初級', '上級']);
    expect(sortBy(items, desc('level')).map((i) => i.level)).toEqual(['上級', '初級', '10', '2']);
  });

  it('keeps an unset level ("-") last regardless of direction', () => {
    const items = [{ level: '-' }, { level: '3' }, { level: '1' }];
    expect(sortBy(items, asc('level')).map((i) => i.level)).toEqual(['1', '3', '-']);
    expect(sortBy(items, desc('level')).map((i) => i.level)).toEqual(['3', '1', '-']);
  });

  it('keeps a missing answer ("-" or empty) last regardless of direction', () => {
    const items = [{ answer: '-' }, { answer: 'b' }, { answer: '' }, { answer: 'A' }];
    expect(sortBy(items, asc('answer')).map((i) => i.answer).slice(0, 2)).toEqual(['A', 'b']);
    expect(sortBy(items, desc('answer')).map((i) => i.answer).slice(0, 2)).toEqual(['b', 'A']);
  });

  it('treats missing numeric stats as 0', () => {
    const items = [{ readCount: 5 }, {}, { readCount: 2 }];
    expect(sortBy(items, asc('readCount')).map((i) => i.readCount ?? 0)).toEqual([0, 2, 5]);
  });

  it('compares strings case-insensitively', () => {
    const items = [{ phrase: 'b' }, { phrase: 'A' }, { phrase: 'c' }];
    expect(sortBy(items, asc('phrase')).map((i) => i.phrase)).toEqual(['A', 'b', 'c']);
  });
});
