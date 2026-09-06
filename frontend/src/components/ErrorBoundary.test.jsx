import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

// issue #1106: 札をめくった後に画面が真っ白になり操作不能になる事象への
// 再発防止策。レンダリング中の未捕捉例外でアプリ全体が真っ白になるのを防ぎ、
// 再読み込みで復帰できるフォールバック画面を出すことを検証する

function Bomb() {
  throw new Error('テスト用の例外');
}

describe('ErrorBoundary', () => {
  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>正常な画面</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('正常な画面')).toBeInTheDocument();
  });

  it('renders a fallback screen instead of a blank page when a child throws during render', () => {
    // Reactが例外発生時にコンソールへエラーログを出す（componentDidCatchとは別の、
    // React自体の既定動作）ため、テスト出力を汚さないよう抑制する
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('reloads the page when the reload button is clicked', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    // jsdomのwindow.location.reloadは未実装のため、呼び出しを検証できるよう差し替える
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
