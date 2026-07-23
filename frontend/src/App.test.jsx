import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import { resetSharedAudioForTests } from './utils/audioUnlock';

window.alert = vi.fn();

// Mock fetch
window.fetch = vi.fn();

// Mock Audio
// アプリ側は `new Audio(url)` のコンストラクタ引数でsrcを渡すため(後からの代入はしない)、
// コンストラクタ引数を受け取ったらsrcセッターと同じ処理を実行する。
// vitest v4はvi.fn()のモック実装をnewで呼び出す場合、アロー関数を許容しない
// （アロー関数は元々コンストラクタ不可というJS仕様どおりの挙動）ため、通常の関数式を使う
window.Audio = vi.fn().mockImplementation(function (url) {
  const audio = {
    play: vi.fn().mockResolvedValue(),
    pause: vi.fn(),
    load: vi.fn(),
    _src: undefined,
    get src() {
      return this._src;
    },
    // Simulate successful loading
    set src(url) {
      this._src = url;
      setTimeout(() => {
        if (this.oncanplaythrough) this.oncanplaythrough();
        // Simulate audio ending immediately for tests
        if (this.onended) setTimeout(this.onended, 0);
      }, 0);
    },
  };
  if (url) audio.src = url;
  return audio;
});

// Mock window.scrollTo
window.scrollTo = vi.fn();

