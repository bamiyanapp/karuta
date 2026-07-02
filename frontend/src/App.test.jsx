import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

  it('only allows a single category to be selected for the kids division', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        categories: [
          { name: 'Cat1', group: 'kids' },
          { name: 'Cat2', group: 'kids' },
        ],
      }),
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText('こども向け'));

    const cat1Button = await screen.findByRole('button', { name: /Cat1/ });
    const cat2Button = await screen.findByRole('button', { name: /Cat2/ });

    fireEvent.click(cat1Button);
    expect(screen.getByRole('button', { name: /Cat1/ })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(cat2Button);
    expect(screen.getByRole('button', { name: /Cat1/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Cat2/ })).toHaveAttribute('aria-pressed', 'true');
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
    fireEvent.click(screen.getByText(/決定/));

    await waitFor(() => screen.getByText(/をお手元に持っていますか？/));
    fireEvent.click(screen.getByText('はい'));

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
    });

    randomSpy.mockRestore();
  });

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
    fireEvent.click(screen.getByText(/決定/));
    fireEvent.click(screen.getByText('はい'));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      const getPhraseCall = fetch.mock.calls.find(([url]) => url.includes('/get-phrase?'));
      expect(getPhraseCall).toBeDefined();
      expect(getPhraseCall[0]).toContain('announceCategory=false');
    });

    randomSpy.mockRestore();
  });

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
    fireEvent.click(screen.getByText(/決定/));
    fireEvent.click(screen.getByText('はい'));

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
    fireEvent.click(screen.getByText(/決定/));
    fireEvent.click(screen.getByText('はい'));

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
    fireEvent.click(screen.getByText(/決定/));
    fireEvent.click(screen.getByText('はい'));

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

    randomSpy.mockRestore();
  }, 15000);

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
    fireEvent.click(screen.getByText(/決定/));
    fireEvent.click(screen.getByText('はい'));

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
  });

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
    fireEvent.click(screen.getByText(/決定/));
    fireEvent.click(screen.getByText('はい'));

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

});
