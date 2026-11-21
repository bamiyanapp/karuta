import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AllPhrasesView from './AllPhrasesView';

vi.mock('../components/ViewHeader', () => ({ default: () => null }));
vi.mock('../components/AppVersionInfo', () => ({ default: () => null }));

const PHRASES = [{ id: 'p1', category: 'あ', phrase: 'いぬ', kana: 'いぬ', answer: '犬', level: '1' }];

const renderView = (sortConfig) =>
  render(
    <AllPhrasesView
      allPhrases={PHRASES}
      filterCategory=""
      setFilterCategory={vi.fn()}
      filterDivision=""
      setFilterDivision={vi.fn()}
      searchQuery=""
      setSearchQuery={vi.fn()}
      uniqueCategories={['あ']}
      categoryCount={{ あ: 1 }}
      filteredPhrases={PHRASES}
      handleSort={vi.fn()}
      sortConfig={sortConfig}
      openDetail={vi.fn()}
      setView={vi.fn()}
      setSelectedCategories={vi.fn()}
      fetchError={false}
      onRetryFetch={vi.fn()}
    />
  );

describe('AllPhrasesView sort arrows', () => {
  it('shows the direction on the sorted column only, with the unsorted marker on the others', () => {
    renderView({ key: 'phrase', direction: 'asc' });
    const phrase = screen.getByRole('columnheader', { name: /読み札/ });
    expect(phrase).toHaveTextContent('読み札 ▲');
    expect(phrase).toHaveAttribute('aria-sort', 'ascending');
    const category = screen.getByRole('columnheader', { name: /カテゴリ/ });
    expect(category).toHaveTextContent('カテゴリ ⇅');
    expect(category).toHaveAttribute('aria-sort', 'none');
  });

  it('shows the descending marker for a descending sort', () => {
    renderView({ key: 'phrase', direction: 'desc' });
    const phrase = screen.getByRole('columnheader', { name: /読み札/ });
    expect(phrase).toHaveTextContent('読み札 ▼');
    expect(phrase).toHaveAttribute('aria-sort', 'descending');
  });
});
