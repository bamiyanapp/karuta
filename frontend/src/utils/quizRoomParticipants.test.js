import { describe, it, expect } from 'vitest';
import { mergeParticipantsWithPoints } from './quizRoomParticipants';

describe('mergeParticipantsWithPoints', () => {
  it('includes participants who have not scored yet as 0pt', () => {
    const result = mergeParticipantsWithPoints(['たろう', 'はなこ'], { たろう: 2 });
    expect(result).toEqual([
      { name: 'たろう', points: 2, attempts: 0, connected: true },
      { name: 'はなこ', points: 0, attempts: 0, connected: true },
    ]);
  });

  it('includes a scorer even if they are missing from the participant list (e.g. late-arriving broadcast)', () => {
    const result = mergeParticipantsWithPoints(['たろう'], { たろう: 1, じろう: 3 });
    expect(result).toEqual([
      { name: 'じろう', points: 3, attempts: 0, connected: false },
      { name: 'たろう', points: 1, attempts: 0, connected: true },
    ]);
  });

  it('keeps a participant visible with their earned points after they disconnect (points are never cleared by a participant-list update, issue #545), and marks them as not connected (issue #599/#602)', () => {
    // 切断イベント（disconnectQuizRoom）はparticipants一覧からのみ名前を外し、
    // ポイント（points）はjudgeQuizRoomBuzzでの加点時にしか変わらない。
    // そのため切断後のparticipants一覧に名前が無くても、pointsに記録が
    // 残っている限りは一覧に表示され続けるべきである
    const beforeDisconnect = mergeParticipantsWithPoints(['たろう', 'はなこ'], { たろう: 2 });
    expect(beforeDisconnect.map((p) => p.name)).toContain('たろう');

    // たろうが切断し、participants一覧からは消えたが、pointsはそのまま
    const afterDisconnect = mergeParticipantsWithPoints(['はなこ'], { たろう: 2 });
    expect(afterDisconnect).toEqual([
      { name: 'たろう', points: 2, attempts: 0, connected: false },
      { name: 'はなこ', points: 0, attempts: 0, connected: true },
    ]);
  });

  it('sorts by points descending, breaking ties by name ascending', () => {
    const result = mergeParticipantsWithPoints(['はなこ', 'たろう', 'じろう'], {});
    expect(result).toEqual([
      { name: 'じろう', points: 0, attempts: 0, connected: true },
      { name: 'たろう', points: 0, attempts: 0, connected: true },
      { name: 'はなこ', points: 0, attempts: 0, connected: true },
    ]);
  });

  it('returns an empty list when there are no participants and no scorers', () => {
    expect(mergeParticipantsWithPoints([], {})).toEqual([]);
  });

  // 回答数（issue #698）: answerCountsは名前→{attempts, correct}のマップ。
  // pointsと同じく切断・退室後も保持され続ける
  it('includes the attempt count (both correct and incorrect judgments) from answerCounts', () => {
    const result = mergeParticipantsWithPoints(
      ['たろう', 'はなこ'],
      { たろう: 2 },
      { たろう: { attempts: 3, correct: 2 }, はなこ: { attempts: 1, correct: 0 } }
    );
    expect(result).toEqual([
      { name: 'たろう', points: 2, attempts: 3, connected: true },
      { name: 'はなこ', points: 0, attempts: 1, connected: true },
    ]);
  });

  it('includes a participant who only has answerCounts (e.g. all attempts so far were incorrect, so points is still 0)', () => {
    const result = mergeParticipantsWithPoints(['たろう'], {}, { たろう: { attempts: 2, correct: 0 } });
    expect(result).toEqual([
      { name: 'たろう', points: 0, attempts: 2, connected: true },
    ]);
  });

  it('keeps the attempt count after a participant disconnects, same as points (issue #698)', () => {
    const afterDisconnect = mergeParticipantsWithPoints(
      ['はなこ'],
      { たろう: 2 },
      { たろう: { attempts: 3, correct: 2 } }
    );
    expect(afterDisconnect).toEqual([
      { name: 'たろう', points: 2, attempts: 3, connected: false },
      { name: 'はなこ', points: 0, attempts: 0, connected: true },
    ]);
  });

  it('defaults attempts to 0 when answerCounts is omitted entirely (backward compatibility)', () => {
    const result = mergeParticipantsWithPoints(['たろう'], { たろう: 1 });
    expect(result).toEqual([{ name: 'たろう', points: 1, attempts: 0, connected: true }]);
  });
});
