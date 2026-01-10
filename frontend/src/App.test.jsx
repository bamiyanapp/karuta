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
      expect(document.title).toBe('全札一覧');
    });
  });

});
