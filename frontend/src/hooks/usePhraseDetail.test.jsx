import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const notify = vi.fn();
vi.mock('../components/NotificationProvider', () => ({ useNotify: () => notify }));
vi.mock('../api/endpoints', () => ({ getPhrase: vi.fn(), getComments: vi.fn(), postComment: vi.fn() }));

import { getPhrase, getComments, postComment } from '../api/endpoints';
import { usePhraseDetail } from './usePhraseDetail';

const PHRASE = { id: 'p1', category: 'あ', phrase: 'いぬ' };
const COMMENTS = [
  { id: 'c1', phraseId: 'p1', comment: 'one' },
  { id: 'c2', phraseId: 'p2', comment: 'two' },
];

const setup = (props = {}) => {
  const setDetailPhraseId = vi.fn();
  const base = {
    view: 'game',
    detailPhraseId: null,
    setDetailPhraseId,
    repeatCount: 2,
    speechRate: '80%',
    lang: 'ja',
    voiceId: 'Mizuki',
    isMultiCategorySelection: false,
    ...props,
  };
  const hook = renderHook(() => usePhraseDetail(base));
  return { ...hook, setDetailPhraseId };
};

describe('usePhraseDetail', () => {
  beforeEach(() => {
    notify.mockClear();
    getPhrase.mockReset();
    getComments.mockReset();
    postComment.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('fetches nothing while no detail is open and the view is not comments', () => {
    setup();
    expect(getPhrase).not.toHaveBeenCalled();
    expect(getComments).not.toHaveBeenCalled();
  });

  it('fetches the phrase and its comments when a detail is open, keeping only that phrase\'s comments', async () => {
    getPhrase.mockResolvedValue(PHRASE);
    getComments.mockResolvedValue({ comments: COMMENTS });
    const { result } = setup({ detailPhraseId: 'p1' });
    await waitFor(() => expect(result.current.detailPhrase).toEqual(PHRASE));
    await waitFor(() => expect(result.current.allComments).toHaveLength(2));
    expect(result.current.detailPhraseComments.map((c) => c.id)).toEqual(['c1']);
    // 詳細画面は、表示だけのため音声を取得せず、読み上げ設定も送らない。指摘は、その札だけをphraseIdで取得する（issue #2191）
    expect(getPhrase).toHaveBeenCalledWith({ id: 'p1', category: undefined, audio: false });
    expect(getComments).toHaveBeenCalledWith({ phraseId: 'p1' });
  });

  it('fetches the audio on demand with the current reading settings, and reuses it for the same settings (issue #2191)', async () => {
    getPhrase.mockResolvedValue(PHRASE);
    getComments.mockResolvedValue({ comments: [] });
    const { result } = setup({ detailPhraseId: 'p1' });
    await waitFor(() => expect(result.current.detailPhrase).toEqual(PHRASE));
    getPhrase.mockClear();
    getPhrase.mockResolvedValue({ ...PHRASE, audioData: 'data:audio/mp3;base64,AAA' });
    let audio;
    await act(async () => { audio = await result.current.loadDetailAudio(); });
    expect(audio).toBe('data:audio/mp3;base64,AAA');
    expect(getPhrase).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', repeatCount: 2, speechRate: '80%', lang: 'ja', voiceId: 'Mizuki', announceCategory: false }));
    expect(getPhrase.mock.calls[0][0]).not.toHaveProperty('audio');
    getPhrase.mockClear();
    await act(async () => { audio = await result.current.loadDetailAudio(); });
    expect(audio).toBe('data:audio/mp3;base64,AAA');
    expect(getPhrase).not.toHaveBeenCalled();
  });

  it('notifies and returns null when the on-demand audio fetch fails (issue #2191)', async () => {
    getPhrase.mockResolvedValue(PHRASE);
    getComments.mockResolvedValue({ comments: [] });
    const { result } = setup({ detailPhraseId: 'p1' });
    await waitFor(() => expect(result.current.detailPhrase).toEqual(PHRASE));
    getPhrase.mockRejectedValue(new Error('boom'));
    let audio;
    await act(async () => { audio = await result.current.loadDetailAudio(); });
    expect(audio).toBeNull();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(result.current.detailAudioLoading).toBe(false);
  });

  it('fetches the comments for the comments view without a detail', async () => {
    getComments.mockResolvedValue({ comments: COMMENTS });
    const { result } = setup({ view: 'comments' });
    await waitFor(() => expect(result.current.allComments).toHaveLength(2));
    expect(getPhrase).not.toHaveBeenCalled();
    // 指摘一覧画面は、全件を取得する
    expect(getComments).toHaveBeenCalledWith({});
  });

  it('flags the detail fetch error and recovers on retry (issue #2190)', async () => {
    getComments.mockResolvedValue({ comments: [] });
    getPhrase.mockRejectedValueOnce(new Error('boom'));
    const { result } = setup({ detailPhraseId: 'p1' });
    await waitFor(() => expect(result.current.detailFetchError).toBe(true));
    getPhrase.mockResolvedValue(PHRASE);
    act(() => result.current.retryFetchDetail());
    await waitFor(() => expect(result.current.detailPhrase).toEqual(PHRASE));
    expect(result.current.detailFetchError).toBe(false);
  });

  it('flags the comments fetch error and recovers on retry', async () => {
    getComments.mockRejectedValueOnce(new Error('boom'));
    const { result } = setup({ view: 'comments' });
    await waitFor(() => expect(result.current.commentsFetchError).toBe(true));
    getComments.mockResolvedValue({ comments: COMMENTS });
    act(() => result.current.retryFetchComments());
    await waitFor(() => expect(result.current.allComments).toHaveLength(2));
    expect(result.current.commentsFetchError).toBe(false);
  });

  it('opens and closes a detail through the setter passed in, remembering the category', () => {
    const { result, setDetailPhraseId } = setup();
    act(() => result.current.openDetail('p1', 'あ'));
    expect(setDetailPhraseId).toHaveBeenLastCalledWith('p1');
    expect(result.current.detailPhraseCategory).toBe('あ');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    act(() => result.current.closeDetail());
    expect(setDetailPhraseId).toHaveBeenLastCalledWith(null);
    expect(result.current.detailPhraseCategory).toBeNull();
  });

  it('posts a comment, notifies success and clears the text', async () => {
    getPhrase.mockResolvedValue(PHRASE);
    getComments.mockResolvedValue({ comments: [] });
    postComment.mockResolvedValue({});
    const { result } = setup({ detailPhraseId: 'p1' });
    await waitFor(() => expect(result.current.detailPhrase).toEqual(PHRASE));
    act(() => result.current.setCommentText('誤りです'));
    await act(async () => { await result.current.postComment({ preventDefault: () => {} }); });
    expect(postComment).toHaveBeenCalledWith({ phraseId: 'p1', category: 'あ', phrase: 'いぬ', comment: '誤りです' });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    expect(result.current.commentText).toBe('');
    expect(result.current.postingComment).toBe(false);
  });

  it('does not post an empty comment', async () => {
    const { result } = setup();
    await act(async () => { await result.current.postComment({ preventDefault: () => {} }); });
    expect(postComment).not.toHaveBeenCalled();
  });

  it('notifies an error and keeps the text when posting fails', async () => {
    getPhrase.mockResolvedValue(PHRASE);
    getComments.mockResolvedValue({ comments: [] });
    postComment.mockRejectedValue(new Error('boom'));
    const { result } = setup({ detailPhraseId: 'p1' });
    await waitFor(() => expect(result.current.detailPhrase).toEqual(PHRASE));
    act(() => result.current.setCommentText('誤りです'));
    await act(async () => { await result.current.postComment({ preventDefault: () => {} }); });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(result.current.commentText).toBe('誤りです');
    expect(result.current.postingComment).toBe(false);
  });
});
