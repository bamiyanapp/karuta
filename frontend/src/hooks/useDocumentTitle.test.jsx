import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { resolveDocumentTitle, useDocumentTitle } from './useDocumentTitle';

const base = { view: 'game', categoryLabel: '', detailPhraseId: null, detailPhrase: null };

describe('resolveDocumentTitle', () => {
  it('uses the app name when nothing else applies', () => {
    expect(resolveDocumentTitle(base)).toBe('かるた読み上げ');
  });

  it('uses the category label when a category is selected', () => {
    expect(resolveDocumentTitle({ ...base, categoryLabel: '動物' })).toBe('動物');
  });

  it.each([
    ['comments', '指摘一覧 | かるた読み上げ'],
    ['changelog', '更新履歴 | かるた読み上げ'],
    ['all-phrases', '全札一覧 | かるた読み上げ'],
    ['share', 'アプリを共有 | かるた読み上げ'],
  ])('shows a fixed title for the %s view', (view, expected) => {
    expect(resolveDocumentTitle({ ...base, view, categoryLabel: '動物' })).toBe(expected);
  });

  it('includes the category in the print-efuda title', () => {
    expect(resolveDocumentTitle({ ...base, view: 'print-efuda', categoryLabel: '動物' })).toBe('動物の絵札印刷 | かるた読み上げ');
  });

  it('shows the phrase and its category in the detail view once the phrase is loaded', () => {
    const detailPhrase = { phrase: 'いぬも歩けば', category: 'いろは' };
    expect(resolveDocumentTitle({ ...base, detailPhraseId: 'p1', detailPhrase })).toBe('いぬも歩けば | いろは');
    // 読み込み前は、カテゴリ名（またはアプリ名）のまま
    expect(resolveDocumentTitle({ ...base, detailPhraseId: 'p1', categoryLabel: 'いろは' })).toBe('いろは');
  });
});

describe('useDocumentTitle', () => {
  it('updates document.title and follows view changes', () => {
    const { rerender } = renderHook((props) => useDocumentTitle(props), { initialProps: base });
    expect(document.title).toBe('かるた読み上げ');
    rerender({ ...base, view: 'changelog' });
    expect(document.title).toBe('更新履歴 | かるた読み上げ');
  });
});
