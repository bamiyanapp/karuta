import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { setupAppTest } from './testing/appTestHarness';

// 全札一覧画面（取得・ソート・絞り込み・検索）と指摘一覧への遷移。共通のモックとbeforeEachは、testing/appTestHarness.jsにある（issue #2192）。
setupAppTest();

describe('App', () => {
  // 指摘された内容を確認するリンクはトップページから全札一覧画面上部へ移設した（issue #1429）
  // issue #2190: 画面の主要な内容の取得に失敗したら、「読み込み中」「0件」と区別して、
  // 画面内にエラー表示と再試行ボタンを出す。再試行で復帰できる
  it('shows an in-screen error with a retry button when the all-phrases fetch fails, and recovers on retry (issue #2190)', async () => {
    let phrasesListShouldFail = true;
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      if (url.includes('get-phrases-list')) {
        if (phrasesListShouldFail) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'TestCat', phrase: 'RecoveredPhrase', level: '1' }] }) };
      }
      return { ok: false };
    });
    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/));
    // GETは自動で3回リトライ（待機は合計約2秒）してから失敗とするため、待機時間を長めに取る
    expect(await screen.findByText('かるたデータの取得に失敗しました。', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();

    phrasesListShouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: '再試行する' }));
    expect(await screen.findByText(/RecoveredPhrase/, {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('shows an in-screen error with a retry button when the comments fetch fails, and recovers on retry (issue #2190)', async () => {
    let commentsShouldFail = true;
    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [] }) };
      if (url.includes('get-comments')) {
        if (commentsShouldFail) return { ok: false, status: 500, json: async () => ({}) };
        return { ok: true, json: async () => ({ comments: [{ id: 1, phrase: 'TestPhrase', comment: 'Fix this', category: 'TestCat', createdAt: new Date().toISOString() }] }) };
      }
      return { ok: false };
    });
    await act(async () => {
      render(<App />);
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/));
    fireEvent.click(await screen.findByText(/指摘された内容を確認する/i));

    expect(await screen.findByText('指摘の取得に失敗しました。', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText('まだ指摘はありません。')).not.toBeInTheDocument();

    commentsShouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: '再試行する' }));
    expect(await screen.findByText(/TestPhrase/)).toBeInTheDocument();
  });

  it('navigates to comments view from the all-phrases screen', async () => {
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
      if (url.includes('get-comments')) {
        return {
          ok: true,
          json: async () => ({ comments: [{ id: 1, phrase: 'TestPhrase', comment: 'Fix this', category: 'TestCat', createdAt: new Date().toISOString() }] }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/));
    const commentsLink = await screen.findByText(/指摘された内容を確認する/i);
    fireEvent.click(commentsLink);

    await waitFor(() => {
      expect(screen.getByText('指摘された内容一覧')).toBeInTheDocument();
      expect(screen.getByText(/TestPhrase/)).toBeInTheDocument();
    }, { timeout: 3000 });
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

    // 解説列は一覧表示の項目からは削除している（issue #763）
    expect(screen.queryByText('解説', { selector: 'th' })).not.toBeInTheDocument();
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
    // AllPhrasesView.jsxのソート可能な列見出しは<th scope="col">の暗黙ロール
    // （columnheader）のまま、tabIndex・onClick・onKeyDownで操作可能にしている
    // （issue #857: aria-sortはcolumnheader/rowheaderにのみ許可される属性のため、
    // role="button"で上書きしない）
    const levelHeader = screen.getByRole('columnheader', { name: /^Lv/ });
    const readCountHeader = screen.getByRole('columnheader', { name: /^回数/ });
    const answerHeader = screen.getByRole('columnheader', { name: /^答え/ });
    const categoryHeader = screen.getByRole('columnheader', { name: /^カテゴリ/ });

    // Lv列でソート（"初級"/"上級"の特別扱い、"-"同士・"-"と実値の比較、非数値文字列を網羅）
    fireEvent.click(levelHeader);
    await waitFor(() => {
      expect(getPhraseOrder()[0]).not.toBe('');
    });
    fireEvent.click(levelHeader); // 降順へ切り替え、direction分岐の両方を通す

    // 回数列でソート（readCount未設定/0 のフォールバック分岐を通す）
    fireEvent.click(readCountHeader);
    await waitFor(() => {
      expect(getPhraseOrder()).toHaveLength(6);
    });
    fireEvent.click(readCountHeader);

    // 答え列でソート（未設定/"-"/実値の組み合わせを網羅）
    fireEvent.click(answerHeader);
    await waitFor(() => {
      expect(getPhraseOrder()).toHaveLength(6);
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

    // 「すべて」ボタンで全件に戻る（種別絞り込み側。division絞り込み側の「すべて」
    // ボタンと区別するため、件数の括弧付きで一致させる）
    fireEvent.click(screen.getByRole('button', { name: /^すべて \(/ }));

    await waitFor(() => {
      expect(screen.getByText('読み札Cat1')).toBeInTheDocument();
      expect(screen.getByText('読み札Cat2')).toBeInTheDocument();
    });
  });

  it('narrows the category buttons in all-phrases view by division (kids/engineer), issue #730', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        categories: [
          { name: 'KidsCat', group: 'kids' },
          { name: 'EngineerCat', group: 'engineer' },
        ],
      }),
    });
    await act(async () => {
      render(<App />);
    });

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) {
        return {
          ok: true,
          json: async () => ({
            categories: [
              { name: 'KidsCat', group: 'kids' },
              { name: 'EngineerCat', group: 'engineer' },
            ],
          }),
        };
      }
      if (url.includes('get-phrases-list')) {
        return {
          ok: true,
          json: async () => ({
            phrases: [
              { id: 'p1', category: 'KidsCat', phrase: '読み札Kids', level: '-', answer: '-' },
              { id: 'p2', category: 'EngineerCat', phrase: '読み札Engineer', level: '-', answer: '-' },
            ],
          }),
        };
      }
      return { ok: false };
    });

    fireEvent.click(screen.getByText(/全札一覧を見る/i));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^KidsCat/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^EngineerCat/ })).toBeInTheDocument();
    });

    // 「こども向け」に絞り込むと、エンジニア向けの種別ボタンは表示されなくなる
    fireEvent.click(screen.getByRole('button', { name: 'こども向け' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^KidsCat/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^EngineerCat/ })).not.toBeInTheDocument();
    });

    // 「エンジニア向け」に切り替えると、今度はこども向けの種別ボタンが消える
    fireEvent.click(screen.getByRole('button', { name: 'エンジニア向け' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^EngineerCat/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^KidsCat/ })).not.toBeInTheDocument();
    });

    // 「すべて」（division側）に戻すと両方の種別ボタンが再び表示される
    fireEvent.click(screen.getByRole('button', { name: 'すべて' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^KidsCat/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^EngineerCat/ })).toBeInTheDocument();
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
      expect(document.title).toBe('全札一覧 | かるた読み上げ');
    });
  });
});
