// issue #2187: エンドポイントごとの関数が、従来のURL・メソッド・ボディと同じ形で呼ぶことを確認する
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getCategories, getPhrasesList, getPhrase, getComments, postComment } from "./endpoints";
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
});
