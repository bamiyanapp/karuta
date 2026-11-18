// issue #2187: エンドポイントごとの関数が、従来のURL・メソッド・ボディと同じ形で呼ぶことを確認する
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCategories, getPhrasesList, getPhrase, getComments, postComment,
  getVersion, getCongratulationAudio, recordTime, getQuizRooms, getQuizRoom, createQuizRoom,
  generateEfudaPdf, getEfudaPdfStatus,
} from "./endpoints";
import { ApiError } from "./client";

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });

describe("api/endpoints", () => {
  beforeEach(() => {
    window.fetch = vi.fn();
  });

  const calledUrl = () => new URL(window.fetch.mock.calls[0][0]);

  it("getCategories: get-categoriesをGETで呼び、応答のJSONを返す", async () => {
    window.fetch.mockResolvedValue(okResponse({ categories: [{ name: "c1" }] }));

    await expect(getCategories()).resolves.toEqual({ categories: [{ name: "c1" }] });
    expect(calledUrl().pathname).toMatch(/\/get-categories$/);
    expect(window.fetch.mock.calls[0][1].method).toBe("GET");
  });

  it("getPhrasesList: カテゴリ指定あり・なしでクエリが変わる", async () => {
    window.fetch.mockResolvedValue(okResponse({ phrases: [] }));

    await getPhrasesList("犬 棒");
    expect(calledUrl().searchParams.get("category")).toBe("犬 棒");

    window.fetch.mockClear();
    await getPhrasesList();
    expect(calledUrl().search).toBe("");
  });

  it("getPhrase: パラメータを従来の並びで付け、undefinedの値は付けない", async () => {
    window.fetch.mockResolvedValue(okResponse({}));

    await getPhrase({ id: "p1", category: undefined, repeatCount: 2, speechRate: "80%", lang: "ja", voiceId: "Mizuki", announceCategory: false });

    const url = calledUrl();
    expect([...url.searchParams.keys()]).toEqual(["id", "repeatCount", "speechRate", "lang", "voiceId", "announceCategory"]);
    expect(url.searchParams.get("speechRate")).toBe("80%");
    expect(url.searchParams.get("announceCategory")).toBe("false");
  });

  it("getComments: get-commentsをGETで呼ぶ", async () => {
    window.fetch.mockResolvedValue(okResponse({ comments: [] }));

    await getComments();
    expect(calledUrl().pathname).toMatch(/\/get-comments$/);
  });

  it("postComment: post-commentへJSONをPOSTし、リトライしない（二重登録の防止）", async () => {
    window.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(postComment({ phraseId: "p1", comment: "誤り" })).rejects.toBeInstanceOf(ApiError);

    expect(window.fetch).toHaveBeenCalledTimes(1);
    const init = window.fetch.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ phraseId: "p1", comment: "誤り" });
  });

  it("HTTPエラーはApiError（kind: http・status付き）で投げる", async () => {
    window.fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

    await expect(getComments()).rejects.toMatchObject({ kind: "http", status: 404 });
  });

  it("getVersion・getQuizRooms: パラメータ無しでGETする", async () => {
    window.fetch.mockResolvedValue(okResponse({}));

    await getVersion();
    expect(calledUrl().pathname).toMatch(/\/get-version$/);
    window.fetch.mockClear();
    await getQuizRooms();
    expect(calledUrl().pathname).toMatch(/\/quiz-rooms$/);
    expect(calledUrl().search).toBe("");
  });

  it("getQuizRoom・getCongratulationAudio・getEfudaPdfStatus: クエリを従来の名前で付ける", async () => {
    window.fetch.mockResolvedValue(okResponse({}));

    await getQuizRoom("ROOM 1");
    expect(calledUrl().searchParams.get("roomId")).toBe("ROOM 1");

    window.fetch.mockClear();
    await getCongratulationAudio({ speechRate: "80%", lang: "ja", voiceId: "Mizuki" });
    expect([...calledUrl().searchParams.keys()]).toEqual(["speechRate", "lang", "voiceId"]);

    window.fetch.mockClear();
    await getEfudaPdfStatus({ jobId: "j1", categoryLabel: "犬棒", side: "front" });
    expect([...calledUrl().searchParams.keys()]).toEqual(["jobId", "categoryLabel", "side"]);
  });

  it("更新系（recordTime・createQuizRoom・generateEfudaPdf）は、JSONをPOSTし、リトライしない", async () => {
    window.fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    for (const call of [
      () => recordTime({ id: "p1", time: 3 }),
      () => createQuizRoom({ categories: ["c1"] }),
      () => generateEfudaPdf({ categoryParam: "c1", side: "front" }),
    ]) {
      window.fetch.mockClear();
      await expect(call()).rejects.toBeInstanceOf(ApiError);
      expect(window.fetch).toHaveBeenCalledTimes(1);
      expect(window.fetch.mock.calls[0][1].method).toBe("POST");
    }
  });

  describe("リトライの既定値（issue #2187）", () => {
    const serverError = { ok: false, status: 503, json: async () => ({}) };

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("GET（getComments）: 5xxは最大4回まで試し、途中で成功すれば結果を返す", async () => {
      window.fetch
        .mockResolvedValueOnce(serverError)
        .mockResolvedValueOnce(serverError)
        .mockResolvedValueOnce(okResponse({ comments: [] }));

      const promise = getComments();
      await vi.runAllTimersAsync();

      await expect(promise).resolves.toEqual({ comments: [] });
      expect(window.fetch).toHaveBeenCalledTimes(3);
    });

    it("GET（getComments）: 失敗が続くと4回で諦める", async () => {
      window.fetch.mockResolvedValue(serverError);

      const promise = getComments();
      const assertion = expect(promise).rejects.toBeInstanceOf(ApiError);
      await vi.runAllTimersAsync();

      await assertion;
      expect(window.fetch).toHaveBeenCalledTimes(4);
    });

    it("getCategories: コールドスタートの連続失敗に耐えるよう、最大5回まで試す", async () => {
      window.fetch.mockResolvedValue(serverError);

      const promise = getCategories();
      const assertion = expect(promise).rejects.toBeInstanceOf(ApiError);
      await vi.runAllTimersAsync();

      await assertion;
      expect(window.fetch).toHaveBeenCalledTimes(5);
    });

    it("getPhrase: リトライしない", async () => {
      window.fetch.mockResolvedValue(serverError);

      await expect(getPhrase({ id: 1 })).rejects.toBeInstanceOf(ApiError);
      expect(window.fetch).toHaveBeenCalledTimes(1);
    });

    it("POST（postComment）: 二重登録を避けるためリトライしない", async () => {
      window.fetch.mockResolvedValue(serverError);

      await expect(postComment({ text: "a" })).rejects.toBeInstanceOf(ApiError);
      expect(window.fetch).toHaveBeenCalledTimes(1);
    });

    it("4xx（404）は、GETでもリトライしない", async () => {
      window.fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });

      await expect(getComments()).rejects.toBeInstanceOf(ApiError);
      expect(window.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
