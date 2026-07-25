import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuizRoomParticipantTable from './QuizRoomParticipantTable';

// issue #800: 管理者側（QuizRoomInfoView.jsx）・参加者側（QuizRoomView.jsx）に
// 重複していた参加者一覧テーブルのテストを、この共通コンポーネントのテストへ統合した

describe('QuizRoomParticipantTable', () => {
  it('renders nothing when there are no participants', () => {
    const { container } = render(
      <QuizRoomParticipantTable participantNames={[]} points={{}} answerCounts={{}} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('参加者一覧')).not.toBeInTheDocument();
  });

  it('shows the participant list as a table, sorted by points descending (0pt participants included, ties broken by name) (issue #545, #587, #599)', () => {
    render(
      <QuizRoomParticipantTable
        participantNames={['たろう', 'はなこ', 'じろう']}
        points={{ たろう: 3 }}
        answerCounts={{}}
      />
    );

    expect(screen.getByText('参加者一覧')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    // たろう(3pt)がまだ得点していないじろう・はなこ(0pt)より先（降順、同点は名前昇順）
    expect(rows).toEqual(['たろう接続中03', 'じろう接続中00', 'はなこ接続中00']);
  });

  it('shows a participant as disconnected once they leave the connected-participants list, while keeping their earned points visible (issue #599, #602)', () => {
    render(
      <QuizRoomParticipantTable
        participantNames={['はなこ']}
        points={{ たろう: 2 }}
        answerCounts={{}}
      />
    );

    const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    expect(rows).toEqual(['たろう切断済み02', 'はなこ接続中00']);
  });

  it('shows the attempt count (回答数) and correct count (正答数) as separate columns, keeping them after a participant disconnects (issue #698)', () => {
    render(
      <QuizRoomParticipantTable
        participantNames={['はなこ']}
        points={{ たろう: 2 }}
        answerCounts={{ たろう: { attempts: 3, correct: 2 }, はなこ: { attempts: 1, correct: 0 } }}
      />
    );

    expect(screen.getByText('回答数')).toBeInTheDocument();
    expect(screen.getByText('正答数')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    expect(rows).toEqual(['たろう切断済み32', 'はなこ接続中10']);
  });

  it('bolds the row matching highlightName (the participant\'s own name), leaving others unstyled (issue #545)', () => {
    render(
      <QuizRoomParticipantTable
        participantNames={['たろう', 'はなこ']}
        points={{}}
        answerCounts={{}}
        highlightName="はなこ"
      />
    );

    expect(screen.getByText('はなこ', { selector: 'td.fw-bold' })).toBeInTheDocument();
    expect(screen.getByText('たろう').className).not.toContain('fw-bold');
  });

  it('does not bold any row when highlightName is not provided (admin usage)', () => {
    render(
      <QuizRoomParticipantTable
        participantNames={['たろう']}
        points={{}}
        answerCounts={{}}
      />
    );

    expect(screen.getByText('たろう').className).not.toContain('fw-bold');
  });

  it('renders the optional footer below the table (e.g. the admin\'s "ポイントをリセット" button)', () => {
    render(
      <QuizRoomParticipantTable
        participantNames={['たろう']}
        points={{}}
        answerCounts={{}}
        footer={<button onClick={vi.fn()}>ポイントをリセット</button>}
      />
    );

    expect(screen.getByText('ポイントをリセット')).toBeInTheDocument();
  });
});
