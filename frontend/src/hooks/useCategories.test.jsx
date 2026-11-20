import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const notify = vi.fn();
vi.mock('../components/NotificationProvider', () => ({ useNotify: () => notify }));
vi.mock('../api/endpoints', () => ({ getCategories: vi.fn() }));

import { getCategories } from '../api/endpoints';
import { useCategories } from './useCategories';

describe('useCategories', () => {
  beforeEach(() => {
    notify.mockClear();
    getCategories.mockReset();
  });

  it('returns the fetched categories and calls onLoaded once with them', async () => {
    const categories = [{ name: 'A', group: 'kids' }, { name: 'B', group: 'engineer' }];
    getCategories.mockResolvedValue({ categories });
    const onLoaded = vi.fn();

    const { result } = renderHook(() => useCategories({ onLoaded }));

    await waitFor(() => expect(result.current).toEqual(categories));
    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onLoaded).toHaveBeenCalledWith(categories);
  });

  it('returns an empty list when the response has no categories', async () => {
    getCategories.mockResolvedValue({});
    const onLoaded = vi.fn();
    const { result } = renderHook(() => useCategories({ onLoaded }));
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith([]));
    expect(result.current).toEqual([]);
  });

  it('uses the latest onLoaded without refetching when the caller passes a new function each render', async () => {
    getCategories.mockResolvedValue({ categories: [{ name: 'A', group: 'kids' }] });
    const { rerender } = renderHook(({ cb }) => useCategories({ onLoaded: cb }), { initialProps: { cb: vi.fn() } });
    rerender({ cb: vi.fn() });
    rerender({ cb: vi.fn() });
    await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(1));
  });

  it('notifies an error (and does not call onLoaded) when the fetch fails after retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getCategories.mockRejectedValue(new Error('network'));
    const onLoaded = vi.fn();

    const { result } = renderHook(() => useCategories({ onLoaded }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith({ type: 'error', message: 'カテゴリの取得に失敗しました。' }));
    expect(onLoaded).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('aborts the request on unmount and stays silent about the abort', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let signal;
    getCategories.mockImplementation((options) => {
      signal = options.signal;
      return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
    });

    const { unmount } = renderHook(() => useCategories());
    unmount();

    await waitFor(() => expect(signal.aborted).toBe(true));
    expect(notify).not.toHaveBeenCalled();
  });
});