describe('App', () => {
  beforeEach(() => {
    fetch.mockClear();
    vi.clearAllMocks();
    // Reset URL
    window.history.pushState({}, '', '/');
    // 読み上げ履歴の永続化先（sessionStorage）をテスト間で引き継がないようにする
    sessionStorage.clear();
    // 共有<audio>要素（issue #514）はモジュールスコープのシングルトンなので、
    // テスト間で使い回されないようリセットする
    resetSharedAudioForTests();
  });

  it('renders division selection screen initially', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('かるた読み上げアプリ')).toBeInTheDocument();
    expect(screen.getByText('こども向け')).toBeInTheDocument();
    expect(screen.getByText('エンジニア向け')).toBeInTheDocument();
  });

  it('shows a get-categories-specific error message when fetching categories fails, instead of the generic submit-failure message', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) throw new Error('network error');
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    expect(window.alert).toHaveBeenCalledWith('カテゴリの取得に失敗しました。');
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
    expect(screen.getByText(/指摘された内容を確認する/)).toBeInTheDocument();
    expect(screen.getByText(/更新履歴を見る/)).toBeInTheDocument();
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
      expect(screen.getByText('どなた向けに遊びますか？')).toBeInTheDocument();
    });
  });

  it('navigates to comments view', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });
    
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return {
          ok: true,
          json: async () => ({ categories: [] }),
        };
      }
      if (url.includes('get-comments')) {
        return {
          ok: true,
          json: async () => ({ comments: [{ id: 1, phrase: 'TestPhrase', comment: 'Fix this', category: 'TestCat', createdAt: new Date().toISOString() }] }),
        };
      }
      return { ok: false };
    });

    const commentsLink = screen.getByText(/指摘された内容を確認する/i);
    fireEvent.click(commentsLink);

    await waitFor(() => {
      expect(screen.getByText('指摘された内容一覧')).toBeInTheDocument();
      expect(screen.getByText(/TestPhrase/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

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
    expect(categoriesCalls.length).toBe(1);
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
    expect(getPhraseCallIds.length).toBe(callCountBeforeSecondClick);
    expect(getPhraseCallIds).toEqual(['p1', 'p2']);

    randomSpy.mockRestore();
  }, 40000);

  it('ignores a second "次の札" click while the first is still advancing (e.g. during the fade-out animation), instead of flipping multiple cards at once (issue #590)', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const getPhraseCallIds = [];
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

  it('shows efuda print view with answer fallback to phrase and paginates by 10', async () => {
    const phrases = Array.from({ length: 11 }, (_, i) => ({
      id: `p${i}`,
      category: 'Cat1',
      kana: 'あ',
      phrase: `読み札テキスト${i}`,
      answer: i === 0 ? '-' : `回答${i}`,
    }));

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      return { ok: false };
    });

    window.print = vi.fn();

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));

    const categoryButton = await screen.findByRole('button', { name: /Cat1/ });
    fireEvent.click(categoryButton);

    await waitFor(() => screen.getByText('絵札を印刷する'));
    fireEvent.click(screen.getByText('絵札を印刷する'));

    await waitFor(() => {
      expect(screen.getByText('Cat1の絵札印刷')).toBeInTheDocument();
      // answerが"-"のカードは読み札(phrase)をそのまま使う
      expect(screen.getByText('読み札テキスト0')).toBeInTheDocument();
      // answerがあるカードはanswerを使う
      expect(screen.getByText('回答1')).toBeInTheDocument();
    });

    // 用紙情報に顔料インク用・インクジェット用それぞれの商品ページへのリンクが設定されている
    const paperLinks = screen.getAllByRole('link', { name: /エーワン マルチカード/ });
    expect(paperLinks).toHaveLength(2);
    expect(paperLinks[0]).toHaveAttribute('href', 'https://www.a-one.co.jp/product/search/detail.php?id=51677');
    expect(paperLinks[0]).toHaveAttribute('target', '_blank');
    expect(paperLinks[1]).toHaveAttribute('href', 'https://www.a-one.co.jp/product/search/detail.php?id=51604');
    expect(paperLinks[1]).toHaveAttribute('target', '_blank');

    // 11枚 → 10面/ページなので2ページ生成される
    expect(document.querySelectorAll('.efuda-page').length).toBe(2);

    fireEvent.click(screen.getByText('印刷する'));
    expect(window.print).toHaveBeenCalled();

    // 選択カテゴリが1つの場合でも、絵札にかるた種別が表示される
    expect(document.querySelector('.efuda-card-category')).toHaveTextContent('Cat1');
  });

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

    // 一部失敗のみでは、完全失敗時のアラートは出さない
    expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining('かるたデータの取得'));
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
    expect(window.alert).toHaveBeenCalledWith('かるたデータの取得に失敗しました。もう一度お試しください。');

    cat1ShouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: '再試行する' }));

    await waitFor(() => {
      expect(screen.getByText('回答1')).toBeInTheDocument();
    });
  });

  it('switches the efuda print view to show the back side (category and level) (issue #363)', async () => {
    const phrases = [
      { id: 'p0', category: 'Cat1', kana: 'あ', phrase: '読み札テキスト0', answer: '-', level: '3' },
      { id: 'p1', category: 'Cat1', kana: 'い', phrase: '読み札テキスト1', answer: '回答1', level: '-' },
    ];

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
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
      expect(screen.getByText('読み札テキスト0')).toBeInTheDocument();
    });

    // 表面ではレベルの数字は表示されない
    expect(document.querySelector('.efuda-card-back')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '裏面' }));

    // 裏面では表面の内容（読み札・回答）が消え、種別とレベルが中央に表示される
    expect(screen.queryByText('読み札テキスト0')).not.toBeInTheDocument();
    expect(screen.queryByText('回答1')).not.toBeInTheDocument();
    // 両面印刷（用紙を裏返してセットする運用）に合わせ、裏面は行内で左右が入れ替わって
    // 描画される（表面で1枚目=左, 2枚目=右 だったものが、裏面では1枚目=右, 2枚目=左になる）
    const backCards = document.querySelectorAll('.efuda-card-back');
    expect(backCards).toHaveLength(2);
    expect(backCards[0].querySelector('.efuda-card-back-category')).toHaveTextContent('Cat1');
    // レベル未設定（"-"）のカードには数字を表示しない（左右入れ替わり、1枚目の位置に2枚目のデータが来る）
    expect(backCards[0].querySelector('.efuda-card-back-level')).not.toBeInTheDocument();
    expect(backCards[1].querySelector('.efuda-card-back-level')).toHaveTextContent('3');

    fireEvent.click(screen.getByRole('button', { name: '表面' }));
    expect(screen.getByText('読み札テキスト0')).toBeInTheDocument();
    expect(document.querySelector('.efuda-card-back')).not.toBeInTheDocument();
  });

  it('mirrors each row left-right on the back side so it lines up after flipping the sheet for double-sided printing (両面印刷時の裏面位置ずれ)', async () => {
    const phrases = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`, category: 'Cat1', kana: 'あ', phrase: `読み札${i}`, answer: '-', level: String(i),
    }));

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    await waitFor(() => screen.getByText('絵札を印刷する'));
    fireEvent.click(screen.getByText('絵札を印刷する'));

    // 表面はグリッドの並び順どおり（2列×5行）: 読み札0, 読み札1, 読み札2, ...
    await waitFor(() => screen.getByText('読み札0'));
    const frontTexts = [...document.querySelectorAll('.efuda-card-text')].map((el) => el.textContent);
    expect(frontTexts).toEqual(['読み札0', '読み札1', '読み札2', '読み札3', '読み札4', '読み札5', '読み札6', '読み札7', '読み札8', '読み札9']);

    fireEvent.click(screen.getByRole('button', { name: '裏面' }));

    // 用紙を裏返してセットする運用に合わせ、裏面は行ごとに左右が入れ替わって描画される。
    // 表面で1枚目(左)・2枚目(右)だった行は、裏面では2枚目(左)・1枚目(右)になる
    const backLevels = [...document.querySelectorAll('.efuda-card-back-level-number')].map((el) => el.textContent);
    expect(backLevels).toEqual(['1', '0', '3', '2', '5', '4', '7', '6', '9', '8']);
  });

  it('assigns one of the 5 back-side decorative patterns per category, consistently across cards of the same category and re-renders (裏面の和柄装飾)', async () => {
    const phrases = [
      { id: 'p0', category: 'Cat1', kana: 'あ', phrase: '読み札テキスト0', answer: '-', level: '3' },
      { id: 'p1', category: 'Cat1', kana: 'い', phrase: '読み札テキスト1', answer: '回答1', level: '-' },
    ];

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    await waitFor(() => screen.getByText('絵札を印刷する'));
    fireEvent.click(screen.getByText('絵札を印刷する'));

    await waitFor(() => screen.getByText('読み札テキスト0'));
    fireEvent.click(screen.getByRole('button', { name: '裏面' }));

    const patternClassOf = (el) => [...el.classList].find((c) => c.startsWith('efuda-pattern-'));
    const backCards = document.querySelectorAll('.efuda-card-back');
    const firstCardPattern = patternClassOf(backCards[0]);
    const secondCardPattern = patternClassOf(backCards[1]);

    // 同じ種別（Cat1）のカード同士は同じ柄になる
    const validPatterns = ['efuda-pattern-fundou', 'efuda-pattern-shippo', 'efuda-pattern-kikkou', 'efuda-pattern-seigaiha', 'efuda-pattern-tatewaku'];
    expect(validPatterns).toContain(firstCardPattern);
    expect(secondCardPattern).toBe(firstCardPattern);

    // 表面⇔裏面の切り替え（再描画）を挟んでも、柄は変わらない
    fireEvent.click(screen.getByRole('button', { name: '表面' }));
    fireEvent.click(screen.getByRole('button', { name: '裏面' }));
    const backCardsAfterToggle = document.querySelectorAll('.efuda-card-back');
    expect(patternClassOf(backCardsAfterToggle[0])).toBe(firstCardPattern);
    expect(patternClassOf(backCardsAfterToggle[1])).toBe(firstCardPattern);
  });

  it('uses the same color (including the border) for a category on both the front and back sides (表裏の色統一)', async () => {
    const phrases = [
      { id: 'p0', category: 'Cat1', kana: 'あ', phrase: '読み札テキスト0', answer: '-', level: '3' },
    ];

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    await waitFor(() => screen.getByText('絵札を印刷する'));
    fireEvent.click(screen.getByText('絵札を印刷する'));

    // 表面：外枠(.efuda-card)にefuda-color-*が付き、裏面の柄名と対応した色クラスになっている
    await waitFor(() => screen.getByText('読み札テキスト0'));
    const colorClassOf = (el) => [...el.classList].find((c) => c.startsWith('efuda-color-'));
    const frontCard = document.querySelector('.efuda-card');
    const frontColorClass = colorClassOf(frontCard);
    expect(frontColorClass).toMatch(/^efuda-color-(fundou|shippo|kikkou|seigaiha|tatewaku)$/);

    // 裏面：同じ.efuda-card要素の柄名（efuda-pattern-*）が、表面のefuda-color-*と同じ名前を指す。
    // 裏面は両面印刷の運用（用紙を裏返してセット）に合わせて行内で左右が入れ替わって描画される
    // ため、1枚しかない場合は表面で1枚目（左）だった内容が裏面では2枚目（右）の位置に来る。
    // そのため.efuda-card-back（実際に内容が入っている方）から辿って対応する外枠要素を取得する
    fireEvent.click(screen.getByRole('button', { name: '裏面' }));
    const backCardBack = document.querySelector('.efuda-card-back');
    const backCard = backCardBack.parentElement;
    const patternName = [...backCardBack.classList]
      .find((c) => c.startsWith('efuda-pattern-'))
      .replace('efuda-pattern-', '');
    expect(colorClassOf(backCard)).toBe(`efuda-color-${patternName}`);
    expect(frontColorClass).toBe(`efuda-color-${patternName}`);
  });

  it('assigns a different back-side pattern to each selected category when multiple categories are printed together (issue #柄の重複)', async () => {
    const categoryNames = ['Cat1', 'Cat2', 'Cat3', 'Cat4', 'Cat5'];

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: categoryNames.map((name) => ({ name, group: 'engineer' })) }) };
      }
      for (const name of categoryNames) {
        if (url.includes(`category=${name}`)) {
          return { ok: true, json: async () => ({ phrases: [{ id: `${name}-p0`, category: name, kana: 'あ', phrase: `${name}テキスト`, answer: '-' }] }) };
        }
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));

    await waitFor(() => {
      categoryNames.forEach((name) => {
        expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
      });
    });

    categoryNames.forEach((name) => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
    });

    await waitFor(() => screen.getByText('絵札を印刷する'));
    fireEvent.click(screen.getByText('絵札を印刷する'));

    await waitFor(() => screen.getByText('Cat5テキスト'));
    fireEvent.click(screen.getByRole('button', { name: '裏面' }));

    const patternClassOf = (el) => [...el.classList].find((c) => c.startsWith('efuda-pattern-'));
    const backCards = document.querySelectorAll('.efuda-card-back');
    expect(backCards).toHaveLength(5);
    const patterns = [...backCards].map(patternClassOf);

    // 5種別以下なら柄の種類数(5)以内に収まるため、必ずすべて異なる柄になる
    expect(new Set(patterns).size).toBe(5);
  });

  it('starts PDF generation on the backend, polls until done, and navigates to the resulting download URL (バックエンドPDF生成)', async () => {
    const phrases = [{ id: 'p0', category: 'Cat1', kana: 'あ', phrase: '読み札テキスト0', answer: '-' }];
    let statusCallCount = 0;
    let generateRequestBody = null;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      if (url.includes('/generate-efuda-pdf-status')) {
        statusCallCount += 1;
        // 1回目はまだ生成中、2回目で完了を返す（ポーリングが継続することを検証する）
        if (statusCallCount < 2) return { ok: true, json: async () => ({ status: 'IN_PROGRESS' }) };
        return { ok: true, json: async () => ({ status: 'DONE', url: 'https://example.com/signed-download.pdf' }) };
      }
      if (url.includes('/generate-efuda-pdf')) {
        generateRequestBody = JSON.parse(options.body);
        return { ok: true, json: async () => ({ jobId: 'job-1' }) };
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

    await waitFor(() => screen.getByText('読み札テキスト0'));

    // window.location.hrefへの代入はjsdomでは実際のナビゲーションとして
    // 反映されない（"Not implemented: navigation"となり値が更新されない）ため、
    // window.locationを一時的に差し替えて代入先を検証する。他のテストに影響が
    // 残らないよう、必ず元のオブジェクトに戻す
    const originalLocation = window.location;
    delete window.location;
    window.location = { href: originalLocation.href };
    try {
      fireEvent.click(screen.getByText('PDFをダウンロード'));

      await waitFor(() => {
        expect(generateRequestBody).toEqual({ categoryParam: 'Cat1', side: 'front' });
      });
      await waitFor(() => {
        expect(screen.getByText('PDF生成中...')).toBeInTheDocument();
      });

      // ポーリング間隔(3秒)を挟んで2回目の問い合わせで完了するまで待つ
      await waitFor(
        () => {
          expect(window.location.href).toBe('https://example.com/signed-download.pdf');
        },
        { timeout: 10000 }
      );
      expect(statusCallCount).toBeGreaterThanOrEqual(2);
    } finally {
      delete window.location;
      window.location = originalLocation;
    }
  }, 15000);

  it('shows an alert when the backend PDF generation job fails (バックエンドPDF生成の失敗)', async () => {
    const phrases = [{ id: 'p0', category: 'Cat1', kana: 'あ', phrase: '読み札テキスト0', answer: '-' }];

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      if (url.includes('/generate-efuda-pdf-status')) {
        return { ok: true, json: async () => ({ status: 'FAILED', message: '生成に失敗しました' }) };
      }
      if (url.includes('/generate-efuda-pdf')) {
        return { ok: true, json: async () => ({ jobId: 'job-1' }) };
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

    await waitFor(() => screen.getByText('読み札テキスト0'));

    fireEvent.click(screen.getByText('PDFをダウンロード'));

    await waitFor(
      () => {
        expect(window.alert).toHaveBeenCalledWith('PDFの生成に失敗しました。');
      },
      { timeout: 10000 }
    );
  }, 15000);

  it('initializes printSide from the ?side URL query param, for headless server-side rendering (renderEfudaPdfWorkerのディープリンク対応)', async () => {
    window.history.pushState({}, '', '/?view=print-efuda&category=Cat1&side=back');

    const phrases = [{ id: 'p0', category: 'Cat1', kana: 'あ', phrase: '読み札テキスト0', answer: '-', level: '3' }];
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    // 表面のクリック操作を経由せず、初回描画から裏面（種別・レベル）が表示される
    await waitFor(() => {
      expect(document.querySelector('.efuda-card-back')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '裏面' })).toHaveClass('active');
  });

  it('adds the efuda-pdf-export class when ?pdfExport=1 is present, for server-side PDF capture (efuda-card-categoryをPDFにのみ表示するためのマーカー)', async () => {
    window.history.pushState({}, '', '/?view=print-efuda&category=Cat1&pdfExport=1');

    const phrases = [{ id: 'p0', category: 'Cat1', kana: 'あ', phrase: '読み札テキスト0', answer: '-' }];
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => screen.getByText('読み札テキスト0'));
    expect(document.querySelector('.efuda-print-area')).toHaveClass('efuda-pdf-export');
  });

  it('packs printed efuda cards across categories onto the same page without breaking per category', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }, { name: 'Cat2', group: 'engineer' }] }) };
      // Both categories reuse id "p1" to also verify same-id phrases from
      // different categories are kept distinct rather than deduped together.
      if (url.includes('category=Cat1')) {
        return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', kana: 'あ', phrase: 'Cat1テキスト', answer: '-' }] }) };
      }
      if (url.includes('category=Cat2')) {
        return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat2', kana: 'い', phrase: 'Cat2テキスト', answer: '-' }] }) };
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
      // カテゴリ境界で改ページせず、1枚ずつでも詰めて1ページにまとまる
      expect(document.querySelectorAll('.efuda-page').length).toBe(1);
      expect(screen.getByText('Cat1テキスト')).toBeInTheDocument();
      expect(screen.getByText('Cat2テキスト')).toBeInTheDocument();
    });
  });

  it('blocks selecting a category that would push the total printable cards over the limit (issue #PDF出力エラー)', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return {
          ok: true,
          json: async () => ({
            categories: [
              { name: 'Cat1', group: 'engineer', count: 250 },
              { name: 'Cat2', group: 'engineer', count: 250 },
              { name: 'Cat3', group: 'engineer', count: 10 },
            ],
          }),
        };
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
      expect(screen.getByRole('button', { name: /Cat3/ })).toBeInTheDocument();
    });

    // Cat1(250) + Cat2(250) = 500枚でちょうど上限。選択自体は許可される
    fireEvent.click(screen.getByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cat2/ }));
    expect(screen.getByRole('button', { name: /Cat1/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Cat2/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/選択中の合計: 500枚/)).toBeInTheDocument();

    // これ以上追加すると上限(500枚)を超えるため、Cat3は選択不可になる
    const cat3Button = screen.getByRole('button', { name: /Cat3/ });
    expect(cat3Button).toBeDisabled();
    fireEvent.click(cat3Button);
    expect(cat3Button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/かるたを始める/)).toHaveTextContent('かるたを始める');
  });

  it('fills a page across the category boundary instead of leaving trailing blanks', async () => {
    const cat1Phrases = Array.from({ length: 7 }, (_, i) => ({
      id: `a${i}`,
      category: 'Cat1',
      kana: 'あ',
      phrase: `Cat1テキスト${i}`,
      answer: '-',
    }));
    const cat2Phrases = Array.from({ length: 5 }, (_, i) => ({
      id: `b${i}`,
      category: 'Cat2',
      kana: 'い',
      phrase: `Cat2テキスト${i}`,
      answer: '-',
    }));

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }, { name: 'Cat2', group: 'engineer' }] }) };
      if (url.includes('category=Cat1')) return { ok: true, json: async () => ({ phrases: cat1Phrases }) };
      if (url.includes('category=Cat2')) return { ok: true, json: async () => ({ phrases: cat2Phrases }) };
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
      // Cat1(7枚)+Cat2(5枚)=12枚 → 10面/ページなので2ページ生成される
      const pages = document.querySelectorAll('.efuda-page');
      expect(pages.length).toBe(2);
      // 1ページ目はカテゴリ境界で途切れず10面すべて埋まる(空白カードなし)
      expect(pages[0].querySelectorAll('.efuda-card-text').length).toBe(10);
      // 2ページ目はCat2の残り2枚のみ
      expect(pages[1].querySelectorAll('.efuda-card-text').length).toBe(2);
    });
  });

  it('hides the level/difficulty jargon and enlarges the phrase card for the kids division', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '3' },
              { id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '3' },
            ],
          }),
        };
      }
      if (url.includes('get-phrase')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '3', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cat1' }));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      const phraseCard = screen.getByText('読み札1', { selector: '.yomifuda-phrase' }).closest('.yomifuda');
      expect(phraseCard).toHaveClass('yomifuda-kids');
    }, { timeout: 20000 });

    expect(screen.queryByText(/レベル:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('所要時間')).toBeInTheDocument();
    }, { timeout: 10000 });
    expect(screen.queryByText('難易度レベル')).not.toBeInTheDocument();

    randomSpy.mockRestore();
  }, 40000);

  it('shows the answer on the result screen after reading a phrase with answer data', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // 常にp1を選ばせる
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: '回答A' },
              { id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '-', answer: '回答B' },
            ],
          }),
        };
      }
      if (url.includes('get-phrase')) {
        const id = new URL(url).searchParams.get('id');
        const phraseById = {
          p1: { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: '回答A' },
          p2: { id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '-', answer: '回答B' },
        };
        return { ok: true, json: async () => ({ ...phraseById[id], audioData: 'dummy' }) };
      }
      if (url.includes('get-congratulation-audio')) {
        return { ok: true, json: async () => ({ audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));

    const categoryButton = await screen.findByRole('button', { name: 'Cat1' });
    fireEvent.click(categoryButton);

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    // 読み上げの待機(イントロ300ms + 表示までの3000ms + フェード500ms)後に読み札がめくられて表示される
    // (「読み札1」というテキストは履歴リストにも即時表示されるため、本体の表示領域に絞って待機する)
    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('答え')).toBeInTheDocument();
      expect(screen.getByText('回答A')).toBeInTheDocument();
    }, { timeout: 10000 });

    randomSpy.mockRestore();
  }, 40000);

  it('shows the answer and explanation on the detail/report screen opened from history (issue #693)', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // 常にp1を選ばせる
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: '回答A', explanation: '解説A' },
              { id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '-', answer: '回答B', explanation: '解説B' },
            ],
          }),
        };
      }
      if (url.includes('get-phrase')) {
        const id = new URL(url).searchParams.get('id');
        const phraseById = {
          p1: { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: '回答A', explanation: '解説A' },
          p2: { id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '-', answer: '回答B', explanation: '解説B' },
        };
        return { ok: true, json: async () => ({ ...phraseById[id], audioData: 'dummy' }) };
      }
      if (url.includes('get-comments')) return { ok: true, json: async () => ({ comments: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));

    const categoryButton = await screen.findByRole('button', { name: 'Cat1' });
    fireEvent.click(categoryButton);

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    // 「これまでに読み上げた札」一覧はデフォルト非表示のため、まずトグルボタンで開く（issue #548）
    fireEvent.click(await screen.findByText(/これまでに読み上げた札を表示する/));

    fireEvent.click(await screen.findByText('詳細・報告 →'));

    await waitFor(() => {
      expect(screen.getByText('答え')).toBeInTheDocument();
      expect(screen.getByText('回答A')).toBeInTheDocument();
      expect(screen.getByText('解説A')).toBeInTheDocument();
    });

    // バックエンドの上限(1000文字)と揃え、送信後に拒否される体験を防ぐ
    const commentTextarea = screen.getByPlaceholderText('例：かなが間違っている、フレーズが違うなど');
    expect(commentTextarea).toHaveAttribute('maxlength', '1000');

    randomSpy.mockRestore();
  }, 40000);

  it('keeps the reading history collapsed by default and toggles it via a button (issue #548)', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) {
        return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-' }] }) };
      }
      if (url.includes('get-phrase')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', phrase: '読み札1', audioData: 'dummy' }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    fireEvent.click(await screen.findByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    // デフォルトでは一覧が閉じている
    expect(screen.queryByText('これまでに読み上げた札', { selector: 'h2' })).not.toBeInTheDocument();
    const toggleButton = await screen.findByText('これまでに読み上げた札を表示する（1枚）');

    fireEvent.click(toggleButton);
    expect(await screen.findByText('これまでに読み上げた札', { selector: 'h2' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('これまでに読み上げた札を閉じる'));
    expect(screen.queryByText('これまでに読み上げた札', { selector: 'h2' })).not.toBeInTheDocument();

    randomSpy.mockRestore();
  }, 40000);

  it('persists the reading history across a reload via sessionStorage', async () => {
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

    const { unmount } = render(<App />);
    await act(async () => {});

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    await waitFor(() => screen.getByText('読み上げ済み 0 / 全2枚'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み上げ済み 1 / 全2枚')).toBeInTheDocument();
    });

    // ページリロードを模擬する（URLはpushStateにより既にcategory/divisionを保持している）
    unmount();
    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      expect(screen.getByText('読み上げ済み 1 / 全2枚')).toBeInTheDocument();
    });

    randomSpy.mockRestore();
  });

  it('updates settings (lang, sort order, speech rate)', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));

    // Select Category
    const categoryButton = await screen.findByRole('button', { name: /Cat1/ });
    fireEvent.click(categoryButton);

    // Check setting buttons
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('簡単')).toBeInTheDocument();
    expect(screen.getByText('はやい')).toBeInTheDocument();

    fireEvent.click(screen.getByText('English'));
    expect(localStorage.getItem('lang')).toBe('en');

    fireEvent.click(screen.getByText('簡単'));
    expect(localStorage.getItem('sortOrder')).toBe('easy');

    fireEvent.click(screen.getByText('はやい'));
    expect(localStorage.getItem('speechRate')).toBe('100%');

    // 自動で次への設定はデフォルトでオフで、間隔ボタンは表示されない
    expect(screen.queryByText('10秒')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('オン'));
    expect(localStorage.getItem('autoAdvance')).toBe('true');

    fireEvent.click(await screen.findByText('20秒'));
    expect(localStorage.getItem('autoAdvanceInterval')).toBe('20');

    // 後続のテストに自動読み上げ設定が引き継がれないようにする
    localStorage.removeItem('autoAdvance');
    localStorage.removeItem('autoAdvanceInterval');
  });

  it('shows the voice selector only for Japanese, updates the setting, and includes voiceId in the phrase request (issue #217)', async () => {
    // 直前のテストがlocalStorageにlang='en'を残す場合があるため、日本語から始まることを明示する
    localStorage.setItem('lang', 'ja');
    // このテスト自身がリトライされた場合（vitestのretry設定）、末尾のremoveItem('voiceId')が
    // 実行される前に前回の試行が失敗しているとKazuhaが残り、既定値Mizukiを検証する箇所が
    // 汚染された状態から始まってしまうため、テスト開始時点で明示的にクリアする
    localStorage.removeItem('voiceId');
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) {
        return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-' }] }) };
      }
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    // 日本語（デフォルト）では声選択が表示され、既定値はMizuki
    expect(screen.getByText('声:')).toBeInTheDocument();
    expect(localStorage.getItem('voiceId')).toBe('Mizuki');

    fireEvent.click(screen.getByText('Kazuha'));
    expect(localStorage.getItem('voiceId')).toBe('Kazuha');

    // Englishでは声選択欄自体が表示されなくなる（英語はRuth固定のため対象外）
    fireEvent.click(screen.getByText('English'));
    expect(screen.queryByText('声:')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('日本語'));
    expect(screen.getByText('声:')).toBeInTheDocument();

    await waitFor(() => screen.getByText('次の札'));
    fetch.mockClear();
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      const getPhraseCall = fetch.mock.calls.find(([url]) => url.includes('/get-phrase?'));
      expect(getPhraseCall).toBeDefined();
      expect(getPhraseCall[0]).toContain('voiceId=Kazuha');
    });

    localStorage.removeItem('voiceId');
    localStorage.removeItem('lang');
    randomSpy.mockRestore();
  });

  it('automatically advances to the next phrase after the configured interval when auto-advance is on', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    // UIが提示する最短の間隔（10秒）だと実時間のかかるテストになってしまうため、
    // 実際のUIには無い短い間隔をlocalStorageに直接設定して機構自体を検証する
    localStorage.setItem('autoAdvance', 'true');
    localStorage.setItem('autoAdvanceInterval', '1');

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
        return { ok: true, json: async () => ({ id, category: 'Cat1', phrase: `読み札${id}`, audioData: 'dummy' }) };
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

    // p1の読み上げが完了し「次の札」を待つ状態（自動読み上げの起点）になるまで待つ
    // （プリフェッチ機能によりp2のget-phraseはこの時点で既に裏で呼ばれ得るため、
    // 実際にp2の読み上げまで進むかどうかで自動読み上げ自体を検証する）
    await waitFor(() => {
      expect(screen.getByText('読み札p1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    // 「次の札」ボタンを一切押さずに、設定した間隔後の自動読み上げでp2の読み上げに進むのを待つ
    await waitFor(() => {
      expect(screen.getByText('読み札p2', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    randomSpy.mockRestore();
    // 後続のテストに自動読み上げ設定が引き継がれないようにする
    localStorage.removeItem('autoAdvance');
    localStorage.removeItem('autoAdvanceInterval');
  }, 40000);

  it('applies the selected theme to the document and persists it', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    // 初期値は自動(システム設定追従)で、matchMediaが使えない環境ではライト扱い
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');

    fireEvent.click(await screen.findByText('こども向け'));

    const categoryButton = await screen.findByRole('button', { name: /Cat1/ });
    fireEvent.click(categoryButton);

    fireEvent.click(await screen.findByText('ダーク'));
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');

    fireEvent.click(screen.getByText('ライト'));
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');

    fireEvent.click(screen.getByText('自動'));
    expect(localStorage.getItem('theme')).toBe('system');
  });

  it('shows an answer column with data and blank fallback in all-phrases view', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', phrase: '読み札A', level: '-', answer: '回答A' },
              { id: 'p2', category: 'Cat1', phrase: '読み札B', level: '-', answer: '-' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    const allPhrasesLink = screen.getByText(/全札一覧を見る/i);
    fireEvent.click(allPhrasesLink);

    await waitFor(() => {
      expect(screen.getByText('答え')).toBeInTheDocument();
      expect(screen.getByText('回答A')).toBeInTheDocument();
      expect(screen.getByText('読み札B').closest('tr')).not.toHaveTextContent('-');
    });

    // 読み札列・答え列の幅バランスが崩れないよう、同じ幅指定クラスを共有していることを確認する
    expect(screen.getByText('読み札', { selector: 'th' })).toHaveClass('all-phrases-col-balanced');
    expect(screen.getByText('答え', { selector: 'th' })).toHaveClass('all-phrases-col-balanced');
  });

  it('shows an explanation column with data and blank fallback in all-phrases view (issue #693)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', phrase: '読み札A', level: '-', answer: '回答A', explanation: '解説A' },
              { id: 'p2', category: 'Cat1', phrase: '読み札B', level: '-', answer: '-', explanation: '-' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/i));

    await waitFor(() => {
      expect(screen.getByText('解説')).toBeInTheDocument();
      expect(screen.getByText('解説A')).toBeInTheDocument();
      expect(screen.getByText('読み札B').closest('tr')).not.toHaveTextContent('-');
    });
  });

  it('shows existing comments for the phrase on the detail screen (issue #223)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', phrase: '読み札A', level: '-', answer: '-' },
            ],
          }),
        };
      }
      if (url.includes('get-phrase?')) {
        return {
          ok: true,
          json: async () => ({ id: 'p1', category: 'Cat1', phrase: '読み札A', kana: 'よ', level: '-', answer: '-' }),
        };
      }
      if (url.includes('get-comments')) {
        return {
          ok: true,
          json: async () => ({
            comments: [
              { id: 'c1', phraseId: 'p1', category: 'Cat1', phrase: '読み札A', comment: 'かなが間違っています', createdAt: '2026-01-01T00:00:00.000Z' },
              { id: 'c2', phraseId: 'p2', category: 'Cat1', phrase: '読み札B', comment: '別の札への指摘', createdAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/i));
    await waitFor(() => {
      expect(screen.getByText('読み札A')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('読み札A'));

    await waitFor(() => {
      expect(screen.getByText('これまでの指摘（1件）')).toBeInTheDocument();
      expect(screen.getByText('かなが間違っています')).toBeInTheDocument();
      expect(screen.queryByText('別の札への指摘')).not.toBeInTheDocument();
    });
  });

  it('supports keyboard sorting and exposes aria-sort on the all-phrases table headers (issue #195)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', phrase: 'あ', level: '-', answer: '-' },
              { id: 'p2', category: 'Cat1', phrase: 'い', level: '-', answer: '-' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/i));

    const phraseHeader = await screen.findByText('読み札', { selector: 'th' });

    // ソート前は方向が確定していないためaria-sortはnone
    expect(phraseHeader).toHaveAttribute('aria-sort', 'none');
    expect(phraseHeader).toHaveAttribute('tabIndex', '0');

    fireEvent.keyDown(phraseHeader, { key: 'Enter' });

    await waitFor(() => {
      expect(phraseHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    fireEvent.keyDown(phraseHeader, { key: ' ' });

    await waitFor(() => {
      expect(phraseHeader).toHaveAttribute('aria-sort', 'descending');
    });
  });

  it('sorts the all-phrases table by level, count/time/difficulty, and answer presence, handling "-"/missing values (issue #459)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              // levelは「初級/上級」の特別扱い・数値文字列・"-"（未設定）・それ以外の
              // 非数値文字列（parseIntがNaNになるケース）を一通り含める
              { id: 'p1', category: 'CatA', phrase: 'ぱ1', level: '初級', readCount: 5, averageTime: 2.5, averageDifficulty: 1.2, answer: '回答1' },
              { id: 'p2', category: 'CatB', phrase: 'ぱ2', level: '上級', readCount: 0, answer: '-' },
              { id: 'p3', category: 'CatA', phrase: 'ぱ3', level: '-', readCount: 3, averageTime: 1.1, averageDifficulty: 0.9 },
              { id: 'p4', category: 'CatC', phrase: 'ぱ4', level: '5', readCount: 0, averageTime: 0, averageDifficulty: 0, answer: '回答4' },
              { id: 'p5', category: 'CatB', phrase: 'ぱ5', level: '-', readCount: 1, averageTime: 0.5, averageDifficulty: 0.3, answer: '回答5' },
              { id: 'p6', category: 'CatA', phrase: 'ぱ6', level: 'その他', readCount: 2, averageTime: 1.5, averageDifficulty: 1.0, answer: '回答6' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/i));
    await screen.findByText('ぱ1');

    const getBodyRows = () => screen.getAllByRole('row').slice(1); // 先頭はヘッダー行
    const getPhraseOrder = () => getBodyRows().map(row => within(row).getByText(/^ぱ\d$/).textContent);
    // AllPhrasesView.jsxのソート可能な列見出しはaria-sort等の都合上role="button"を
    // 明示指定しているため（既定のcolumnheaderではない）、role="button"かつ名前で絞り込む
    const levelHeader = screen.getByRole('button', { name: /^Lv/ });
    const readCountHeader = screen.getByRole('button', { name: /^回数/ });
    const answerHeader = screen.getByRole('button', { name: /^答え/ });
    const categoryHeader = screen.getByRole('button', { name: /^カテゴリ/ });

    // Lv列でソート（"初級"/"上級"の特別扱い、"-"同士・"-"と実値の比較、非数値文字列を網羅）
    fireEvent.click(levelHeader);
    await waitFor(() => {
      expect(getPhraseOrder()[0]).not.toBe('');
    });
    fireEvent.click(levelHeader); // 降順へ切り替え、direction分岐の両方を通す

    // 回数列でソート（readCount未設定/0 のフォールバック分岐を通す）
    fireEvent.click(readCountHeader);
    await waitFor(() => {
      expect(getPhraseOrder().length).toBe(6);
    });
    fireEvent.click(readCountHeader);

    // 答え列でソート（未設定/"-"/実値の組み合わせを網羅）
    fireEvent.click(answerHeader);
    await waitFor(() => {
      expect(getPhraseOrder().length).toBe(6);
    });
    fireEvent.click(answerHeader);

    // カテゴリ列（文字列としての汎用ソート、大小比較の両分岐）でソート
    fireEvent.click(categoryHeader);
    await waitFor(() => {
      const order = getBodyRows().map(row => within(row).getAllByRole('cell')[0].textContent);
      expect(order).toEqual([...order].sort());
    });
    fireEvent.click(categoryHeader);
    await waitFor(() => {
      const order = getBodyRows().map(row => within(row).getAllByRole('cell')[0].textContent);
      expect(order).toEqual([...order].sort().reverse());
    });
  });

  it('filters all-phrases table by category when a filter button is clicked', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', phrase: '読み札Cat1', level: '-', answer: '-' },
              { id: 'p2', category: 'Cat2', phrase: '読み札Cat2', level: '-', answer: '-' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/i));

    // 両カテゴリの行が表示されるまで待機
    await waitFor(() => {
      expect(screen.getByText('読み札Cat1')).toBeInTheDocument();
      expect(screen.getByText('読み札Cat2')).toBeInTheDocument();
    });

    // Cat1 フィルタボタンをクリック
    const cat1FilterBtn = screen.getByRole('button', { name: /^Cat1/ });
    fireEvent.click(cat1FilterBtn);

    await waitFor(() => {
      expect(screen.getByText('読み札Cat1')).toBeInTheDocument();
      expect(screen.queryByText('読み札Cat2')).not.toBeInTheDocument();
    });

    // 「すべて」ボタンで全件に戻る
    fireEvent.click(screen.getByRole('button', { name: /^すべて/ }));

    await waitFor(() => {
      expect(screen.getByText('読み札Cat1')).toBeInTheDocument();
      expect(screen.getByText('読み札Cat2')).toBeInTheDocument();
    });
  });

  it('resets filter category when navigating back from all-phrases view', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', phrase: '読み札Cat1', level: '-', answer: '-' },
              { id: 'p2', category: 'Cat2', phrase: '読み札Cat2', level: '-', answer: '-' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/i));

    await waitFor(() => {
      expect(screen.getByText('読み札Cat1')).toBeInTheDocument();
    });

    // フィルタを Cat1 に絞る
    fireEvent.click(screen.getByRole('button', { name: /^Cat1/ }));
    await waitFor(() => {
      expect(screen.queryByText('読み札Cat2')).not.toBeInTheDocument();
    });

    // 戻るボタンで離脱し再度「全札一覧」へ
    fireEvent.click(screen.getByRole('button', { name: /← 戻る/ }));
    fireEvent.click(screen.getByText(/全札一覧を見る/i));

    // フィルタがリセットされ全件表示されること
    await waitFor(() => {
      expect(screen.getByText('読み札Cat1')).toBeInTheDocument();
      expect(screen.getByText('読み札Cat2')).toBeInTheDocument();
    });
  });

  it('filters all-phrases table by search text across phrase/kana/answer (issue #222)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', phrase: '犬も歩けば棒に当たる', kana: 'い', level: '-', answer: '-' },
              { id: 'p2', category: 'Cat1', phrase: '猫に小判', kana: 'ね', level: '-', answer: '真珠' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/i));

    await waitFor(() => {
      expect(screen.getByText('犬も歩けば棒に当たる')).toBeInTheDocument();
      expect(screen.getByText('猫に小判')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('読み札・読み・答えで検索');

    // 読み札の部分一致で絞り込み
    fireEvent.change(searchInput, { target: { value: '棒に当たる' } });
    await waitFor(() => {
      expect(screen.getByText('犬も歩けば棒に当たる')).toBeInTheDocument();
      expect(screen.queryByText('猫に小判')).not.toBeInTheDocument();
    });

    // 答えの部分一致で絞り込み（大文字小文字を区別しない）
    fireEvent.change(searchInput, { target: { value: '真珠' } });
    await waitFor(() => {
      expect(screen.getByText('猫に小判')).toBeInTheDocument();
      expect(screen.queryByText('犬も歩けば棒に当たる')).not.toBeInTheDocument();
    });

    // 該当なしの場合は案内文を表示
    fireEvent.change(searchInput, { target: { value: '該当しない文字列' } });
    await waitFor(() => {
      expect(screen.getByText('該当する札が見つかりません。')).toBeInTheDocument();
    });

    // 戻るボタンで離脱すると検索クエリがリセットされる
    fireEvent.change(searchInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /← 戻る/ }));
    fireEvent.click(screen.getByText(/全札一覧を見る/i));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('読み札・読み・答えで検索')).toHaveValue('');
      expect(screen.getByText('犬も歩けば棒に当たる')).toBeInTheDocument();
      expect(screen.getByText('猫に小判')).toBeInTheDocument();
    });
  });

  it('updates document title when viewing all-phrases', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });
    await act(async () => {
      render(<App />);
    });
    
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return {
          ok: true,
          json: async () => ({ categories: [] }),
        };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({ phrases: [] }),
        };
      }
      return { ok: false };
    });

    const allPhrasesLink = screen.getByText(/全札一覧を見る/i);
    fireEvent.click(allPhrasesLink);

    await waitFor(() => {
      expect(document.title).toBe('全札一覧 | かるた読み上げアプリ');
    });
  });

  it('stops the current reading and resets the queue when the stop button is pressed', async () => {
    const originalAudio = window.Audio;
    const pauseMock = vi.fn();
    // このテストは「再生中に停止ボタンを押す」挙動を検証するため、通常のモックのように
    // 即座にonendedを発火させず、再生が継続している状態（ユーザーが停止ボタンを押す
    // 前に音声が終わってしまわない状態）を維持できるAudioモックに差し替える
    // vitest v4はvi.fn()のモック実装をnewで呼び出す場合、アロー関数を許容しないため通常の関数式を使う
    window.Audio = vi.fn().mockImplementation(function (url) {
      const audio = {
        play: vi.fn().mockResolvedValue(),
        pause: pauseMock,
        load: vi.fn(),
        set src(_url) {
          // onendedを意図的に発火させない
        },
      };
      if (url) audio.src = url;
      return audio;
    });

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
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    const stopButton = await screen.findByRole('button', { name: '停止' });
    await waitFor(() => expect(stopButton).not.toBeDisabled(), { timeout: 10000 });

    fireEvent.click(stopButton);

    expect(pauseMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '停止' })).toBeDisabled();
      expect(screen.getByText('準備完了')).toBeInTheDocument();
    });

    window.Audio = originalAudio;
  }, 25000);

  it('recovers isReading (does not get stuck) after stopping mid-intro-sound and starting the next card (issue #262)', async () => {
    const originalAudio = window.Audio;
    const pauseMock = vi.fn();
    // カード1のイントロ音の再生中に停止ボタンを確実に捕まえられるよう、
    // 通常のテスト用モック（onendedを即座に自動発火させる）とは異なり、
    // onendedを意図的に発火させないモックに一時的に差し替える。
    // vitest v4はvi.fn()のモック実装をnewで呼び出す場合、アロー関数を許容しないため通常の関数式を使う
    window.Audio = vi.fn().mockImplementation(function (url) {
      const audio = {
        play: vi.fn().mockResolvedValue(),
        pause: pauseMock,
        load: vi.fn(),
        set src(_url) {
          // onendedを意図的に発火させない
        },
      };
      if (url) audio.src = url;
      return audio;
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-' },
              { id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '-' },
            ],
          }),
        };
      }
      if (url.includes('/get-phrase?id=p1')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy1' }) };
      if (url.includes('/get-phrase?id=p2')) return { ok: true, json: async () => ({ id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '-', audioData: 'dummy2' }) };
      if (url.includes('/record-time')) return { ok: true, json: async () => ({ message: 'ok' }) };
      return { ok: false };
    });

    try {
      await act(async () => {
        render(<App />);
      });

      fireEvent.click(await screen.findByText('こども向け'));
      fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

      await waitFor(() => screen.getByText('次の札'));
      fireEvent.click(screen.getByText('次の札'));

      // イントロ音（たいこの音）再生中に停止ボタンを押す
      const stopButton = await screen.findByRole('button', { name: '停止' });
      await waitFor(() => expect(stopButton).not.toBeDisabled(), { timeout: 10000 });
      fireEvent.click(stopButton);

      expect(pauseMock).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '停止' })).toBeDisabled();
      });

      // 以降のカードは通常のテスト用モック（onendedが自動発火する）に戻し、
      // カード2の読み上げが自然に完了できるようにする。
      window.Audio = originalAudio;

      // 停止直後に「次の札」を押しても、isReadingが真に固定されて以降ずっと
      // 読み上げできなくなってはいけない。
      fireEvent.click(screen.getByText('次の札'));

      // まずカード2が実際に読み上げを開始した（isReadingがtrueになった）ことを
      // 確認する。これを確認せずに次のtoBeDisabled()だけを見ると、カード2が
      // そもそも開始できずに停止ボタンが無効のまま据え置かれているだけの状態
      // （＝本来検知すべき回帰）を誤って合格させてしまう。
      await waitFor(() => expect(screen.getByRole('button', { name: '停止' })).not.toBeDisabled(), { timeout: 20000 });

      // その上で、カード2の読み上げが最後まで自然に完了し
      // （＝停止ボタンがいずれ押せなくなる＝isReadingがfalseに戻る）ことを確認する。
      await waitFor(() => expect(screen.getByRole('button', { name: '停止' })).toBeDisabled(), { timeout: 20000 });

      // カード2が実際に履歴へ記録され、次のカードへ進めることも確認する。
      // 「これまでに読み上げた札」一覧はデフォルト非表示のため、まずトグルボタンで開く（issue #548）
      const historyToggle = screen.queryByText(/これまでに読み上げた札を表示する/);
      if (historyToggle) {
        fireEvent.click(historyToggle);
      }
      expect(screen.getAllByText('読み札2').length).toBeGreaterThan(0);
    } finally {
      window.Audio = originalAudio;
    }
  }, 65000);

  it('keeps 次の札 disabled while the last remaining phrase is still being read, instead of racing ahead to the congratulations screen (issue #721)', async () => {
    const originalAudio = window.Audio;
    // イントロ音（wadodon.mp3）は従来どおり即座に終わらせるが、本編の音声は
    // テストが明示的にonendedを呼ぶまで意図的に終了させない。これにより
    // isReadingがtrueであり続ける状態（＝まだ読み上げ中）を作り出す
    window.Audio = vi.fn().mockImplementation(function (url) {
      const isIntro = url === 'wadodon.mp3';
      const audio = {
        play: vi.fn().mockResolvedValue(),
        pause: vi.fn(),
        load: vi.fn(),
        _src: undefined,
        get src() { return this._src; },
        set src(newUrl) {
          this._src = newUrl;
          if (isIntro) {
            setTimeout(() => {
              if (this.oncanplaythrough) this.oncanplaythrough();
              if (this.onended) setTimeout(this.onended, 0);
            }, 0);
          }
        },
      };
      if (url) audio.src = url;
      return audio;
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      if (url.includes('/record-time')) return { ok: true, json: async () => ({}) };
      if (url.includes('get-congratulation-audio')) return { ok: true, json: async () => ({ audioData: 'dummy' }) };
      return { ok: false };
    });

    try {
      await act(async () => {
        render(<App />);
      });

      fireEvent.click(await screen.findByText('こども向け'));
      fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

      await waitFor(() => screen.getByText('次の札'));
      fireEvent.click(screen.getByText('次の札'));

      // フリップ演出は音声再生とは独立したタイマーで進むため、本編音声が
      // 再生中でも読み札自体は表示される
      await waitFor(() => {
        expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
      }, { timeout: 20000 });

      // このカテゴリの唯一（＝最後）の札がまだ読み上げ中の間は、「次の札」ボタンが
      // 無効化されており、押しても全札読了（おめでとう画面）や結果表示には進まない
      expect(screen.getByText('次の札').closest('button')).toBeDisabled();
      fireEvent.click(screen.getByText('次の札'));
      expect(screen.queryByText('🎉 おめでとう！ 🎉')).not.toBeInTheDocument();
      expect(screen.queryByText('所要時間')).not.toBeInTheDocument();

      // 本編音声の再生が実際に完了すると、ボタンが再度押せるようになる
      const phraseAudio = window.Audio.mock.results.map((r) => r.value).find((a) => a.src === 'dummy');
      act(() => {
        phraseAudio.onended?.();
      });

      await waitFor(() => {
        expect(screen.getByText('次の札').closest('button')).not.toBeDisabled();
      }, { timeout: 10000 });

      // 読み上げ完了後に改めて「次の札」を押すと、最後の1枚だったため
      // 正しく全札読了（おめでとう画面）まで進む
      fireEvent.click(screen.getByText('次の札'));
      await waitFor(() => {
        expect(screen.getByText('🎉 おめでとう！ 🎉')).toBeInTheDocument();
      }, { timeout: 20000 });
    } finally {
      window.Audio = originalAudio;
    }
  }, 40000);

  it('reads many phrases back-to-back without ever stalling, all the way through to the session summary (issue #262 regression coverage)', async () => {
    // 未読み札から常に先頭（p1→p2→...の順）を選ばせ、カードの出現順を固定する
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const CARD_COUNT = 5;

    const phrases = Array.from({ length: CARD_COUNT }, (_, i) => ({
      id: `p${i + 1}`,
      category: 'Cat1',
      kana: 'あ',
      phrase: `読み札${i + 1}`,
      level: '-',
    }));

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      if (url.includes('/get-phrase?')) {
        const id = new URL(url).searchParams.get('id');
        return { ok: true, json: async () => ({ id, category: 'Cat1', kana: 'あ', phrase: `読み札${id.slice(1)}`, level: '-', audioData: `dummy-${id}` }) };
      }
      if (url.includes('/record-time')) return { ok: true, json: async () => ({ message: 'ok' }) };
      if (url.includes('get-congratulation-audio')) return { ok: true, json: async () => ({ audioData: 'dummy' }) };
      return { ok: false };
    });

    try {
      await act(async () => {
        render(<App />);
      });

      fireEvent.click(await screen.findByText('こども向け'));
      fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

      for (let i = 1; i <= CARD_COUNT; i++) {
        await waitFor(() => screen.getByText('次の札'));
        fireEvent.click(screen.getByText('次の札'));

        // 1枚でも滞留していれば、ここでタイムアウトして失敗する
        await waitFor(() => {
          expect(screen.getByText(`読み札${i}`, { selector: '.yomifuda-phrase' })).toBeInTheDocument();
        }, { timeout: 20000 });
      }

      // 最後の札を読み終えた後も「次の札」が機能し、読了サマリーまで到達できる
      // （＝どこかで読み上げ不能に固定されていない）ことを確認する
      fireEvent.click(screen.getByText('次の札'));

      await waitFor(() => {
        expect(screen.getByText('🎉 おめでとう！ 🎉')).toBeInTheDocument();
      }, { timeout: 20000 });
    } finally {
      randomSpy.mockRestore();
    }
  }, 130000);

  it('does not reset the elapsed-time start point when the card is replayed before advancing', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      }
      if (url.includes('get-phrases-list')) {
        // 未読の札を残しておき、記録直後に「全て読了」分岐へ入らないようにする
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-' },
              { id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '-' },
            ],
          }),
        };
      }
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      if (url.includes('/record-time')) {
        return { ok: true, json: async () => ({ message: 'ok' }) };
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

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    // 読み上げ中〜完了直後にカードをリピート再生させる
    await waitFor(() => expect(screen.getByText('もう一度')).not.toBeDisabled(), { timeout: 20000 });
    fireEvent.click(screen.getByText('もう一度'));

    // リピート再生（イントロ音＋本編）が終わるまで待つ
    await waitFor(() => expect(screen.getByText('もう一度')).not.toBeDisabled(), { timeout: 20000 });

    fetch.mockClear();
    fireEvent.click(screen.getByText('次の札'));

    let recordTimeCall;
    await waitFor(() => {
      recordTimeCall = fetch.mock.calls.find(([callUrl]) => callUrl.includes('/record-time'));
      expect(recordTimeCall).toBeDefined();
    });

    const body = JSON.parse(recordTimeCall[1].body);
    // リピート再生で計測開始点がリセットされていれば、経過時間はごく短時間になってしまう
    expect(body.time).toBeGreaterThan(2);
  }, 40000);

  it('logs an error instead of throwing an unhandled rejection when record-time fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-' },
              { id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '-' },
            ],
          }),
        };
      }
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      if (url.includes('/record-time')) {
        return Promise.reject(new Error('network error'));
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

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error recording time:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  }, 40000);

  it('shows a session summary with total/fastest/slowest time and confetti when all phrases are read', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // 常に未読の先頭（p1→p2の順）を選ばせる
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-' },
              { id: 'p2', category: 'Cat1', kana: 'い', phrase: '読み札2', level: '-' },
            ],
          }),
        };
      }
      if (url.includes('/get-phrase?')) {
        const id = new URL(url).searchParams.get('id');
        return { ok: true, json: async () => ({ id, category: 'Cat1', kana: 'あ', phrase: `読み札${id === 'p1' ? '1' : '2'}`, level: '-', audioData: 'dummy' }) };
      }
      if (url.includes('/record-time')) {
        return { ok: true, json: async () => ({ message: 'ok' }) };
      }
      if (url.includes('get-congratulation-audio')) {
        return { ok: true, json: async () => ({ audioData: 'dummy' }) };
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

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札2', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    // 2枚目の待機時間を1枚目より意図的に長くし、最速/最遅の判定を決定的にする
    await new Promise(resolve => setTimeout(resolve, 2000));

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('🎉 おめでとう！ 🎉')).toBeInTheDocument();
    }, { timeout: 20000 });

    expect(screen.getByText('合計所要時間')).toBeInTheDocument();

    const fastestCard = screen.getByText('最速の札').parentElement;
    expect(within(fastestCard).getByText('読み札1')).toBeInTheDocument();

    const slowestCard = screen.getByText('最も時間がかかった札').parentElement;
    expect(within(slowestCard).getByText('読み札2')).toBeInTheDocument();

    expect(document.querySelectorAll('.confetti-piece').length).toBeGreaterThan(0);

    randomSpy.mockRestore();
  }, 50000);

  it('registers players, records who took each card, and shows the winner on the result screen', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', phrase: '読み札1' }] }) };
      if (url.includes('/get-phrase?')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', phrase: '読み札1', audioData: 'dummy' }) };
      if (url.includes('/record-time')) return { ok: true, json: async () => ({ message: 'ok' }) };
      if (url.includes('get-congratulation-audio')) return { ok: true, json: async () => ({ audioData: 'dummy' }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));

    // 参加者登録（issue #518）はカテゴリ確定モーダルではなく、読み札画面のボタンから行う
    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('取った人を記録する'));

    const nameInput = screen.getByPlaceholderText('名前を入力');
    fireEvent.change(nameInput, { target: { value: 'たろう' } });
    fireEvent.click(screen.getByText('追加'));
    fireEvent.change(nameInput, { target: { value: 'はなこ' } });
    fireEvent.click(screen.getByText('追加'));

    expect(screen.getByText('たろう')).toBeInTheDocument();
    expect(screen.getByText('はなこ')).toBeInTheDocument();

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    expect(screen.getByText('取った人:')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'たろう' }));

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('🎉 おめでとう！ 🎉')).toBeInTheDocument();
    }, { timeout: 20000 });

    expect(screen.getByText('🏆 優勝: たろう')).toBeInTheDocument();
    const taroCard = screen.getByText('たろう', { selector: 'span.fw-bold' }).parentElement;
    expect(within(taroCard).getByText(/1枚/)).toBeInTheDocument();
    const hanakoCard = screen.getByText('はなこ', { selector: 'span.fw-bold' }).parentElement;
    expect(within(hanakoCard).getByText(/0枚/)).toBeInTheDocument();
  }, 50000);

  it('does not show the participant-registration UI on the category selection screen (issue #518)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }] }),
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    expect(screen.queryByPlaceholderText('名前を入力')).not.toBeInTheDocument();
    expect(screen.queryByText('取った人を記録する参加者（任意）')).not.toBeInTheDocument();
  });

  it('lets the participant-registration panel on the reading screen be toggled open and closed, with the button label reflecting whether anyone is registered yet (issue #518)', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', phrase: '読み札1' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));
    await waitFor(() => screen.getByText('次の札'));

    expect(screen.queryByPlaceholderText('名前を入力')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('取った人を記録する'));
    expect(screen.getByPlaceholderText('名前を入力')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('名前を入力'), { target: { value: 'たろう' } });
    fireEvent.click(screen.getByText('追加'));

    fireEvent.click(screen.getByText('参加者登録を閉じる'));
    expect(screen.queryByPlaceholderText('名前を入力')).not.toBeInTheDocument();

    // 登録済みの参加者がいる場合、再度開くボタンの文言が変わる
    expect(screen.getByText('参加者を編集する')).toBeInTheDocument();
  });

});
