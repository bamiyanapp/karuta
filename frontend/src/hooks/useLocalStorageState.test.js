import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useLocalStorageState } from "./useLocalStorageState";

describe("useLocalStorageState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未保存の場合はdefaultValueを返す", () => {
    const { result } = renderHook(() => useLocalStorageState("myKey", "default"));
    expect(result.current[0]).toBe("default");
  });

  it("localStorageに保存済みの値があればそれを返す（parseあり）", () => {
    localStorage.setItem("count", "5");
    const { result } = renderHook(() => useLocalStorageState("count", 2, (v) => parseInt(v, 10)));
    expect(result.current[0]).toBe(5);
  });

  it("値を更新するとlocalStorageに永続化される", () => {
    const { result } = renderHook(() => useLocalStorageState("myKey", "default"));

    act(() => {
      result.current[1]("updated");
    });

    expect(result.current[0]).toBe("updated");
    expect(localStorage.getItem("myKey")).toBe("updated");
  });

  it("数値・真偽値もformatを介さずlocalStorageに正しく文字列化される", () => {
    const { result } = renderHook(() => useLocalStorageState("flag", false, (v) => v === "true"));

    act(() => {
      result.current[1](true);
    });

    expect(localStorage.getItem("flag")).toBe("true");
    expect(result.current[0]).toBe(true);
  });
});
