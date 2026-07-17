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

  it('shows the participant list as a table at the bottom of the screen, sorted by points descending, with a connection status column (issue #587, #599)', () => {
    render(
      <QuizRoomInfoView
        setView={vi.fn()}
        roomId="ABC123"
        quizRoomParticipants={['たろう', 'はなこ', 'じろう']}
        quizRoomPoints={{ たろう: 3 }}
      />
    );

    expect(screen.getByText('参加者一覧')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    // たろう(3pt)がまだ得点していないじろう・はなこ(0pt)より先（降順、同点は名前昇順）
    expect(rows).toEqual(['たろう接続中3pt', 'じろう接続中0pt', 'はなこ接続中0pt']);
  });

  it('shows a participant as disconnected when they are no longer in the connected-participants list, while keeping their earned points visible (issue #599, #602)', () => {
    render(
      <QuizRoomInfoView
        setView={vi.fn()}
        roomId="ABC123"
        quizRoomParticipants={['はなこ']}
        quizRoomPoints={{ たろう: 2 }}
      />
    );

    const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    expect(rows).toEqual(['たろう切断済み2pt', 'はなこ接続中0pt']);
  });

  it('does not show the participant list section when there are no participants yet', () => {
    render(<QuizRoomInfoView setView={vi.fn()} roomId="ABC123" />);
    expect(screen.queryByText('参加者一覧')).not.toBeInTheDocument();
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
