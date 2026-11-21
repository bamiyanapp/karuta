import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { resetSharedAudioForTests } from './utils/audioUnlock';
import { setupAppTest } from './testing/appTestHarness';

// 読み上げの停止・復帰・読了サマリー・参加者登録。共通のモックとbeforeEachは、testing/appTestHarness.jsにある（issue #2192）。
setupAppTest();

describe('App', () => {
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

  it('keeps the currently displayed phrase card visible after pressing stop, instead of jumping back to the initial screen (issue #755)', async () => {
    const originalAudio = window.Audio;
    // イントロ音（wadodon.mp3）はすぐ完了させ、本編音声だけは意図的にonendedを
    // 発火させないままにして、読み札がフリップ表示された後も「読み上げ中」の
    // 状態（isReading）を維持したまま停止ボタンを押せるようにする
    window.Audio = vi.fn().mockImplementation(function (url) {
      const audio = {
        play: vi.fn().mockResolvedValue(),
        pause: vi.fn(),
        load: vi.fn(),
        _src: undefined,
        get src() {
          return this._src;
        },
        set src(u) {
          this._src = u;
          if (u === 'wadodon.mp3') {
            setTimeout(() => {
              if (this.onended) this.onended();
            }, 0);
          }
          // 本編音声（dummy）はonendedを意図的に発火させない
        },
      };
      if (url) audio.src = url;
      return audio;
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
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

      // フリップ演出（3秒待機＋フェード）を経て読み札が実際に表示されるまで待つ
      await waitFor(() => {
        expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
      }, { timeout: 15000 });

      const stopButton = screen.getByRole('button', { name: '停止' });
      expect(stopButton).not.toBeDisabled();
      fireEvent.click(stopButton);

      // 停止直後も読み札の表示はそのまま残り、準備完了画面へは切り替わらない
      await waitFor(() => {
        expect(stopButton).toBeDisabled();
      });
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
      expect(screen.queryByText('準備完了')).not.toBeInTheDocument();
    } finally {
      window.Audio = originalAudio;
    }
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
      // issue #997: 本編読み上げは共有<audio>要素（audioUnlock.js）を再利用するため、
      // window.Audioを差し替えただけでは、カード1で既に生成済みの（旧モックの）
      // 共有要素がそのまま使われてしまう。新しいモックの下で共有要素を作り直させる
      resetSharedAudioForTests();

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

  it('does not interrupt the currently-playing narration audio when 次の札 is clicked again before it finishes (issue #997 regression: unlockAudioPlayback used to be called on every click and overwrite the shared narration element mid-playback)', async () => {
    const originalAudio = window.Audio;
    const srcHistory = [];
    // イントロ音（wadodon.mp3）は即座に終わらせるが、本編音声（dummy1/dummy2）と
    // 解錠用の無音クリップ（data:audio/wav...）はonendedを意図的に発火させず、
    // 「まだ再生中」の状態を維持する。vitest v4はvi.fn()のモック実装をnewで呼び出す
    // 場合、アロー関数を許容しないため通常の関数式を使う
    window.Audio = vi.fn().mockImplementation(function (url) {
      const audio = {
        play: vi.fn().mockResolvedValue(),
        pause: vi.fn(),
        load: vi.fn(),
        _src: undefined,
        get src() { return this._src; },
        set src(u) {
          this._src = u;
          srcHistory.push(u);
          if (u === 'wadodon.mp3') {
            setTimeout(() => { if (this.onended) this.onended(); }, 0);
          }
        },
      };
      if (url) audio.src = url;
      return audio;
    });

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'Cat1' },
              { id: 'p2', category: 'Cat1' },
            ],
          }),
        };
      }
      if (url.includes('/get-phrase?id=p1')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', phrase: '読み札1', audioData: 'dummy1' }) };
      if (url.includes('/get-phrase?id=p2')) return { ok: true, json: async () => ({ id: 'p2', category: 'Cat1', phrase: '読み札2', audioData: 'dummy2' }) };
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
      // カード1の本編音声（dummy1）が再生開始（＝共有要素へsrcが設定）されるまで待つ。
      // onendedを発火させないため、この時点でまだ「再生中」の状態が続く
      await waitFor(() => {
        expect(srcHistory).toContain('dummy1');
      }, { timeout: 10000 });

      // カード1の本編がまだ再生中のうちに「次の札」をもう一度押す
      await waitFor(() => expect(screen.getByText('次の札').closest('button')).not.toBeDisabled(), { timeout: 10000 });
      fireEvent.click(screen.getByText('次の札'));
      await waitFor(() => screen.getByText('所要時間'), { timeout: 10000 });

      // issue #997の回帰: unlockAudioPlaybackが2回目のクリックでも呼ばれてしまうと、
      // 再生中の共有<audio>要素のsrcが解錠用の無音クリップへ書き換えられ、
      // カード1の本編読み上げが打ち切られてしまう。dummy1が再生され始めた後に
      // 無音クリップ（data:audio/wav...）のsrc書き換えが発生していないことを確認する
      const dummy1Index = srcHistory.indexOf('dummy1');
      const silentClipAfterDummy1 = srcHistory
        .slice(dummy1Index + 1)
        .filter((src) => typeof src === 'string' && src.startsWith('data:audio/wav'));
      expect(silentClipAfterDummy1).toHaveLength(0);

      randomSpy.mockRestore();
    } finally {
      window.Audio = originalAudio;
    }
  }, 30000);

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

    // リピート再生完了後も、画面が準備完了画面（初期表示）に戻らず、
    // 読み上げていたカードの表示のままであることを確認する（issue #729の調査で判明した回帰）
    expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();

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
