import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/endpoints', () => ({ getPhrasesList: vi.fn() }));

import { getPhrasesList } from '../api/endpoints';
import { useAllPhrasesList } from './useAllPhrasesList';

const PHRASES = [
  { id: 'a1', category: 'あ', phrase: 'いぬ', kana: 'いぬ', answer: '犬' },
  { id: 'b1', category: 'い', phrase: 'ねこ', kana: 'ねこ', answer: '猫' },
  { id: 'a2', category: 'あ', phrase: 'とり', kana: 'とり', answer: '鳥' },
];
// 依存配列に使うため、描画のたびに新しい配列を渡さない
const CATEGORIES = [
  { name: 'あ', group: 'kids' },
  { name: 'い', group: 'engineer' },
];

describe('useAllPhrasesList', () => {
  beforeEach(() => {
    getPhrasesList.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('does not fetch until the view is all-phrases', () => {
    renderHook(() => useAllPhrasesList('game', CATEGORIES));
    expect(getPhrasesList).not.toHaveBeenCalled();
  });

  it('fetches every phrase when the view is all-phrases and derives the counts and categories', async () => {
    getPhrasesList.mockResolvedValue({ phrases: PHRASES });
    const { result } = renderHook(() => useAllPhrasesList('all-phrases', CATEGORIES));
    await waitFor(() => expect(result.current.allPhrases).toHaveLength(3));
    expect(result.current.fetchError).toBe(false);
    expect(result.current.categoryCount).toEqual({ あ: 2, い: 1 });
    expect(result.current.visibleCategories).toEqual(['あ', 'い']);
  });

  it('narrows the categories by division, treating an unknown group as kids', async () => {
    getPhrasesList.mockResolvedValue({ phrases: [...PHRASES, { id: 'c1', category: 'う', phrase: 'x' }] });
    const { result } = renderHook(() => useAllPhrasesList('all-phrases', CATEGORIES));
    await waitFor(() => expect(result.current.allPhrases).toHaveLength(4));
    act(() => result.current.setFilterDivision('kids'));
    expect(result.current.visibleCategories).toEqual(['あ', 'う']);
    act(() => result.current.setFilterDivision('engineer'));
    expect(result.current.visibleCategories).toEqual(['い']);
  });

  it('filters by category and by search text (phrase, kana and answer, case-insensitive)', async () => {
    getPhrasesList.mockResolvedValue({ phrases: PHRASES });
    const { result } = renderHook(() => useAllPhrasesList('all-phrases', CATEGORIES));
    await waitFor(() => expect(result.current.allPhrases).toHaveLength(3));
    act(() => result.current.setFilterCategory('あ'));
    expect(result.current.filteredPhrases.map((p) => p.id)).toEqual(['a1', 'a2']);
    act(() => result.current.setSearchQuery(' 鳥 '));
    expect(result.current.filteredPhrases.map((p) => p.id)).toEqual(['a2']);
  });

  it('toggles the sort direction when the same key is sorted twice', async () => {
    getPhrasesList.mockResolvedValue({ phrases: PHRASES });
    const { result } = renderHook(() => useAllPhrasesList('all-phrases', CATEGORIES));
    await waitFor(() => expect(result.current.allPhrases).toHaveLength(3));
    act(() => result.current.handleSort('category'));
    expect(result.current.sortConfig).toEqual({ key: 'category', direction: 'asc' });
    act(() => result.current.handleSort('category'));
    expect(result.current.sortConfig).toEqual({ key: 'category', direction: 'desc' });
    act(() => result.current.handleSort('phrase'));
    expect(result.current.sortConfig).toEqual({ key: 'phrase', direction: 'asc' });
  });

  it('flags the error without clearing the list on failure, and recovers on retry (issue #2190)', async () => {
    getPhrasesList.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useAllPhrasesList('all-phrases', CATEGORIES));
    await waitFor(() => expect(result.current.fetchError).toBe(true));
    expect(result.current.allPhrases).toEqual([]);
    getPhrasesList.mockResolvedValue({ phrases: PHRASES });
    act(() => result.current.retryFetch());
    await waitFor(() => expect(result.current.allPhrases).toHaveLength(3));
    expect(result.current.fetchError).toBe(false);
  });
});
