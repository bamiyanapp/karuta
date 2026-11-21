import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const notify = vi.fn();
vi.mock('../components/NotificationProvider', () => ({ useNotify: () => notify }));
vi.mock('../api/endpoints', () => ({ getPhrasesList: vi.fn() }));

import { getPhrasesList } from '../api/endpoints';
import { useCategoryPhrases } from './useCategoryPhrases';

describe('useCategoryPhrases', () => {
  beforeEach(() => {
    notify.mockClear();
    getPhrasesList.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns an empty list and no error when no category is selected, without fetching', async () => {
    // 依存配列に使うため、描画のたびに新しい配列を渡すと、再取得を繰り返す。App.jsxのselectedCategoriesはstateで安定している
    const categories = [];
    const { result } = renderHook(() => useCategoryPhrases(categories));
    await waitFor(() => expect(result.current.allPhrasesForCategory).toEqual([]));
    expect(result.current.phrasesFetchError).toBe(false);
    expect(getPhrasesList).not.toHaveBeenCalled();
  });

  it('merges the phrases of every selected category, in selection order', async () => {
    getPhrasesList.mockImplementation(async (cat) => ({ phrases: [{ id: `${cat}-1` }, { id: `${cat}-2` }] }));
    const categories = ['A', 'B'];
    const { result } = renderHook(() => useCategoryPhrases(categories));
    await waitFor(() => expect(result.current.allPhrasesForCategory).toHaveLength(4));
    expect(result.current.allPhrasesForCategory.map((p) => p.id)).toEqual(['A-1', 'A-2', 'B-1', 'B-2']);
    expect(result.current.phrasesFetchError).toBe(false);
  });

  it('keeps the phrases that succeeded and flags the error when only some categories fail (issue #474), without notifying', async () => {
    getPhrasesList.mockImplementation(async (cat) => {
      if (cat === 'B') throw new Error('boom');
      return { phrases: [{ id: `${cat}-1` }] };
    });
    const categories = ['A', 'B'];
    const { result } = renderHook(() => useCategoryPhrases(categories));
    await waitFor(() => expect(result.current.phrasesFetchError).toBe(true));
    expect(result.current.allPhrasesForCategory).toEqual([{ id: 'A-1' }]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('notifies an error when every selected category fails', async () => {
    getPhrasesList.mockRejectedValue(new Error('boom'));
    const categories = ['A', 'B'];
    const { result } = renderHook(() => useCategoryPhrases(categories));
    await waitFor(() => expect(notify).toHaveBeenCalledWith({ type: 'error', message: 'かるたデータの取得に失敗しました。もう一度お試しください。' }));
    expect(result.current.allPhrasesForCategory).toEqual([]);
    expect(result.current.phrasesFetchError).toBe(true);
  });

  it('refetches the same categories when retryFetchPhrasesList is called, and recovers', async () => {
    let shouldFail = true;
    getPhrasesList.mockImplementation(async () => {
      if (shouldFail) throw new Error('boom');
      return { phrases: [{ id: 'A-1' }] };
    });
    const categories = ['A'];
    const { result } = renderHook(() => useCategoryPhrases(categories));
    await waitFor(() => expect(result.current.phrasesFetchError).toBe(true));

    shouldFail = false;
    act(() => result.current.retryFetchPhrasesList());

    await waitFor(() => expect(result.current.allPhrasesForCategory).toEqual([{ id: 'A-1' }]));
    expect(result.current.phrasesFetchError).toBe(false);
    expect(getPhrasesList).toHaveBeenCalledTimes(2);
  });
});
