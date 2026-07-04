import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

window.alert = vi.fn();

// Mock fetch
window.fetch = vi.fn();

// Mock Audio
// アプリ側は `new Audio(url)` のコンストラクタ引数でsrcを渡すため(後からの代入はしない)、
// コンストラクタ引数を受け取ったらsrcセッターと同じ処理を実行する。
window.Audio = vi.fn().mockImplementation((url) => {
  const audio = {
    play: vi.fn().mockResolvedValue(),
    pause: vi.fn(),
    load: vi.fn(),
    // Simulate successful loading
    set src(url) {
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
  });

  it('renders division selection screen initially', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [] }),
    });

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('かるた読み上げアプリ')).toBeInTheDocument();
    expect(screen.getByText('こども向け')).toBeInTheDocument();
    expect(screen.getByText('エンジニア向け')).toBeInTheDocument();
  });

  it('shows a get-categories-specific error message when fetching categories fails, instead of the generic submit-failure message', async () => {
    fetch.mockRejectedValueOnce(new Error('network error'));

    await act(async () => {
      render(<App />);
    });

    expect(window.alert).toHaveBeenCalledWith('カテゴリの取得に失敗しました。');
  });

  it('shows the matching category list after choosing a division', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        categories: [
          { name: 'いろはかるた', group: 'kids' },
          { name: 'テスト用', group: 'kids' },
        ],
      }),
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
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        categories: [
          { name: 'KidsCat', group: 'kids' },
          { name: 'EngCat', group: 'engineer' },
        ],
      }),
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
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        categories: [{ name: 'EngCat', group: 'engineer' }],
      }),
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText('こども向け'));

    await waitFor(() => {
      expect(screen.getByText('このかるたはまだありません。')).toBeInTheDocument();
    });
    expect(screen.queryByText(/決定/)).not.toBeInTheDocument();
  });

  it('keeps the secondary navigation links reachable from the category selection screen', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }),
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
    expect(screen.queryByText(/決定/)).not.toBeInTheDocument();

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
    fireEvent.click(screen.getByText(/決定/));

    await waitFor(() => screen.getByText(/「Cat1」「Cat2」をお手元に持っていますか？/));
    fireEvent.click(screen.getByText('はい'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cat1・Cat2' })).toBeInTheDocument();
    });
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
    fireEvent.click(screen.getByText(/決定/));

    await waitFor(() => screen.getByText(/「Cat1」「Cat2」をお手元に持っていますか？/));
    fireEvent.click(screen.getByText('はい'));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      const getPhraseCall = fetch.mock.calls.find(([url]) => url.includes('/get-phrase?'));
      expect(getPhraseCall).toBeDefined();
      expect(getPhraseCall[0]).toContain('announceCategory=true');
    }, { timeout: 8000 });

    randomSpy.mockRestore();
  }, 25000);

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
    }, { timeout: 8000 });

    randomSpy.mockRestore();
  }, 25000);

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
    }, { timeout: 4000 });

    // p1の読み上げが完了する（次の札を再度押せる状態に戻る）のを待つ
    await waitFor(() => expect(screen.getByText('次の札')).not.toBeDisabled(), { timeout: 8000 });

    const callCountBeforeSecondClick = getPhraseCallIds.length;
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札2', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 8000 });

    // プリフェッチ済みのp2をそのまま使うため、/get-phraseの追加呼び出しは発生しない
    expect(getPhraseCallIds.length).toBe(callCountBeforeSecondClick);
    expect(getPhraseCallIds).toEqual(['p1', 'p2']);

    randomSpy.mockRestore();
  }, 15000);

  it('requests announceCategory=true for the detail-view replay when multiple categories are selected', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }, { name: 'Cat2', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list') && url.includes('category=Cat1')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-' }] }) };
      if (url.includes('get-phrases-list') && url.includes('category=Cat2')) return { ok: true, json: async () => ({ phrases: [{ id: 'p2', category: 'Cat2', kana: 'い', phrase: '読み札2', level: '-' }] }) };
      if (url.includes('/get-phrase?')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
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
    fireEvent.click(screen.getByText(/決定/));
    await waitFor(() => screen.getByText(/「Cat1」「Cat2」をお手元に持っていますか？/));
    fireEvent.click(screen.getByText('はい'));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 8000 });

    fetch.mockClear();
    fireEvent.click(await screen.findByText('詳細・報告 →'));

    await waitFor(() => {
      const getPhraseCall = fetch.mock.calls.find(([url]) => url.includes('/get-phrase?'));
      expect(getPhraseCall).toBeDefined();
      expect(getPhraseCall[0]).toContain('announceCategory=true');
    });

    randomSpy.mockRestore();
  }, 15000);

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

    // 用紙情報に商品ページへのリンクが設定されている
    const paperLink = screen.getByRole('link', { name: /エーワン マルチカード/ });
    expect(paperLink).toHaveAttribute('href', 'https://www.a-one.co.jp/product/search/detail.php?id=51677');
    expect(paperLink).toHaveAttribute('target', '_blank');

    // 11枚 → 10面/ページなので2ページ生成される
    expect(document.querySelectorAll('.efuda-page').length).toBe(2);

    fireEvent.click(screen.getByText('印刷する'));
    expect(window.print).toHaveBeenCalled();

    // 選択カテゴリが1つの場合でも、絵札にかるた種別が表示される
    expect(document.querySelector('.efuda-card-category')).toHaveTextContent('Cat1');
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
    fireEvent.click(screen.getByText(/決定/));
    fireEvent.click(screen.getByText('はい'));

    await waitFor(() => screen.getByText('絵札を印刷する'));
    fireEvent.click(screen.getByText('絵札を印刷する'));

    await waitFor(() => {
      // カテゴリ境界で改ページせず、1枚ずつでも詰めて1ページにまとまる
      expect(document.querySelectorAll('.efuda-page').length).toBe(1);
      expect(screen.getByText('Cat1テキスト')).toBeInTheDocument();
      expect(screen.getByText('Cat2テキスト')).toBeInTheDocument();
    });
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
    fireEvent.click(screen.getByText(/決定/));
    fireEvent.click(screen.getByText('はい'));

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
    }, { timeout: 8000 });

    expect(screen.queryByText(/レベル:/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('所要時間')).toBeInTheDocument();
    }, { timeout: 4000 });
    expect(screen.queryByText('難易度レベル')).not.toBeInTheDocument();

    randomSpy.mockRestore();
  }, 15000);

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
    }, { timeout: 8000 });

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('答え')).toBeInTheDocument();
      expect(screen.getByText('回答A')).toBeInTheDocument();
    }, { timeout: 4000 });

    randomSpy.mockRestore();
  }, 15000);

  it('shows the answer on the detail/report screen opened from history', async () => {
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
    }, { timeout: 8000 });

    fireEvent.click(await screen.findByText('詳細・報告 →'));

    await waitFor(() => {
      expect(screen.getByText('答え')).toBeInTheDocument();
      expect(screen.getByText('回答A')).toBeInTheDocument();
    });

    // バックエンドの上限(1000文字)と揃え、送信後に拒否される体験を防ぐ
    const commentTextarea = screen.getByPlaceholderText('例：かなが間違っている、フレーズが違うなど');
    expect(commentTextarea).toHaveAttribute('maxlength', '1000');

    randomSpy.mockRestore();
  }, 15000);

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
    }, { timeout: 8000 });

    // 「次の札」ボタンを一切押さずに、設定した間隔後の自動読み上げでp2の読み上げに進むのを待つ
    await waitFor(() => {
      expect(screen.getByText('読み札p2', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 8000 });

    randomSpy.mockRestore();
    // 後続のテストに自動読み上げ設定が引き継がれないようにする
    localStorage.removeItem('autoAdvance');
    localStorage.removeItem('autoAdvanceInterval');
  }, 15000);

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
    window.Audio = vi.fn().mockImplementation((url) => {
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
    await waitFor(() => expect(stopButton).not.toBeDisabled(), { timeout: 4000 });

    fireEvent.click(stopButton);

    expect(pauseMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '停止' })).toBeDisabled();
      expect(screen.getByText('準備完了')).toBeInTheDocument();
    });

    window.Audio = originalAudio;
  }, 10000);

  it('recovers isReading (does not get stuck) after stopping mid-intro-sound and starting the next card (issue #262)', async () => {
    const originalAudio = window.Audio;
    const pauseMock = vi.fn();
    // カード1のイントロ音の再生中に停止ボタンを確実に捕まえられるよう、
    // 通常のテスト用モック（onendedを即座に自動発火させる）とは異なり、
    // onendedを意図的に発火させないモックに一時的に差し替える。
    window.Audio = vi.fn().mockImplementation((url) => {
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
      await waitFor(() => expect(stopButton).not.toBeDisabled(), { timeout: 4000 });
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
      await waitFor(() => expect(screen.getByRole('button', { name: '停止' })).not.toBeDisabled(), { timeout: 8000 });

      // その上で、カード2の読み上げが最後まで自然に完了し
      // （＝停止ボタンがいずれ押せなくなる＝isReadingがfalseに戻る）ことを確認する。
      await waitFor(() => expect(screen.getByRole('button', { name: '停止' })).toBeDisabled(), { timeout: 8000 });

      // カード2が実際に履歴へ記録され、次のカードへ進めることも確認する
      expect(screen.getAllByText('読み札2').length).toBeGreaterThan(0);
    } finally {
      window.Audio = originalAudio;
    }
  }, 25000);

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
        }, { timeout: 8000 });
      }

      // 最後の札を読み終えた後も「次の札」が機能し、読了サマリーまで到達できる
      // （＝どこかで読み上げ不能に固定されていない）ことを確認する
      fireEvent.click(screen.getByText('次の札'));

      await waitFor(() => {
        expect(screen.getByText('🎉 おめでとう！ 🎉')).toBeInTheDocument();
      }, { timeout: 8000 });
    } finally {
      randomSpy.mockRestore();
    }
  }, 40000);

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
    }, { timeout: 8000 });

    // 読み上げ中〜完了直後にカードをリピート再生させる
    await waitFor(() => expect(screen.getByText('もう一度')).not.toBeDisabled(), { timeout: 8000 });
    fireEvent.click(screen.getByText('もう一度'));

    // リピート再生（イントロ音＋本編）が終わるまで待つ
    await waitFor(() => expect(screen.getByText('もう一度')).not.toBeDisabled(), { timeout: 8000 });

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
  }, 15000);

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
    }, { timeout: 8000 });

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error recording time:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  }, 15000);

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
    }, { timeout: 8000 });

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札2', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 8000 });

    // 2枚目の待機時間を1枚目より意図的に長くし、最速/最遅の判定を決定的にする
    await new Promise(resolve => setTimeout(resolve, 2000));

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('🎉 おめでとう！ 🎉')).toBeInTheDocument();
    }, { timeout: 8000 });

    expect(screen.getByText('合計所要時間')).toBeInTheDocument();

    const fastestCard = screen.getByText('最速の札').parentElement;
    expect(within(fastestCard).getByText('読み札1')).toBeInTheDocument();

    const slowestCard = screen.getByText('最も時間がかかった札').parentElement;
    expect(within(slowestCard).getByText('読み札2')).toBeInTheDocument();

    expect(document.querySelectorAll('.confetti-piece').length).toBeGreaterThan(0);

    randomSpy.mockRestore();
  }, 20000);

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
    fireEvent.click(screen.getByText(/決定/));

    await waitFor(() => screen.getByText(/「Cat1」をお手元に持っていますか？/));

    const nameInput = screen.getByPlaceholderText('名前を入力');
    fireEvent.change(nameInput, { target: { value: 'たろう' } });
    fireEvent.click(screen.getByText('追加'));
    fireEvent.change(nameInput, { target: { value: 'はなこ' } });
    fireEvent.click(screen.getByText('追加'));

    expect(screen.getByText('たろう')).toBeInTheDocument();
    expect(screen.getByText('はなこ')).toBeInTheDocument();

    fireEvent.click(screen.getByText('はい'));

    await waitFor(() => screen.getByText('次の札'));
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

  it('does not show player registration or the taken-by buttons in kids mode even if players are already registered', async () => {
    sessionStorage.setItem('players', JSON.stringify(['たろう']));

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', phrase: '読み札1' }] }) };
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

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 8000 });

    expect(screen.queryByText('取った人:')).not.toBeInTheDocument();
  }, 15000);
});
