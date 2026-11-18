import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react';
import { NotificationProvider } from '../components/NotificationProvider';
import QuizRoomInfoView from './QuizRoomInfoView';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ShareUrlCardが通知（useNotify）を使うため、通知のProviderで包んで描画する（issue #2190）
const render = (ui) => rtlRender(ui, { wrapper: NotificationProvider });

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

  // issue #2242: window.confirmではなく、共有のConfirmDialog（ネイティブの<dialog>）で確認する
  it('calls resetQuizRoomPoints only after the admin confirms in the dialog (issue #615, #2242)', () => {
    const resetQuizRoomPoints = vi.fn();
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
    expect(screen.getByText('ポイントをリセットしますか？')).toBeInTheDocument();
    fireEvent.click(screen.getByText('キャンセル'));
    expect(resetQuizRoomPoints).not.toHaveBeenCalled();
    expect(screen.queryByText('ポイントをリセットしますか？')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('ポイントをリセット'));
    fireEvent.click(screen.getByText('リセットする'));
    expect(resetQuizRoomPoints).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('ポイントをリセットしますか？')).not.toBeInTheDocument();
  });

  it('calls closeQuizRoom only after the admin confirms in the dialog (issue #748, #2242)', () => {
    const closeQuizRoom = vi.fn();
    render(<QuizRoomInfoView setView={vi.fn()} roomId="ABC123" closeQuizRoom={closeQuizRoom} />);

    fireEvent.click(screen.getByRole('button', { name: 'ルームを閉じる' }));
    expect(screen.getByText('ルームを閉じますか？')).toBeInTheDocument();
    fireEvent.click(screen.getByText('キャンセル'));
    expect(closeQuizRoom).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'ルームを閉じる' }));
    fireEvent.click(screen.getByText('閉じて全員を切断する'));
    expect(closeQuizRoom).toHaveBeenCalledTimes(1);
  });

  it('does not use window.confirm, which would block WebSocket sync and audio playback (issue #2242)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<QuizRoomInfoView setView={vi.fn()} roomId="ABC123" closeQuizRoom={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'ルームを閉じる' }));

    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('lets the admin go back to the normal game screen', () => {
    const setView = vi.fn();
    render(<QuizRoomInfoView setView={setView} roomId="ABC123" />);

    fireEvent.click(screen.getByText('← 戻る'));

    expect(setView).toHaveBeenCalledWith('game');
  });

  // issue #1267: 「かるたを再開する」は、セッション復帰直後（selectedCategories未選択）に
  // 開設時のかるた種類を復元してから読み上げ画面へ遷移する専用ボタン。「← 戻る」（上のテスト）
  // とは異なり、遷移前にresumeReadingの完了を待つ
  it('resumes the reading screen via the "かるたを再開する" button, awaiting resumeReading before navigating', async () => {
    const setView = vi.fn();
    let resolveResume;
    const resumeReading = vi.fn(() => new Promise((resolve) => { resolveResume = resolve; }));
    render(<QuizRoomInfoView setView={setView} roomId="ABC123" resumeReading={resumeReading} />);

    fireEvent.click(screen.getByText('かるたを再開する'));

    expect(resumeReading).toHaveBeenCalledWith('ABC123');
    expect(screen.getByText('再開中...')).toBeInTheDocument();
    expect(setView).not.toHaveBeenCalled();

    await act(async () => {
      resolveResume();
    });

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

  it('shows an error notification (not alert()) when the clipboard write fails (issue #2190)', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));
    render(<QuizRoomInfoView setView={vi.fn()} roomId="ABC123" />);

    fireEvent.click(screen.getByText('コピー'));

    expect(await screen.findByRole('alert')).toHaveTextContent('URLのコピーに失敗しました');
  });
});
