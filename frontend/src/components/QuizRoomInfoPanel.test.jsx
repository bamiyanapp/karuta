import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QuizRoomInfoPanel from './QuizRoomInfoPanel';

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

describe('QuizRoomInfoPanel', () => {
  it('is collapsed by default and shows nothing but the toggle link', () => {
    render(<QuizRoomInfoPanel roomId="ABC123" />);
    expect(screen.getByText('ルーム情報を表示（クイズ大会モード）')).toBeInTheDocument();
    expect(screen.queryByText('ルームコード')).not.toBeInTheDocument();
  });

  it('expands to show the room code, invite URL, and a QR code', async () => {
    render(<QuizRoomInfoPanel roomId="ABC123" />);

    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));

    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(await screen.findByAltText('参加用QRコード')).toBeInTheDocument();
    const urlInput = screen.getByDisplayValue(/roomId=ABC123/);
    expect(urlInput).toBeInTheDocument();

    fireEvent.click(screen.getByText('ルーム情報を隠す'));
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
  });

  it('copies the invite URL to the clipboard and shows transient feedback', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<QuizRoomInfoPanel roomId="ABC123" />);
    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));

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
    render(<QuizRoomInfoPanel roomId="ABC123" />);
    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));

    fireEvent.click(screen.getByText('コピー'));

    await vi.waitFor(() => expect(window.alert).toHaveBeenCalled());
  });
});
