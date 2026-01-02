import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

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

    // Mock comments fetch before clicking
    // fetch.mockImplementationOnce replaces the next fetch call.
    // However, App.jsx might make other fetches (like categories again?).
    // We should be more specific or robust.
    
    // Override the mock to handle any upcoming requests correctly
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
      // Wait for comments fetch to complete and update state
      expect(screen.getByText(/TestPhrase/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('starts game when category is selected', async () => {
    // Categories fetch
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ categories: ['Cat1'] }),
    });

    await act(async () => {
      render(<App />);
    });

    await waitFor(() => {
      const elements = screen.queryAllByText('Cat1');
      expect(elements.length).toBeGreaterThan(0);
    });

    const categoryButton = screen.getByRole('button', { name: 'Cat1' });

    // Setup mocks for interactions (Phrases List & Phrase Detail)
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }),
        };
      }
      if (url.includes('get-phrase')) {
        return {
          ok: true,
          json: async () => ({ id: 'p1', phrase: 'Phrase1', category: 'Cat1', kana: 'P', audioData: 'data:audio/mp3;base64,...' }),
        };
      }
      if (url.includes('get-congratulation-audio')) {
        return {
          ok: true,
          json: async () => ({ audioData: 'data:audio/mp3;base64,...' }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(categoryButton);

    // Confirmation modal "Yes"
    await waitFor(() => screen.getByText(/をお手元に持っていますか？/));
    fireEvent.click(screen.getByText('はい'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Cat1' })).toBeInTheDocument();
      expect(screen.getByText('次の札を読み上げる')).toBeInTheDocument();
    });
  });
});
