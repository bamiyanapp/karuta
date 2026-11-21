import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { setupAppTest } from './testing/appTestHarness';

// 結果・詳細画面、読み上げ履歴、設定・テーマ。共通のモックとbeforeEachは、testing/appTestHarness.jsにある（issue #2192）。
setupAppTest();

describe('App', () => {
  it('shows the level on the card but hides the difficulty-rating jargon, and enlarges the phrase card, for the kids division (issue #1107: level display was previously hidden for kids)', async () => {
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

    expect(screen.getByText('レベル: 3')).toBeInTheDocument();

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

  it('updates settings (lang, sort order, speech rate, card reveal delay)', async () => {
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

    // 札の表示までの待ち時間（issue #471）: 既定は3秒、変更するとlocalStorageへ保存される
    expect(screen.getByText('3秒').closest('button')).toHaveClass('btn-dark');
    fireEvent.click(screen.getByText('1秒'));
    expect(localStorage.getItem('cardRevealDelay')).toBe('1000');
    // 後続テスト（実時間の経過に依存するもの）に既定値以外の待ち時間が
    // 漏れないようクリーンアップする
    localStorage.removeItem('cardRevealDelay');
  });

  it('migrates a pre-issue-1001 speechRate of 70% to 75% so existing users actually get the faster rate (issue #1115)', async () => {
    localStorage.setItem('speechRate', '70%');
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    // 移行後は「ゆっくり」ボタンが選択状態（active）で表示され、保存値も書き換わる
    expect(screen.getByText('ゆっくり').closest('button')).toHaveClass('btn-dark');
    expect(localStorage.getItem('speechRate')).toBe('75%');

    localStorage.removeItem('speechRate');
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

  it('recovers and advances to the next phrase even if audio.play() never settles (issue #729)', async () => {
    const originalAudio = window.Audio;
    // モバイルブラウザのオートプレイポリシー等により、audio.play()のPromiseが
    // 解決も拒否もされないまま（onendedも発火しないまま）ハングし続けるケースを再現する。
    // vitest v4はvi.fn()のモック実装をnewで呼び出す場合、アロー関数を許容しないため通常の関数式を使う
    window.Audio = vi.fn().mockImplementation(function () {
      const audio = {
        play: vi.fn(() => new Promise(() => {})), // 永久に解決/拒否されない
        pause: vi.fn(),
        load: vi.fn(),
        set src(_url) {
          // onendedを意図的に発火させない（ハングを模擬する）
        },
      };
      return audio;
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

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

    try {
      await act(async () => {
        render(<App />);
      });

      fireEvent.click(await screen.findByText('こども向け'));
      fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

      await waitFor(() => screen.getByText('次の札'));
      fireEvent.click(screen.getByText('次の札'));

      // イントロ音・本編音声のaudio.play()が両方ハングしても、タイムアウトにより
      // 強制的に諦めて読み上げ進行（表示のフェード）が先へ進むことを確認する
      // （タイムアウト15秒×2回分の余裕を見て待つ）
      await waitFor(() => {
        expect(screen.getByText('読み札p1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
      }, { timeout: 45000 });

      // 「次の札」ボタンを押してp2まで進めても、同様にハングから復帰することを確認する
      await waitFor(() => screen.getByText('次の札'), { timeout: 45000 });
      fireEvent.click(screen.getByText('次の札'));

      await waitFor(() => {
        expect(screen.getByText('読み札p2', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
      }, { timeout: 45000 });

      randomSpy.mockRestore();
    } finally {
      window.Audio = originalAudio;
    }
  }, 100000);

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
});
