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

  it('renders category selection screen initially', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: ['いろはかるた', 'テスト用'] }),
    });

    await act(async () => {
      render(<App />);
    });

    expect(screen.getByText('かるた読み上げアプリ')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('いろはかるた')).toBeInTheDocument();
      expect(screen.getByText('テスト用')).toBeInTheDocument();
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
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: ['Cat1'] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

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
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: ['Cat1', 'Cat2'] }) };
      if (url.includes('category=Cat1')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('category=Cat2')) return { ok: true, json: async () => ({ phrases: [{ id: 'p2', category: 'Cat2' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

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

  it('shows efuda print view with answer fallback to phrase and paginates by 10', async () => {
    const phrases = Array.from({ length: 11 }, (_, i) => ({
      id: `p${i}`,
      category: 'Cat1',
      kana: 'あ',
      phrase: `読み札テキスト${i}`,
      answer: i === 0 ? '-' : `回答${i}`,
    }));

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: ['Cat1'] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases }) };
      return { ok: false };
    });

    window.print = vi.fn();

    await act(async () => {
      render(<App />);
    });

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

    // 11枚 → 10面/ページなので2ページ生成される
    expect(document.querySelectorAll('.efuda-page').length).toBe(2);

    fireEvent.click(screen.getByText('印刷する'));
    expect(window.print).toHaveBeenCalled();
  });

  it('groups printed efuda pages by category and labels each page when multiple categories are selected', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: ['Cat1', 'Cat2'] }) };
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
      // 各カテゴリが別ページになる（1枚ずつでも合算されず2ページ）
      expect(document.querySelectorAll('.efuda-page').length).toBe(2);
      expect(screen.getByText('Cat1テキスト')).toBeInTheDocument();
      expect(screen.getByText('Cat2テキスト')).toBeInTheDocument();
    });
  });

  it('shows the answer on the result screen after reading a phrase with answer data', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0); // 常にp1を選ばせる
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return { ok: true, json: async () => ({ categories: ['Cat1'] }) };
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

  it('updates settings (lang, sort order, speech rate)', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: ['Cat1'] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });
    
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
