import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QuizRoomInfoView from './QuizRoomInfoView';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('QuizRoomInfoView', () => {
  it('shows the room code, invite URL, and a QR code immediately, since this is now a dedicated screen rather than a collapsible panel (issue #547)', async () => {
    render(<QuizRoomInfoView setView={vi.fn()} roomId="ABC123" />);

    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(await screen.findByAltText('参加用QRコード')).toBeInTheDocument();
    const urlInput = screen.getByDisplayValue(/roomId=ABC123/);
    expect(urlInput).toBeInTheDocument();
  });

  // 参加者一覧テーブルの並び順・接続状態・回答数/正答数の詳細な検証は
  // QuizRoomParticipantTable.test.jsx（issue #800で共通化）に集約した。ここでは
  // 「この画面がテーブルへ正しくpropsを渡していること」だけを薄く確認する
  it('shows the participant list as a table at the bottom of the screen (issue #587, #599)', () => {
    render(
      <QuizRoomInfoView
        setView={vi.fn()}
        roomId="ABC123"
        quizRoomParticipants={['たろう']}
        quizRoomPoints={{ たろう: 3 }}
      />
    );

    expect(screen.getByText('参加者一覧')).toBeInTheDocument();
    expect(screen.getByText('たろう')).toBeInTheDocument();
  });

  it('does not show the participant list section when there are no participants yet', () => {
    render(<QuizRoomInfoView setView={vi.fn()} roomId="ABC123" />);
    expect(screen.queryByText('参加者一覧')).not.toBeInTheDocument();
    expect(screen.queryByText('ポイントをリセット')).not.toBeInTheDocument();
  });

  it('calls resetQuizRoomPoints only after the admin confirms the reset (issue #615)', () => {
    const resetQuizRoomPoints = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <QuizRoomInfoView
        setView={vi.fn()}
        roomId="ABC123"
        quizRoomParticipants={['たろう']}
        quizRoomPoints={{ たろう: 3 }}
        resetQuizRoomPoints={resetQuizRoomPoints}
      />
    );

    fireEvent.click(screen.getByText('ポイントをリセット'));
    expect(resetQuizRoomPoints).not.toHaveBeenCalled();

    window.confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText('ポイントをリセット'));
    expect(resetQuizRoomPoints).toHaveBeenCalled();
  });

  it('lets the admin go back to the normal game screen', () => {
    const setView = vi.fn();
    render(<QuizRoomInfoView setView={setView} roomId="ABC123" />);

    fireEvent.click(screen.getByText('← 戻る'));

    expect(setView).toHaveBeenCalledWith('game');
  });

  it('copies the invite URL to the clipboard and shows transient feedback', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<QuizRoomInfoView setView={vi.fn()} roomId="ABC123" />);

    fireEvent.click(screen.getByText('コピー'));

    await vi.waitFor(() => expect(screen.getByText('コピーしました')).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('view=quiz-room&roomId=ABC123')
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('コピー')).toBeInTheDocument();
  });

  it('shows an alert when the clipboard write fails', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
    render(<QuizRoomInfoView setView={vi.fn()} roomId="ABC123" />);

    fireEvent.click(screen.getByText('コピー'));

    await vi.waitFor(() => expect(window.alert).toHaveBeenCalled());
  });
});
