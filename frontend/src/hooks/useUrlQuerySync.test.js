import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUrlQuerySync } from "./useUrlQuerySync";

describe("useUrlQuerySync", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  const setup = (props) => renderHook((p) => useUrlQuerySync(p), { initialProps: props });

  it("selectedCategories/division/detailPhraseId/viewをURLクエリに反映する", () => {
    setup({
      selectedCategories: ["Cat1", "Cat2"],
      division: "engineer",
      detailPhraseId: "p1",
      view: "all-phrases",
      setSelectedCategories: vi.fn(),
      setDivision: vi.fn(),
      setDetailPhraseId: vi.fn(),
      setView: vi.fn(),
    });

    const params = new URLSearchParams(window.location.search);
    expect(params.get("category")).toBe("Cat1,Cat2");
    expect(params.get("division")).toBe("engineer");
    expect(params.get("id")).toBe("p1");
    expect(params.get("view")).toBe("all-phrases");
  });

  it("view='game'など対象外の値や未選択の項目はURLパラメータに含めない", () => {
    setup({
      selectedCategories: [],
      division: null,
      detailPhraseId: null,
      view: "game",
      setSelectedCategories: vi.fn(),
      setDivision: vi.fn(),
      setDetailPhraseId: vi.fn(),
      setView: vi.fn(),
    });

    const params = new URLSearchParams(window.location.search);
    expect(params.has("view")).toBe(false);
    expect(params.has("category")).toBe(false);
    expect(params.has("division")).toBe(false);
    expect(params.has("id")).toBe(false);
  });

  it("popstateイベントでURLの内容をstateに反映する", () => {
    const setSelectedCategories = vi.fn();
    const setDivision = vi.fn();
    const setDetailPhraseId = vi.fn();
    const setView = vi.fn();

    setup({
      selectedCategories: [],
      division: null,
      detailPhraseId: null,
      view: "game",
      setSelectedCategories,
      setDivision,
      setDetailPhraseId,
      setView,
    });

    window.history.pushState({}, "", "?category=Cat1&division=kids&id=p1&view=comments");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(setSelectedCategories).toHaveBeenCalledWith(["Cat1"]);
    expect(setDivision).toHaveBeenCalledWith("kids");
    expect(setDetailPhraseId).toHaveBeenCalledWith("p1");
    expect(setView).toHaveBeenCalledWith("comments");
  });
});
