import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import { setupAppTest } from './testing/appTestHarness';

// 絵札の印刷画面（表裏・ページ詰め・PDF生成）。共通のモックとbeforeEachは、testing/appTestHarness.jsにある（issue #2192）。
setupAppTest();

describe('App', () => {
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
    expect(document.querySelectorAll('.efuda-page')).toHaveLength(2);

    fireEvent.click(screen.getByText('印刷する'));
    expect(window.print).toHaveBeenCalled();

    // 選択カテゴリが1つの場合でも、絵札にかるた種別が表示される
    expect(document.querySelector('.efuda-card-category')).toHaveTextContent('Cat1');
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
        expect(screen.getByRole('alert')).toHaveTextContent('PDFの生成に失敗しました。');
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
      expect(document.querySelectorAll('.efuda-page')).toHaveLength(1);
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
      expect(pages).toHaveLength(2);
      // 1ページ目はカテゴリ境界で途切れず10面すべて埋まる(空白カードなし)
      expect(pages[0].querySelectorAll('.efuda-card-text')).toHaveLength(10);
      // 2ページ目はCat2の残り2枚のみ
      expect(pages[1].querySelectorAll('.efuda-card-text')).toHaveLength(2);
    });
  });
});
