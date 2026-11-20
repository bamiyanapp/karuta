import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeSetting } from './useThemeSetting';

function mockMatchMedia(initialDark) {
  let listener = null;
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: initialDark,
    addEventListener: (_event, fn) => { listener = fn; },
    removeEventListener: () => { listener = null; },
  }));
  return { fire: (matches) => listener?.({ matches }) };
}

describe('useThemeSetting', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-bs-theme');
  });

  it('follows the OS color scheme by default and reflects it on <html>', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useThemeSetting());
    expect(result.current.themeSetting).toBe('system');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('lets an explicit setting override the OS color scheme', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useThemeSetting());
    act(() => result.current.setThemeSetting('light'));
    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
  });

  it('updates in real time when the OS color scheme changes while following the system', () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useThemeSetting());
    expect(result.current.resolvedTheme).toBe('light');
    act(() => media.fire(true));
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('falls back to light when matchMedia is unavailable', () => {
    window.matchMedia = undefined;
    const { result } = renderHook(() => useThemeSetting());
    expect(result.current.resolvedTheme).toBe('light');
  });
});
