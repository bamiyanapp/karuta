import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// answerが読み札(phrase)内に登場すると、答えが読み札から自明になってしまい謎解きとして成立しない。
// おばけかるたは妖怪名を読み札内で名乗る伝統的な構造のため、この制約から除外する。
// 百人一首は読み札(phrase)が上の句+下の句の全句で、answer(下の句)がその一部として
// 必然的に含まれる構造のため、同様に除外する。
const CATEGORIES_ALLOWING_ANSWER_IN_PHRASE = new Set(['おばけかるた', '百人一首']);
// 整数levelの許容正規表現: 科学記数法・浮動小数・空白混入を弾く
const POSITIVE_INT_RE = /^\d+$/;

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

// ─────────────────────────────────────────────────────────────────
// データ整合性
// ─────────────────────────────────────────────────────────────────

describe('データ整合性', () => {
  it('IDが重複していないこと', () => {
    const ids = records.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('必須項目がすべて入力されていること（answerは未入力の場合は"-"とする）', () => {
    const REQUIRED = ['id', 'category', 'kana', 'phrase', 'phrase_en', 'group'];
    for (const r of records) {
      for (const field of REQUIRED) {
        expect(r[field].trim(), `id=${r.id}: フィールド "${field}" が空`).not.toBe('');
      }
      expect(r.answer.trim(), `id=${r.id}: answer フィールドが空（未入力の場合は "-" を使用）`).not.toBe('');
    }
  });

  it('不正な改行・制御文字が含まれていないこと', () => {
    // eslint-disable-next-line no-control-regex -- 制御文字混入の検出が本テストの目的そのもの
    const controlRe = /[\x00-\x1F\x7F]/;
    for (const r of records) {
      for (const [field, value] of Object.entries(r)) {
        expect(
          controlRe.test(value),
          `id=${r.id}: フィールド "${field}" に制御文字または改行が含まれている`
        ).toBe(false);
      }
    }
  });

  it('idが正の整数であること', () => {
    for (const r of records) {
      const n = Number(r.id);
      expect(Number.isInteger(n) && n > 0, `id="${r.id}" が正の整数でない`).toBe(true);
    }
  });

  // level の許容形式: "-" / 正の整数 / "初級" or "上級"（国旗王）
  const ALLOWED_LEVEL_STRINGS = new Set(['-', '初級', '上級']);
  it('levelが整数・"-"・"初級"・"上級" のいずれかであること', () => {
    for (const r of records) {
      if (ALLOWED_LEVEL_STRINGS.has(r.level)) continue;
      const valid = POSITIVE_INT_RE.test(r.level) && parseInt(r.level, 10) > 0;
      expect(valid, `id=${r.id}: level="${r.level}" は許容形式でない`).toBe(true);
    }
  });

  it('読み札（phrase）が重複していないこと', () => {
    const seen = new Set();
    const duplicates = [];
    for (const r of records) {
      if (seen.has(r.phrase)) duplicates.push(`id=${r.id}: "${r.phrase}"`);
      seen.add(r.phrase);
    }
    expect(duplicates, '重複している読み札').toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// かな整合確認
// ─────────────────────────────────────────────────────────────────

/**
 * 全角カタカナを対応するひらがなに変換する（1文字単位）。
 * 合拗音（シャ→しゃ など）は合わせず先頭1文字のみを変換する。
 * これはテストデータが複合音節の先頭文字をそのままkanaとして登録している慣習に合わせるため。
 */
function katakanaToHiragana(ch) {
  const code = ch.charCodeAt(0);
  if (code >= 0x30a1 && code <= 0x30f6) return String.fromCharCode(code - 0x60);
  return ch;
}

/**
 * 対象文字列の先頭文字から期待されるkana値を返す。
 * 漢字・記号などテスト対象外の場合は null を返す。
 */
function expectedKana(target) {
  if (!target) return null;
  const first = target[0];
  if (/^[A-Za-z]$/.test(first)) return first.toUpperCase(); // 英字 → 大文字
  if (/^[0-9]$/.test(first)) return first;                  // 数字 → 完全一致
  if (/^[ぁ-ゖ]$/.test(first)) return first;        // ひらがな → 完全一致
  if (/^[ァ-ヶ]$/.test(first)) return katakanaToHiragana(first); // カタカナ → ひらがな
  return null; // 漢字・その他 → テスト省略
}

// かなが読み札先頭文字由来のカテゴリ（answerがあっても読み札を参照する）
// 百人一首はkanaが上の句（読み札=phrase）の決まり字先頭文字であり、
// answer（下の句）の先頭文字ではないため、読み札を参照するカテゴリに含める。
const CATEGORIES_KANA_FROM_PHRASE = new Set(['おばけかるた', '百人一首']);

// かなの導出規則がテキスト先頭文字では検証できないカテゴリ
// （概念ベース・日本語読み・ショートカットキー等）
const CATEGORIES_SKIP_KANA_MATCH = new Set([
  'Git大ピンチ',       // サブコマンドの概念文字（git switch -c → B など）
  'Windows大ピンチ',   // Ctrl+X の X 部分をkanaとするため先頭文字と不一致
  'Webアプリ大ピンチ', // 英単語の日本語カタカナ読み（Cookie → く など）
  'セキュリティ大ピンチ', // 略語の日本語読み（SQL → え など）
  'いろはかるた',      // 読み札内のキー音節がkana（先頭文字ではない）
  'いろはかるた（意味）', // 同上
  '国旗王',            // 漢字句のかな読みが由来
]);

// 大ピンチずかんで主概念文字をkanaとする意図的な例外行
const ROWS_SKIP_KANA_MATCH = new Set([
  '17',  // おちたけしゴムがみつからない → kana "け"（主概念: けしゴム）
  '66',  // かばしらに じてんしゃで つっこんだ → kana "で"
  '69',  // プレゼントをわすれた → kana "お"（おくりものの読み由来）
  '78',  // パンがくろこげ → kana "け"（こげの濁点なし）
  '83',  // ビニールぶくろがめくれない → kana "や"
]);

const kanaMatchCases = records
  .filter((r) => !CATEGORIES_SKIP_KANA_MATCH.has(r.category))
  .filter((r) => !ROWS_SKIP_KANA_MATCH.has(r.id))
  .flatMap((r) => {
    const hasAnswer = r.answer && r.answer.trim() !== '' && r.answer.trim() !== '-';
    const usePhrase = !hasAnswer || CATEGORIES_KANA_FROM_PHRASE.has(r.category);
    const target = usePhrase ? r.phrase : r.answer;
    const expected = expectedKana(target);
    if (expected === null) return [];
    return [[r.id, r.category, r.kana, target, expected]];
  });

const latinKanaCases = records
  .filter((r) => /^[A-Za-z]$/.test(r.kana))
  .map((r) => [r.id, r.category, r.kana]);

describe('かな整合確認', () => {
  it('かな整合チェック対象が1件以上存在すること', () => {
    expect(kanaMatchCases.length).toBeGreaterThan(0);
  });

  it.each(kanaMatchCases)(
    'id=%s (%s): kana="%s" が対象先頭文字から導出される期待値と一致すること（対象="%s"）',
    (id, _category, kana, _target, expected) => {
      expect(kana).toBe(expected);
    }
  );

  it('ラテン文字kanaチェック対象が1件以上存在すること', () => {
    expect(latinKanaCases.length).toBeGreaterThan(0);
  });

  it.each(latinKanaCases)(
    'id=%s (%s): ラテン文字のkana="%s" は大文字でなければならない',
    (id, _category, kana) => {
      expect(kana).toBe(kana.toUpperCase());
    }
  );
});

// ─────────────────────────────────────────────────────────────────
// 大ピンチレベルの整合性
// ─────────────────────────────────────────────────────────────────

describe('大ピンチレベルの整合性', () => {
  // 整数levelを持つカテゴリ内でユニークであることを検証する
  // 国旗王は"初級"/"上級"（非整数）のため除外
  it('整数levelを持つカテゴリで種別内にユニークであること', () => {
    const byCategory = {};
    for (const r of records) {
      if (r.level === '-') continue;
      if (!POSITIVE_INT_RE.test(r.level) || parseInt(r.level, 10) <= 0) continue; // 初級・上級など非整数はスキップ
      (byCategory[r.category] ??= []).push(r.level);
    }
    expect(
      Object.keys(byCategory).length,
      '整数levelを持つカテゴリが0件 — レベル付きカテゴリが存在しない'
    ).toBeGreaterThan(0);
    for (const [category, levels] of Object.entries(byCategory)) {
      expect(
        new Set(levels).size,
        `${category} でlevelが重複している`
      ).toBe(levels.length);
    }
  });
});
