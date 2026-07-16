import { describe, it, expect } from 'vitest';
import { mergeParticipantsWithPoints } from './quizRoomParticipants';

describe('mergeParticipantsWithPoints', () => {
  it('includes participants who have not scored yet as 0pt', () => {
    const result = mergeParticipantsWithPoints(['たろう', 'はなこ'], { たろう: 2 });
    expect(result).toEqual([
      { name: 'たろう', points: 2 },
      { name: 'はなこ', points: 0 },
    ]);
  });

  it('includes a scorer even if they are missing from the participant list (e.g. late-arriving broadcast)', () => {
    const result = mergeParticipantsWithPoints(['たろう'], { たろう: 1, じろう: 3 });
    expect(result).toEqual([
      { name: 'じろう', points: 3 },
      { name: 'たろう', points: 1 },
    ]);
  });

  it('keeps a participant visible with their earned points after they disconnect (points are never cleared by a participant-list update, issue #545)', () => {
    // 切断イベント（disconnectQuizRoom）はparticipants一覧からのみ名前を外し、
    // ポイント（points）はjudgeQuizRoomBuzzでの加点時にしか変わらない。
    // そのため切断後のparticipants一覧に名前が無くても、pointsに記録が
    // 残っている限りは一覧に表示され続けるべきである
    const beforeDisconnect = mergeParticipantsWithPoints(['たろう', 'はなこ'], { たろう: 2 });
    expect(beforeDisconnect.map((p) => p.name)).toContain('たろう');

    // たろうが切断し、participants一覧からは消えたが、pointsはそのまま
    const afterDisconnect = mergeParticipantsWithPoints(['はなこ'], { たろう: 2 });
    expect(afterDisconnect).toEqual([
      { name: 'たろう', points: 2 },
      { name: 'はなこ', points: 0 },
    ]);
  });

  it('sorts by points descending, breaking ties by name ascending', () => {
    const result = mergeParticipantsWithPoints(['はなこ', 'たろう', 'じろう'], {});
    expect(result).toEqual([
      { name: 'じろう', points: 0 },
      { name: 'たろう', points: 0 },
      { name: 'はなこ', points: 0 },
    ]);
  });

  it('returns an empty list when there are no participants and no scorers', () => {
    expect(mergeParticipantsWithPoints([], {})).toEqual([]);
  });
});
