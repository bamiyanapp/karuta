import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

window.alert = vi.fn();

// Mock fetch
window.fetch = vi.fn();

// Mock Audio
window.Audio = vi.fn().mockImplementation(() => ({
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
}));

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

    const categoryButton = screen.getByRole('button', { name: 'Cat1' });
    fireEvent.click(categoryButton);

    await waitFor(() => screen.getByText(/をお手元に持っていますか？/));
    fireEvent.click(screen.getByText('はい'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cat1' })).toBeInTheDocument();
      expect(screen.getByText('次の札')).toBeInTheDocument();
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

    const categoryButton = await screen.findByRole('button', { name: 'Cat1' });
    fireEvent.click(categoryButton);
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

  it('updates settings (lang, sort order, speech rate)', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: ['Cat1'] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });
    
    // Select Category
    const categoryButton = await screen.findByRole('button', { name: 'Cat1' });
    fireEvent.click(categoryButton);
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
