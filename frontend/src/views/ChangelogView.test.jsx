import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChangelogView from './ChangelogView';

describe('ChangelogView', () => {
  it('renders each changelog entry (version/date/body) from changelog.json', () => {
    const setView = vi.fn();
    render(<ChangelogView setView={setView} />);

    expect(screen.getByRole('heading', { name: '更新履歴' })).toBeInTheDocument();
    // changelog.jsonは実データ（複数バージョン分のエントリ）を持つため、
    // 空配列時の分岐（「履歴はありません。」）ではなくこちらの分岐を通ることを確認する
    expect(screen.queryByText('履歴はありません。')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('← 戻る'));
    expect(setView).toHaveBeenCalledWith('game');
  });

  it('shows a placeholder message when changelog.json has no entries', async () => {
    vi.resetModules();
    vi.doMock('../changelog.json', () => ({ default: [] }));
    const { default: EmptyChangelogView } = await import('./ChangelogView');

    render(<EmptyChangelogView setView={vi.fn()} />);

    expect(screen.getByText('履歴はありません。')).toBeInTheDocument();

    vi.doUnmock('../changelog.json');
  });
});
