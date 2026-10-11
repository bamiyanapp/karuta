import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CanaryStableToggleLink from "./CanaryStableToggleLink";

describe("CanaryStableToggleLink（issue #1499）", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("canary/stable以外のビルド（開発時等）では何も表示しない", () => {
    vi.stubEnv("MODE", "production");
    const { container } = render(<CanaryStableToggleLink />);
    expect(container).toBeEmptyDOMElement();
  });

  it("canaryビルドではstable版へのリンクを表示する", () => {
    vi.stubEnv("MODE", "canary");
    render(<CanaryStableToggleLink />);
    const link = screen.getByRole("link", { name: "stable版を見る" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/stable"));
  });

  it("stableビルドではcanary版へのリンクを表示する", () => {
    vi.stubEnv("MODE", "stable");
    render(<CanaryStableToggleLink />);
    const link = screen.getByRole("link", { name: "canary版を見る" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/canary"));
  });

  it("現在のクエリ文字列を維持したまま切り替え先へ遷移する", () => {
    vi.stubEnv("MODE", "canary");
    vi.stubGlobal("location", { ...window.location, search: "?category=foo" });
    render(<CanaryStableToggleLink />);
    const link = screen.getByRole("link", { name: "stable版を見る" });
    // issue #1540で判明した同根の不具合（末尾スラッシュ無しだとCloudFront
    // Functions側のindex.html自動補完が効かずエラーになる）を踏まえ、
    // /stable/の形を維持する
    expect(link).toHaveAttribute("href", "/stable/?category=foo");
  });
});
