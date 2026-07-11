import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useVoiceAnswerRecognition } from "./useVoiceAnswerRecognition";

class FakeMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.state = "inactive";
    this.mimeType = "audio/webm";
    this.ondataavailable = null;
    this.onstop = null;
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["fake-audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}
FakeMediaRecorder.instances = [];

function fakeStream() {
  return { getTracks: () => [{ stop: vi.fn() }] };
}

describe("useVoiceAnswerRecognition", () => {
  let originalMediaRecorder;
  let originalMediaDevices;
  let getUserMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeMediaRecorder.instances = [];
    originalMediaRecorder = window.MediaRecorder;
    originalMediaDevices = navigator.mediaDevices;
    window.MediaRecorder = FakeMediaRecorder;
    getUserMedia = vi.fn().mockResolvedValue(fakeStream());
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    window.fetch = vi.fn();
  });

  afterEach(() => {
    window.MediaRecorder = originalMediaRecorder;
    Object.defineProperty(navigator, "mediaDevices", { value: originalMediaDevices, configurable: true });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const baseProps = {
    listening: true,
    phraseId: "p1",
    category: "c1",
    apiBaseUrl: "https://api.example.com",
    lang: "ja",
  };

  it("listeningがfalseの場合は録音を開始しない", () => {
    renderHook(() => useVoiceAnswerRecognition({ ...baseProps, listening: false, onResult: vi.fn() }));
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("MediaRecorder未対応の場合はunsupportedを返し録音しない", () => {
    window.MediaRecorder = undefined;
    const { result } = renderHook(() => useVoiceAnswerRecognition({ ...baseProps, onResult: vi.fn() }));
    expect(result.current.status).toBe("unsupported");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("録音→アップロード→ポーリングを経て正解判定をonResultへ渡す", async () => {
    window.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobName: "job1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "IN_PROGRESS" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "COMPLETED", isCorrect: true, transcript: "てんぐ" }) });

    const onResult = vi.fn();
    renderHook(() => useVoiceAnswerRecognition({ ...baseProps, onResult }));

    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    await vi.waitFor(() => expect(FakeMediaRecorder.instances.length).toBe(1));

    // MAX_RECORDING_MS経過で自動的に録音を止める
    await vi.advanceTimersByTimeAsync(8000);
    await vi.waitFor(() => expect(window.fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/start-speech-recognition",
      expect.objectContaining({ method: "POST" })
    ));

    // ポーリング間隔分進めてIN_PROGRESS→COMPLETEDへ
    await vi.advanceTimersByTimeAsync(1500);
    await vi.waitFor(() => expect(window.fetch).toHaveBeenCalledTimes(2));
    await vi.advanceTimersByTimeAsync(1500);
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith({ isCorrect: true, transcript: "てんぐ" }));
  });

  it("FAILEDが返った場合はerrorとしてonResultへ渡す", async () => {
    window.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobName: "job1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "FAILED", message: "boom" }) });

    const onResult = vi.fn();
    renderHook(() => useVoiceAnswerRecognition({ ...baseProps, onResult }));

    await vi.waitFor(() => expect(FakeMediaRecorder.instances.length).toBe(1));
    await vi.advanceTimersByTimeAsync(8000);
    await vi.advanceTimersByTimeAsync(1500);

    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith({ error: "boom" }));
  });

  it("getUserMediaが拒否された場合はerrorとしてonResultへ渡す", async () => {
    getUserMedia.mockRejectedValue(new Error("Permission denied"));
    const onResult = vi.fn();
    renderHook(() => useVoiceAnswerRecognition({ ...baseProps, onResult }));

    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith({ error: "Permission denied" }));
  });

  it("アンマウント時に録音中のストリームを停止する", async () => {
    const stopTrack = vi.fn();
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });

    const { unmount } = renderHook(() => useVoiceAnswerRecognition({ ...baseProps, onResult: vi.fn() }));
    await vi.waitFor(() => expect(FakeMediaRecorder.instances.length).toBe(1));

    unmount();

    expect(stopTrack).toHaveBeenCalled();
  });
});
