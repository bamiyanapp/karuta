import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

// issue #1106: 札をめくった後に画面が真っ白になり操作不能になる事象への
// 再発防止策。レンダリング中の未捕捉例外でアプリ全体が真っ白になるのを防ぎ、
// 再読み込みで復帰できるフォールバック画面を出すことを検証する。
// issue #1113でdev-standardsの共有コード（shared/ui/ErrorBoundary.jsx）へ
// 切り替えたため、以降ここで検証するのはkaruta側の呼び出し方
// （reportUrlの指定内容）の妥当性のみ。コンポーネント本体の挙動は
// dev-standards側のドキュメント（docs/client-error-reporting-pattern.md）が
// 前提とする仕様どおりに動くことの確認を兼ねる

const REPORT_URL = 'https://api.example.com/report-client-error';

function Bomb() {
  throw new Error('テスト用の例外');
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Reactが例外発生時にコンソールへエラーログを出す（componentDidCatchとは別の、
    // React自体の既定動作）ため、テスト出力を汚さないよう抑制する
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // issue #1110: componentDidCatchがreportUrlへfetchするようになったため、
    // モックせず実行すると実際のAPIへネットワークリクエストが飛んでしまう
    window.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary reportUrl={REPORT_URL}>
        <div>正常な画面</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('正常な画面')).toBeInTheDocument();
    expect(window.fetch).not.toHaveBeenCalled();
  });

  it('renders a fallback screen instead of a blank page when a child throws during render', () => {
    render(
      <ErrorBoundary reportUrl={REPORT_URL}>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument();
  });

  it('reports the caught error to karuta\'s report-client-error endpoint without blocking the fallback screen (issue #1110)', () => {
    render(
      <ErrorBoundary reportUrl={REPORT_URL}>
        <Bomb />
      </ErrorBoundary>
    );

    expect(window.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = window.fetch.mock.calls[0];
    expect(url).toBe(REPORT_URL);
    const body = JSON.parse(options.body);
    expect(body.message).toBe('テスト用の例外');
    expect(body.stack).toEqual(expect.any(String));
    expect(body.componentStack).toEqual(expect.any(String));
    expect(body.url).toBe(window.location.href);
  });

  it('does not let a failed error report break the fallback screen', async () => {
    window.fetch = vi.fn().mockRejectedValue(new Error('ネットワークエラー'));

    render(
      <ErrorBoundary reportUrl={REPORT_URL}>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    // fetch失敗のcatchが未処理のPromise rejectionにならないことを確認するため、
    // マイクロタスクの解決を待つ
    await Promise.resolve();
  });

  it('reloads the page when the reload button is clicked', () => {
    const reloadSpy = vi.fn();
    // jsdomのwindow.location.reloadは未実装のため、呼び出しを検証できるよう差し替える
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    render(
      <ErrorBoundary reportUrl={REPORT_URL}>
        <Bomb />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
