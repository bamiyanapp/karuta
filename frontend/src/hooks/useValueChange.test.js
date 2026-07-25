import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useValueChange } from './useValueChange';

describe('useValueChange', () => {
  it('does not call onChange on the initial render', () => {
    const onChange = vi.fn();
    renderHook(() => useValueChange('a', onChange));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange with the new and previous values when the value changes between renders', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(({ value }) => useValueChange(value, onChange), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('b', 'a');
  });

  it('does not call onChange again on a re-render with the same value', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(({ value }) => useValueChange(value, onChange), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'a' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats null and other falsy values as valid, distinct values', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(({ value }) => useValueChange(value, onChange), {
      initialProps: { value: 'key-1' },
    });

    rerender({ value: null });

    expect(onChange).toHaveBeenCalledWith(null, 'key-1');
  });
});
