import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AppVersionInfo from "./AppVersionInfo";

function stubFetch(responseBody) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseBody),
    })
  );
}

describe("AppVersionInfo（issue #1462）", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("canaryビルドではcanaryバッジを表示する", () => {
    vi.stubEnv("MODE", "canary");
    stubFetch(null);
    render(<AppVersionInfo />);
    expect(screen.getByText(/canary（試験公開中）/)).toBeInTheDocument();
  });

  it("stableビルドではstableバッジを表示する", () => {
    vi.stubEnv("MODE", "stable");
    stubFetch(null);
    render(<AppVersionInfo />);
    expect(screen.getByText("stable")).toBeInTheDocument();
  });

  it("canary/stable以外（ローカル開発等）ではバッジを表示しない", () => {
    vi.stubEnv("MODE", "production");
    stubFetch(null);
    render(<AppVersionInfo />);
    expect(screen.queryByText(/canary（試験公開中）/)).not.toBeInTheDocument();
    expect(screen.queryByText("stable")).not.toBeInTheDocument();
  });

  it("バックエンドのバージョンがフロントエンドと異なる場合、不一致を警告する", async () => {
    vi.stubEnv("MODE", "stable");
    stubFetch({ version: "0.0.1", stage: "stable" });
    render(<AppVersionInfo />);
    await waitFor(() =>
      expect(screen.getByText(/バックエンドのバージョン/)).toBeInTheDocument()
    );
  });

  it("バックエンドのバージョンがフロントエンドと一致する場合は警告しない", async () => {
    vi.stubEnv("MODE", "stable");
    stubFetch({ version: __APP_VERSION__, stage: "stable" });
    render(<AppVersionInfo />);
    await waitFor(() => {
      expect(screen.queryByText(/バックエンドのバージョン/)).not.toBeInTheDocument();
    });
  });

  it("setViewを渡すとchangelog viewへのリンクボタンになる", () => {
    vi.stubEnv("MODE", "stable");
    stubFetch(null);
    const setView = vi.fn();
    render(<AppVersionInfo setView={setView} />);
    screen.getByRole("button").click();
    expect(setView).toHaveBeenCalledWith("changelog");
  });
});
