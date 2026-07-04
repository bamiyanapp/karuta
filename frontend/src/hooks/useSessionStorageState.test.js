import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStorageState } from "./useSessionStorageState";

describe("useSessionStorageState", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("未保存の場合はdefaultValueを返す", () => {
    const { result } = renderHook(() => useSessionStorageState("myKey", []));
    expect(result.current[0]).toEqual([]);
  });

  it("sessionStorageに保存済みのJSONがあればパースして返す", () => {
    sessionStorage.setItem("players", JSON.stringify(["たろう"]));
    const { result } = renderHook(() => useSessionStorageState("players", []));
    expect(result.current[0]).toEqual(["たろう"]);
  });

  it("壊れたJSONが保存されている場合はdefaultValueにフォールバックする", () => {
    sessionStorage.setItem("broken", "{not valid json");
    const { result } = renderHook(() => useSessionStorageState("broken", { fallback: true }));
    expect(result.current[0]).toEqual({ fallback: true });
  });

  it("値を更新するとsessionStorageにJSONとして永続化される", () => {
    const { result } = renderHook(() => useSessionStorageState("myKey", {}));

    act(() => {
      result.current[1]({ a: 1 });
    });

    expect(result.current[0]).toEqual({ a: 1 });
    expect(sessionStorage.getItem("myKey")).toBe(JSON.stringify({ a: 1 }));
  });
});
