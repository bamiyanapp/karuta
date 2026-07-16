import { describe, it, expect, vi, beforeEach } from 'vitest';
import { unlockAudioPlayback, playSharedAudio, resetSharedAudioForTests } from './audioUnlock';

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
  it('unlockAudioPlayback creates a single shared <audio> element and plays a silent clip on it', () => {
    unlockAudioPlayback();

    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toMatch(/^data:audio\/wav/);
    expect(audioInstances[0].play).toHaveBeenCalled();
  });

  it('does not create a new element on repeated unlockAudioPlayback calls (issue #514: reuses the same element)', () => {
    unlockAudioPlayback();
    unlockAudioPlayback();

    expect(audioInstances).toHaveLength(1);
  });

  it('playSharedAudio reuses the element that was already unlocked, pausing it and swapping the src, instead of creating a new Audio (issue #514)', async () => {
    unlockAudioPlayback();
    const unlockedInstance = audioInstances[0];

    await playSharedAudio('data:audio/mp3;base64,DUMMY');

    expect(audioInstances).toHaveLength(1);
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

  it('resetSharedAudioForTests makes the next call create a fresh element, so tests do not leak state into each other', () => {
    unlockAudioPlayback();
    resetSharedAudioForTests();
    unlockAudioPlayback();

    expect(audioInstances).toHaveLength(2);
  });
});
