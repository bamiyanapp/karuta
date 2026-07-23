import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unlockAudioPlayback, playSharedAudio, playQuizSfx, stopSharedAudio, resetSharedAudioForTests } from './audioUnlock';

const audioInstances = [];
let audioPlayImpl = () => Promise.resolve();

// App.test.jsxと同様の理由でアロー関数ではなく通常の関数式を使う（newで呼び出すため）
window.Audio = vi.fn().mockImplementation(function (src) {
  this.src = src;
  this.play = vi.fn(() => audioPlayImpl());
  this.pause = vi.fn();
  audioInstances.push(this);
});

beforeEach(() => {
  audioInstances.length = 0;
  audioPlayImpl = () => Promise.resolve();
  vi.clearAllMocks();
  resetSharedAudioForTests();
});

describe('audioUnlock', () => {
  it('unlockAudioPlayback creates the shared narration element plus one shared element per quiz sound effect, and plays a silent clip on each', () => {
    unlockAudioPlayback();

    // sharedAudio（読み上げ用）+ buzz/correct/incorrectの効果音用（issue #613）
    expect(audioInstances).toHaveLength(4);
    for (const instance of audioInstances) {
      expect(instance.src).toMatch(/^data:audio\/wav/);
      expect(instance.play).toHaveBeenCalled();
    }
  });

  it('does not create new elements on repeated unlockAudioPlayback calls (issue #514: reuses the same elements)', () => {
    unlockAudioPlayback();
    unlockAudioPlayback();

    expect(audioInstances).toHaveLength(4);
  });

  it('playSharedAudio reuses the element that was already unlocked, pausing it and swapping the src, instead of creating a new Audio (issue #514)', async () => {
    unlockAudioPlayback();
    const unlockedInstance = audioInstances[0];

    await playSharedAudio('data:audio/mp3;base64,DUMMY');

    expect(audioInstances).toHaveLength(4);
    expect(audioInstances[0]).toBe(unlockedInstance);
    expect(unlockedInstance.pause).toHaveBeenCalled();
    expect(unlockedInstance.src).toBe('data:audio/mp3;base64,DUMMY');
    expect(unlockedInstance.play).toHaveBeenCalled();
  });

  it('playSharedAudio lazily creates the shared element if unlockAudioPlayback was never called', async () => {
    await playSharedAudio('data:audio/mp3;base64,DUMMY');

    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toBe('data:audio/mp3;base64,DUMMY');
  });

  it('propagates a rejected play() (e.g. NotAllowedError) so callers can handle a still-blocked autoplay', async () => {
    audioPlayImpl = () => Promise.reject(new Error('NotAllowedError'));

    await expect(playSharedAudio('data:audio/mp3;base64,DUMMY')).rejects.toThrow('NotAllowedError');
  });

  it('resetSharedAudioForTests makes the next call create fresh elements, so tests do not leak state into each other', () => {
    unlockAudioPlayback();
    resetSharedAudioForTests();
    unlockAudioPlayback();

    expect(audioInstances).toHaveLength(8);
  });

  describe('stopSharedAudio (issue #696)', () => {
    it('pauses the shared narration element if it has already been created', async () => {
      await playSharedAudio('data:audio/mp3;base64,DUMMY');
      const instance = audioInstances[0];

      stopSharedAudio();

      expect(instance.pause).toHaveBeenCalledTimes(2); // playSharedAudio内の一時停止 + stopSharedAudio
    });

    it('does nothing if the shared narration element was never created', () => {
      expect(() => stopSharedAudio()).not.toThrow();
    });
  });

  describe('playQuizSfx (issue #613)', () => {
    it('reuses the element that was already unlocked for the given name, pausing it and swapping the src', async () => {
      unlockAudioPlayback();
      // unlockAudioPlayback内ではsharedAudio(narration)の直後にbuzz/correct/incorrectの
      // 順で生成されるため、audioInstances[1]が"buzz"の共有要素になる
      const unlockedBuzzInstance = audioInstances[1];

      await playQuizSfx('buzz', '/quiz-buzz.mp3');

      expect(audioInstances).toHaveLength(4);
      expect(audioInstances[1]).toBe(unlockedBuzzInstance);
      expect(unlockedBuzzInstance.src).toBe('/quiz-buzz.mp3');
    });

    it('lazily creates a shared element per name if unlockAudioPlayback was never called', async () => {
      await playQuizSfx('correct', '/quiz-correct.mp3');

      expect(audioInstances).toHaveLength(1);
      expect(audioInstances[0].src).toBe('/quiz-correct.mp3');
      expect(audioInstances[0].play).toHaveBeenCalled();
    });

    it('keeps buzz/correct/incorrect on separate elements so playing one does not touch another', async () => {
      await playQuizSfx('buzz', '/quiz-buzz.mp3');
      await playQuizSfx('correct', '/quiz-correct.mp3');

      // 名前ごとに別要素が作られ、互いのsrc/play呼び出し回数に影響しないこと
      expect(audioInstances).toHaveLength(2);
      expect(audioInstances[0].src).toBe('/quiz-buzz.mp3');
      expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
      expect(audioInstances[1].src).toBe('/quiz-correct.mp3');
      expect(audioInstances[1].play).toHaveBeenCalledTimes(1);
    });
  });
});
