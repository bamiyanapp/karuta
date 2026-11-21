import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useCategorySelection } from './useCategorySelection';

// 依存配列に使うため、描画のたびに新しい配列を渡さない
const CATEGORIES = [
  { name: 'A', count: 100, group: 'engineer' },
  { name: 'B', count: 300, group: 'engineer', requiresPossessionCheck: false },
  { name: 'C', count: 200, group: 'engineer', requiresPossessionCheck: true },
  { name: 'D', group: 'engineer' },
];

const setup = (props = {}) => {
  const fns = { setDivision: vi.fn(), setSelectedCategories: vi.fn(), setView: vi.fn() };
  const base = { division: 'engineer', categories: CATEGORIES, maxPrintCards: 500, ...fns, ...props };
  const hook = renderHook(() => useCategorySelection(base));
  return { ...hook, ...fns };
};

describe('useCategorySelection', () => {
  it('starts with an empty draft', () => {
    const { result } = setup();
    expect(result.current.draftCategories).toEqual([]);
    expect(result.current.draftCardCount).toBe(0);
  });

  it('toggles a category in and out of the draft and sums the card count, treating a missing count as 0', () => {
    const { result } = setup();
    act(() => result.current.toggleDraftCategory('A'));
    act(() => result.current.toggleDraftCategory('D'));
    expect(result.current.draftCategories).toEqual(['A', 'D']);
    expect(result.current.draftCardCount).toBe(100);
    act(() => result.current.toggleDraftCategory('A'));
    expect(result.current.draftCategories).toEqual(['D']);
  });

  it('blocks adding a category that would push the total over the print limit', () => {
    const { result } = setup();
    act(() => result.current.toggleDraftCategory('B'));
    act(() => result.current.toggleDraftCategory('C'));
    expect(result.current.draftCategories).toEqual(['B', 'C']);
    act(() => result.current.toggleDraftCategory('A'));
    expect(result.current.draftCategories).toEqual(['B', 'C']);
    expect(result.current.draftCardCount).toBe(500);
  });

  it('lists only the draft categories that need a possession check, defaulting an unset flag to required', () => {
    const { result } = setup();
    ['A', 'B', 'D'].forEach((c) => act(() => result.current.toggleDraftCategory(c)));
    expect(result.current.draftCategoriesRequiringPossessionCheck).toEqual(['A', 'D']);
  });

  it('goes straight to the game with one category for the kids division, without keeping a draft', () => {
    const { result, setSelectedCategories, setView } = setup({ division: 'kids' });
    act(() => result.current.toggleDraftCategory('A'));
    expect(setSelectedCategories).toHaveBeenCalledWith(['A']);
    expect(setView).toHaveBeenCalledWith('game');
    expect(result.current.draftCategories).toEqual([]);
  });

  it('decides the draft: selects it, clears it and opens the game', () => {
    const { result, setSelectedCategories, setView } = setup();
    act(() => result.current.toggleDraftCategory('A'));
    act(() => result.current.toggleDraftCategory('C'));
    act(() => result.current.handleDecideClick());
    expect(setSelectedCategories).toHaveBeenCalledWith(['A', 'C']);
    expect(setView).toHaveBeenCalledWith('game');
    expect(result.current.draftCategories).toEqual([]);
  });

  it('opens the print screen with the draft kept selected', () => {
    const { result, setSelectedCategories, setView } = setup();
    act(() => result.current.toggleDraftCategory('A'));
    act(() => result.current.handlePrintEfudaClick());
    expect(setSelectedCategories).toHaveBeenCalledWith(['A']);
    expect(setView).toHaveBeenCalledWith('print-efuda');
  });

  it('ignores the decide and print buttons while the draft is empty', () => {
    const { result, setSelectedCategories, setView } = setup();
    act(() => result.current.handleDecideClick());
    act(() => result.current.handlePrintEfudaClick());
    expect(setSelectedCategories).not.toHaveBeenCalled();
    expect(setView).not.toHaveBeenCalled();
  });

  it('clears the draft when the division changes, goes back, or is cleared explicitly', () => {
    const { result, setDivision } = setup();
    act(() => result.current.toggleDraftCategory('A'));
    act(() => result.current.selectDivision('kids'));
    expect(setDivision).toHaveBeenLastCalledWith('kids');
    expect(result.current.draftCategories).toEqual([]);
    act(() => result.current.toggleDraftCategory('A'));
    act(() => result.current.goBackToDivisionSelect());
    expect(setDivision).toHaveBeenLastCalledWith(null);
    expect(result.current.draftCategories).toEqual([]);
    act(() => result.current.toggleDraftCategory('A'));
    act(() => result.current.clearDraftCategories());
    expect(result.current.draftCategories).toEqual([]);
  });
});
