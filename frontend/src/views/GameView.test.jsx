import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GameView from './GameView';

// 設定・クイズ大会の各パネルと結果カードは、それぞれの単体テストで検証済みのため、ここでは目印だけを出す
vi.mock('../components/SettingsFooter', () => ({ default: () => <div data-testid="settings-footer" /> }));
vi.mock('../components/QuizRoomActionsPanel', () => ({ default: () => <div data-testid="quiz-room-actions" /> }));
vi.mock('../components/AppVersionInfo', () => ({ default: () => null }));
vi.mock('../components/StableSwitchLink', () => ({ default: () => null }));
vi.mock('../components/ResultCard', () => ({ default: () => <div data-testid="result-card" /> }));
vi.mock('../components/QuizCompletionScreen', () => ({
  default: ({ restartCategory }) => <button onClick={restartCategory}>completion</button>,
}));

const PHRASE = { id: 'p1', category: 'あ', phrase: 'いぬも歩けば', kana: 'い', level: '2' };

const baseProps = () => ({
  division: 'engineer',
  repeatPhrase: vi.fn(),
  isAllRead: false,
  sessionSummary: null,
  scoreSummary: null,
  restartCategory: vi.fn(),
  isFadingOut: false,
  displayContent: { type: 'initial' },
  players: [],
  recordTaken: vi.fn(),
  currentRoundTakenBy: null,
  playKaruta: vi.fn(),
  loading: false,
  isReadingLastPhrase: false,
  isReading: false,
  currentPhrase: null,
  stopReading: vi.fn(),
  categoryLabel: 'テスト種別',
  allPhrasesForCategory: [],
  currentHistory: [],
  showHistory: false,
  setShowHistory: vi.fn(),
  openDetail: vi.fn(),
  setView: vi.fn(),
  resetGame: vi.fn(),
});

describe('GameView', () => {
  it('shows the category label and the ready screen before the first phrase', () => {
    render(<GameView {...baseProps()} />);
    expect(screen.getByRole('heading', { name: 'テスト種別' })).toBeInTheDocument();
    expect(screen.getByText('準備完了')).toBeInTheDocument();
    expect(screen.getByTestId('settings-footer')).toBeInTheDocument();
    expect(screen.getByTestId('quiz-room-actions')).toBeInTheDocument();
  });

  it('shows the read progress when the category has phrases', () => {
    render(<GameView {...baseProps()} allPhrasesForCategory={[PHRASE, PHRASE, PHRASE, PHRASE]} currentHistory={[PHRASE]} />);
    expect(screen.getByText('読み上げ済み 1 / 全4枚')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '読み上げ進捗' })).toHaveAttribute('aria-valuenow', '1');
  });

  it('shows the phrase card with its level, and repeats it when clicked', () => {
    const props = baseProps();
    render(<GameView {...props} displayContent={{ type: 'phrase', content: PHRASE }} currentPhrase={PHRASE} />);
    expect(screen.getByText('いぬも歩けば')).toBeInTheDocument();
    expect(screen.getByText('レベル: 2')).toBeInTheDocument();
    // 「もう一度」は、読み札カード（aria-label）と操作ボタンの2つがある。どちらでも再生を起動する
    const [card, button] = screen.getAllByRole('button', { name: 'もう一度' });
    fireEvent.click(card);
    fireEvent.click(button);
    expect(props.repeatPhrase).toHaveBeenCalledTimes(2);
  });

  it('shows the result card for a result display', () => {
    render(<GameView {...baseProps()} displayContent={{ type: 'result', content: {} }} />);
    expect(screen.getByTestId('result-card')).toBeInTheDocument();
  });

  it('wires the next / repeat / stop buttons, disabling them by the reading state', () => {
    const props = baseProps();
    const { rerender } = render(<GameView {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '次の札' }));
    expect(props.playKaruta).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '停止' })).toBeDisabled();
    rerender(<GameView {...props} isReading currentPhrase={PHRASE} loading />);
    expect(screen.getByRole('button', { name: '読み込み中...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '停止' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '停止' }));
    expect(props.stopReading).toHaveBeenCalled();
  });

  it('shows the completion screen instead of the controls once everything is read', () => {
    const props = baseProps();
    render(<GameView {...props} isAllRead />);
    expect(screen.queryByRole('button', { name: '次の札' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'completion' }));
    expect(props.restartCategory).toHaveBeenCalled();
  });

  it('shows the player buttons only for the engineer division while a phrase is shown, and records who took it', () => {
    const props = baseProps();
    const content = { displayContent: { type: 'phrase', content: PHRASE }, currentPhrase: PHRASE, players: ['たろう', 'はなこ'] };
    const { rerender } = render(<GameView {...props} {...content} />);
    fireEvent.click(screen.getByRole('button', { name: 'はなこ' }));
    expect(props.recordTaken).toHaveBeenCalledWith('はなこ');
    rerender(<GameView {...props} {...content} division="kids" />);
    expect(screen.queryByRole('button', { name: 'はなこ' })).not.toBeInTheDocument();
  });

  it('toggles the history and opens a phrase detail from it', () => {
    const props = baseProps();
    const history = [{ ...PHRASE, winner: 'たろう', elapsedTime: '1.5' }];
    const { rerender } = render(<GameView {...props} currentHistory={history} />);
    fireEvent.click(screen.getByRole('button', { name: /これまでに読み上げた札を表示する（1枚）/ }));
    expect(props.setShowHistory).toHaveBeenCalled();
    rerender(<GameView {...props} currentHistory={history} showHistory />);
    expect(screen.getByText('🎉 たろうさん正解')).toBeInTheDocument();
    expect(screen.getByText('1.5秒')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /いぬも歩けば/ }));
    expect(props.openDetail).toHaveBeenCalledWith('p1', 'あ');
  });

  it('offers the print button only for the kids division, and re-selects the karuta from the footer', () => {
    const props = baseProps();
    const { rerender } = render(<GameView {...props} />);
    expect(screen.queryByRole('button', { name: '絵札を印刷する' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'かるたの種類を選び直す' }));
    expect(props.resetGame).toHaveBeenCalled();
    rerender(<GameView {...props} division="kids" />);
    fireEvent.click(screen.getByRole('button', { name: '絵札を印刷する' }));
    expect(props.setView).toHaveBeenCalledWith('print-efuda');
  });
});
