import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { setupAppTest } from './testing/appTestHarness';

// 画面をまたぐ遷移（division選択→カテゴリ選択→読み上げ画面など）。共通のモックとbeforeEachは、testing/appTestHarness.jsにある（issue #2192）。
setupAppTest();

describe('App', () => {
  it('renders division selection screen initially', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('かるた読み上げ')).toBeInTheDocument();
    expect(screen.getByText('こども向け')).toBeInTheDocument();
    expect(screen.getByText('エンジニア向け')).toBeInTheDocument();
  });

  it('retries up to 4 times with exponential backoff before showing a get-categories-specific error message when fetching categories keeps failing (issue #758, #1798, #1933)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) throw new Error('network error');
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    // 1回目の失敗直後はまだアラートを出さず、自動リトライを待つ
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // 指数バックオフ（1秒・2秒・4秒・8秒、最大8秒）で合計約15秒かかるため、
    // デフォルトタイムアウトを延長する
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('カテゴリの取得に失敗しました。');
    }, { timeout: 20000 });

    // 初回 + リトライ4回 = 合計5回
    const categoriesCalls = fetch.mock.calls.filter(([url]) => url.includes('get-categories'));
    expect(categoriesCalls).toHaveLength(5);

    consoleErrorSpy.mockRestore();
  }, 25000);

  it('recovers from a longer chain of consecutive failures than the previous fixed-interval retry budget allowed, as seen on the low-traffic canary stage (issue #1933)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let categoriesCallCount = 0;
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        categoriesCallCount += 1;
        // canaryはcanary_weight分のトラフィックしか受けずLambdaが頻繁にコールドスタート
        // するため、旧実装（固定1秒間隔・最大3回）の予算を超える3回連続の失敗を想定する
        if (categoriesCallCount <= 3) throw new Error('network error');
        return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    await screen.findByRole('button', { name: /Cat1/ }, { timeout: 20000 });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(categoriesCallCount).toBe(4);

    consoleErrorSpy.mockRestore();
  }, 25000);

  it('does not show an error when the automatic get-categories retry succeeds (issue #758)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let categoriesCallCount = 0;
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        categoriesCallCount += 1;
        if (categoriesCallCount === 1) throw new Error('network error');
        return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    await screen.findByRole('button', { name: /Cat1/ });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(categoriesCallCount).toBe(2);

    consoleErrorSpy.mockRestore();
  });

  it('retries a non-ok (e.g. transient 5xx with non-JSON body) get-categories response instead of treating it as a one-shot silent failure (issue #1798)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let categoriesCallCount = 0;
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        categoriesCallCount += 1;
        if (categoriesCallCount <= 2) {
          // コールドスタート等での一過性の5xx（JSON以外のエラーボディ）を想定
          return { ok: false, status: 502, json: async () => { throw new SyntaxError('invalid json'); } };
        }
        return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    await screen.findByRole('button', { name: /Cat1/ });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(categoriesCallCount).toBe(3);

    consoleErrorSpy.mockRestore();
  });

  it('shows the matching category list after choosing a division', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return {
          ok: true,
          json: async () => ({
            categories: [
              { name: 'いろはかるた', group: 'kids' },
              { name: 'テスト用', group: 'kids' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText('こども向け'));

    await waitFor(() => {
      expect(screen.getByText('いろはかるた')).toBeInTheDocument();
      expect(screen.getByText('テスト用')).toBeInTheDocument();
    });
  });

  it('only shows categories belonging to the selected division', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return {
          ok: true,
          json: async () => ({
            categories: [
              { name: 'KidsCat', group: 'kids' },
              { name: 'EngCat', group: 'engineer' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText('こども向け'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /KidsCat/ })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /EngCat/ })).not.toBeInTheDocument();
  });

  it('shows an empty-state message instead of a dead decide button when a division has no categories', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [{ name: 'EngCat', group: 'engineer' }] }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText('こども向け'));

    await waitFor(() => {
      expect(screen.getByText('このかるたはまだありません。')).toBeInTheDocument();
    });
    expect(screen.queryByText(/かるたを始める/)).not.toBeInTheDocument();
  });

  it('keeps the secondary navigation links reachable from the category selection screen', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText('こども向け'));
    await screen.findByRole('button', { name: /Cat1/ });

    expect(screen.getByText(/全札一覧を見る/)).toBeInTheDocument();
    expect(screen.getByText(/このアプリを共有する/)).toBeInTheDocument();
    expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });

  it('navigates straight to the game screen on a single tap for the kids division, skipping the decide button and confirmation modal', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return {
          ok: true,
          json: async () => ({
            categories: [
              { name: 'Cat1', group: 'kids' },
              { name: 'Cat2', group: 'kids' },
            ],
          }),
        };
      }
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText('こども向け'));

    const cat1Button = await screen.findByRole('button', { name: /Cat1/ });
    expect(screen.queryByText(/かるたを始める/)).not.toBeInTheDocument();

    fireEvent.click(cat1Button);

    await waitFor(() => {
      expect(screen.queryByText(/お手元に持っていますか/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '次の札' })).toBeInTheDocument();
    });
  });

  it('returns to the division selection screen via the back button', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }),
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText('こども向け'));
    await screen.findByRole('button', { name: /Cat1/ });

    fireEvent.click(screen.getByText('← 戻る'));

    await waitFor(() => {
      expect(screen.getByText('じぶんではじめる')).toBeInTheDocument();
    });
  });
});
