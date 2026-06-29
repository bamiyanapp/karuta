import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// answerが読み札(phrase)内に登場すると、答えが読み札から自明になってしまい謎解きとして成立しない。
// おばけかるたは妖怪名を読み札内で名乗る伝統的な構造のため、この制約から除外する。
const CATEGORIES_ALLOWING_ANSWER_IN_PHRASE = new Set(['おばけかるた']);

const csvPath = path.join(__dirname, 'phrases.csv');
const records = parse(fs.readFileSync(csvPath, 'utf-8'), {
  columns: true,
  skip_empty_lines: true,
});

describe('phrases.csv data integrity', () => {
  it('contains at least one record', () => {
    expect(records.length).toBeGreaterThan(0);
  });

  it.each(
    records
      .filter((r) => r.answer && r.answer.trim() !== '' && r.answer.trim() !== '-')
      .filter((r) => !CATEGORIES_ALLOWING_ANSWER_IN_PHRASE.has(r.category))
      .map((r) => [r.id, r.category, r.answer, r.phrase])
  )('id=%s (%s): answer "%s" must not appear in phrase "%s"', (id, category, answer, phrase) => {
    expect(phrase).not.toContain(answer);
  });
});
