import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { setupAppTest } from './testing/appTestHarness';

// 読み上げ画面の開始・複数カテゴリ・先読み・進捗。共通のモックとbeforeEachは、testing/appTestHarness.jsにある（issue #2192）。
setupAppTest();

describe('App', () => {
  it('fetches get-categories only once, even after selecting a category (issue #193)', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));

    await waitFor(() => {
      const elements = screen.queryAllByText('Cat1');
      expect(elements.length).toBeGreaterThan(0);
    });

    const categoryButton = screen.getByRole('button', { name: /Cat1/ });
    fireEvent.click(categoryButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cat1' })).toBeInTheDocument();
    });

    const categoriesCalls = fetch.mock.calls.filter(([url]) => url.includes('get-categories'));
    expect(categoriesCalls).toHaveLength(1);
  });

  it('starts game when category is selected', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));

    await waitFor(() => {
      const elements = screen.queryAllByText('Cat1');
      expect(elements.length).toBeGreaterThan(0);
    });

    const categoryButton = screen.getByRole('button', { name: /Cat1/ });
    fireEvent.click(categoryButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cat1' })).toBeInTheDocument();
      expect(screen.getByText('次の札')).toBeInTheDocument();
    });
  });

  it('merges phrases from multiple categories when several are selected', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }, { name: 'Cat2', group: 'engineer' }] }) };
      if (url.includes('category=Cat1')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('category=Cat2')) return { ok: true, json: async () => ({ phrases: [{ id: 'p2', category: 'Cat2' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cat1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cat2/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cat2/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cat1・Cat2' })).toBeInTheDocument();
    });
  });

  it('shows no possession-check notice when all selected categories have requiresPossessionCheck: false', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer', requiresPossessionCheck: false }, { name: 'Cat2', group: 'engineer', requiresPossessionCheck: false }] }) };
      if (url.includes('category=Cat1')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('category=Cat2')) return { ok: true, json: async () => ({ phrases: [{ id: 'p2', category: 'Cat2' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cat1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cat2/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cat2/ }));
    expect(screen.queryByText(/をお手元にご用意ください/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/かるたを始める/));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cat1・Cat2' })).toBeInTheDocument();
    });
  });

  it('only shows the possession-check notice for categories with requiresPossessionCheck: true when a mix is selected', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer', requiresPossessionCheck: true }, { name: 'Cat2', group: 'engineer', requiresPossessionCheck: false }] }) };
      if (url.includes('category=Cat1')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('category=Cat2')) return { ok: true, json: async () => ({ phrases: [{ id: 'p2', category: 'Cat2' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cat1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cat2/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cat2/ }));

    await waitFor(() => screen.getByText('「Cat1」をお手元にご用意ください'));
  });

  it('requests announceCategory=true when reading with multiple categories selected', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }, { name: 'Cat2', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list') && url.includes('category=Cat1')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('get-phrases-list') && url.includes('category=Cat2')) return { ok: true, json: async () => ({ phrases: [{ id: 'p2', category: 'Cat2' }] }) };
      if (url.includes('/get-phrase?')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', phrase: '読み札1', audioData: 'dummy' }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cat1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cat2/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cat2/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      const getPhraseCall = fetch.mock.calls.find(([url]) => url.includes('/get-phrase?'));
      expect(getPhraseCall).toBeDefined();
      expect(getPhraseCall[0]).toContain('announceCategory=true');
    }, { timeout: 20000 });

    randomSpy.mockRestore();
  }, 65000);

  it('requests announceCategory=false when reading with a single category selected', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', phrase: '読み札1', audioData: 'dummy' }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));

    const categoryButton = await screen.findByRole('button', { name: /Cat1/ });
    fireEvent.click(categoryButton);

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      const getPhraseCall = fetch.mock.calls.find(([url]) => url.includes('/get-phrase?'));
      expect(getPhraseCall).toBeDefined();
      expect(getPhraseCall[0]).toContain('announceCategory=false');
    }, { timeout: 20000 });

    randomSpy.mockRestore();
  }, 65000);

  it('shows a read/total progress counter that updates as phrases are read', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }, { id: 'p2', category: 'Cat1' }] }),
        };
      }
      if (url.includes('/get-phrase?')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', phrase: '読み札1', audioData: 'dummy' }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    const categoryButton = await screen.findByRole('button', { name: /Cat1/ });
    fireEvent.click(categoryButton);

    await waitFor(() => {
      expect(screen.getByText('読み上げ済み 0 / 全2枚')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み上げ済み 1 / 全2枚')).toBeInTheDocument();
    });

    randomSpy.mockRestore();
  });

  it('prefetches the next phrase while the current one is being read, and reuses it without an extra fetch', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const getPhraseCallIds = [];
    const phraseById = {
      p1: { id: 'p1', category: 'Cat1', phrase: '読み札1' },
      p2: { id: 'p2', category: 'Cat1', phrase: '読み札2' },
    };
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }, { id: 'p2', category: 'Cat1' }] }),
        };
      }
      if (url.includes('/get-phrase?')) {
        const id = new URL(url).searchParams.get('id');
        getPhraseCallIds.push(id);
        return { ok: true, json: async () => ({ ...phraseById[id], audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    // p1読み上げ中（isReading）にp2が先読みされるのを待つ
    await waitFor(() => {
      expect(getPhraseCallIds).toContain('p2');
    }, { timeout: 10000 });

    // p1の読み上げが完了する（次の札を再度押せる状態に戻る）のを待つ
    await waitFor(() => expect(screen.getByText('次の札')).not.toBeDisabled(), { timeout: 20000 });

    const callCountBeforeSecondClick = getPhraseCallIds.length;
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札2', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    // プリフェッチ済みのp2をそのまま使うため、/get-phraseの追加呼び出しは発生しない
    expect(getPhraseCallIds).toHaveLength(callCountBeforeSecondClick);
    expect(getPhraseCallIds).toEqual(['p1', 'p2']);

    randomSpy.mockRestore();
  }, 40000);

  it('ignores a second "次の札" click while the first is still advancing (e.g. during the fade-out animation), instead of flipping multiple cards at once (issue #590)', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const phraseById = {
      p1: { id: 'p1', category: 'Cat1', phrase: '読み札1' },
      p2: { id: 'p2', category: 'Cat1', phrase: '読み札2' },
      p3: { id: 'p3', category: 'Cat1', phrase: '読み札3' },
    };
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }, { id: 'p2', category: 'Cat1' }, { id: 'p3', category: 'Cat1' }] }),
        };
      }
      if (url.includes('/get-phrase?')) {
        const id = new URL(url).searchParams.get('id');
        return { ok: true, json: async () => ({ ...phraseById[id], audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    // p1の読み上げが完了し、次の札へ進める状態に戻るのを待つ
    await waitFor(() => expect(screen.getByText('次の札')).not.toBeDisabled(), { timeout: 20000 });
    await waitFor(() => expect(screen.getByText('読み上げ済み 1 / 全3枚')).toBeInTheDocument());

    // ここで連打する。同じボタン要素を捕まえてから2回続けてクリックすることで、
    // 1回目のクリックで非活性化される前に2回目が送られる状況を再現する
    // （修正前はこの間ボタンが非活性化されておらず、2回目のクリックも処理されて
    // しまい、p2だけでなくp3までまとめてめくれてしまっていた）
    const nextButton = screen.getByText('次の札');
    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('読み上げ済み 2 / 全3枚')).toBeInTheDocument();
    }, { timeout: 20000 });

    // p2を読み上げている間にp3が裏でプリフェッチされること自体は既存の正常な挙動
    // （'prefetches the next phrase...'テスト参照）なので、/get-phraseの呼び出し数
    // ではなく「実際にキューへ積まれ読み上げ済みとしてカウントされた枚数」で判定する。
    // 修正前は2回目のクリックも処理されてしまい、ここで3枚目まで自動的に
    // 読み上げ済みになってしまっていた（もう一度「次の札」を押していないのに進む）
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(screen.getByText('読み上げ済み 2 / 全3枚')).toBeInTheDocument();

    randomSpy.mockRestore();
  }, 40000);

  it('requests announceCategory=true for the detail-view replay when multiple categories are selected', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }, { name: 'Cat2', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list') && url.includes('category=Cat1')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-' }] }) };
      if (url.includes('get-phrases-list') && url.includes('category=Cat2')) return { ok: true, json: async () => ({ phrases: [{ id: 'p2', category: 'Cat2', kana: 'い', phrase: '読み札2', level: '-' }] }) };
      if (url.includes('/get-phrase?')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      if (url.includes('get-comments')) return { ok: true, json: async () => ({ comments: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cat1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cat2/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cat2/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    fetch.mockClear();
    // 「これまでに読み上げた札」一覧はデフォルト非表示のため、まずトグルボタンで開く（issue #548）
    fireEvent.click(await screen.findByText(/これまでに読み上げた札を表示する/));
    fireEvent.click(await screen.findByText('詳細・報告 →'));

    await waitFor(() => {
      const getPhraseCall = fetch.mock.calls.find(([url]) => url.includes('/get-phrase?'));
      expect(getPhraseCall).toBeDefined();
      expect(getPhraseCall[0]).toContain('announceCategory=true');
    });

    randomSpy.mockRestore();
  }, 40000);

  it('shows the phrases from categories that succeeded, plus a retry banner, when only some selected categories fail to fetch (issue #474)', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }, { name: 'Cat2', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list') && url.includes('category=Cat1')) {
        return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', answer: '回答1' }] }) };
      }
      if (url.includes('get-phrases-list') && url.includes('category=Cat2')) {
        return { ok: false };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cat1/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cat2/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cat2/ }));

    await waitFor(() => screen.getByText('絵札を印刷する'));
    fireEvent.click(screen.getByText('絵札を印刷する'));

    await waitFor(() => {
      // Cat1（成功分）は表示され、「読み込み中...」で止まったままにはならない
      expect(screen.getByText('回答1')).toBeInTheDocument();
    });

    // 一部失敗のみでは、完全失敗時の通知は出さない
    expect(screen.queryByText('かるたデータの取得に失敗しました。もう一度お試しください。')).not.toBeInTheDocument();
    // 一部失敗を知らせる警告と再試行導線が表示される
    expect(screen.getByText(/一部のかるたデータの取得に失敗した/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再試行する' })).toBeInTheDocument();
  });

  it('shows a retry option instead of getting stuck on "読み込み中..." when all selected categories fail to fetch, and recovers after retrying (issue #474)', async () => {
    let cat1ShouldFail = true;
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) {
        if (cat1ShouldFail) return { ok: false };
        return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', answer: '回答1' }] }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    await waitFor(() => screen.getByText('絵札を印刷する'));
    fireEvent.click(screen.getByText('絵札を印刷する'));

    await waitFor(() => {
      expect(screen.getByText('かるたデータの取得に失敗しました。')).toBeInTheDocument();
    });
    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('かるたデータの取得に失敗しました。もう一度お試しください。');

    cat1ShouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: '再試行する' }));

    await waitFor(() => {
      expect(screen.getByText('回答1')).toBeInTheDocument();
    });
  });
});
