import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useWakeLock } from "./useWakeLock";

describe("useWakeLock", () => {
  let originalWakeLock;

  beforeEach(() => {
    originalWakeLock = navigator.wakeLock;
  });

  afterEach(() => {
    if (originalWakeLock === undefined) {
      delete navigator.wakeLock;
    } else {
      Object.defineProperty(navigator, "wakeLock", { value: originalWakeLock, configurable: true });
    }
    vi.restoreAllMocks();
  });

  const mockSentinel = () => ({
    release: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
  });

  it("activeがfalseの場合はwakeLockをリクエストしない", () => {
    const request = vi.fn();
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });

    renderHook(() => useWakeLock(false));

    expect(request).not.toHaveBeenCalled();
  });

  it("Wake Lock API未対応の場合はエラーにならない", () => {
    delete navigator.wakeLock;

    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it("activeがtrueの場合はscreenのwakeLockをリクエストする", async () => {
    const sentinel = mockSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });

    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  });

  it("アンマウント時にsentinelをreleaseする", async () => {
    const sentinel = mockSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });

    const { unmount } = renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalled());

    unmount();

    expect(sentinel.release).toHaveBeenCalled();
  });

  it("可視状態に戻った際、sentinelが失われていれば再取得する", async () => {
    const sentinel = mockSentinel();
    const request = vi.fn().mockResolvedValue(sentinel);
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });

    renderHook(() => useWakeLock(true));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    // ブラウザがタブ非表示時に自動解放したケースを模して、releaseハンドラを呼ぶ
    const releaseHandler = sentinel.addEventListener.mock.calls.find(([event]) => event === "release")[1];
    releaseHandler();

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });
});
