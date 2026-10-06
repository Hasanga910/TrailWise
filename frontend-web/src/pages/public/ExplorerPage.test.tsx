import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPackageFacets, getPackages, type PackageFacets, type TourPackage } from '../../api/packages';
import { ExplorerPage } from './ExplorerPage';

vi.mock('../../api/packages', () => ({
  getPackages: vi.fn(),
  getPackageFacets: vi.fn(),
}));

const mockedGetPackages = vi.mocked(getPackages);
const mockedGetFacets = vi.mocked(getPackageFacets);

const FACETS: PackageFacets = { themes: ['Beach', 'Culture'], minPrice: 80, maxPrice: 300, minDays: 2, maxDays: 7, maxGroupSize: 20 };

function pkg(id: string, name: string, extra: Partial<TourPackage> = {}): TourPackage {
  return {
    id,
    name,
    theme: 'Culture',
    durationDays: 3,
    basePricePerPerson: 100,
    maxGroupSize: 10,
    photoUrl: null,
    tiers: [{ id: `${id}-t`, classType: 'Normal', includesFood: false, basePricePerPerson: 100, requiresAC: false }],
    locations: [{ id: `${id}-l`, name: 'Kandy', latitude: 7.29, longitude: 80.63 }],
    averageRating: 4.5,
    reviewCount: 12,
    startingPrice: 100,
    ...extra,
  };
}

const TWO = [pkg('1', 'Hill Country Escape'), pkg('2', 'Southern Coast', { theme: 'Beach', startingPrice: 150 })];

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="url">{location.search}</output>;
}

function renderExplorer(path = '/explore') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ExplorerPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const lastQuery = () => mockedGetPackages.mock.calls.at(-1)![0];

describe('ExplorerPage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockedGetPackages.mockReset();
    mockedGetFacets.mockReset();
    mockedGetPackages.mockResolvedValue(TWO);
    mockedGetFacets.mockResolvedValue(FACETS);
  });

  it('lists tours with a result count, links and prices', async () => {
    renderExplorer();

    expect(await screen.findByRole('link', { name: 'Hill Country Escape' })).toHaveAttribute('href', '/explore/1');
    expect(screen.getByRole('link', { name: 'Southern Coast' })).toHaveAttribute('href', '/explore/2');
    expect(screen.getByText('2 tours found')).toBeInTheDocument();
    expect(screen.getByText('$150')).toBeInTheDocument();
    expect(mockedGetPackages).toHaveBeenCalledWith({}, expect.any(AbortSignal));
  });

  it('carries the home search date and traveler count to each tour link and lets the date be removed', async () => {
    const user = userEvent.setup();
    renderExplorer('/explore?guests=4&start=2030-02-03');

    expect(await screen.findByRole('link', { name: 'Hill Country Escape' })).toHaveAttribute('href', '/explore/1?guests=4&start=2030-02-03');
    expect(screen.getByText(/starting feb 3, 2030/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove start date' }));
    expect(screen.getByRole('link', { name: 'Hill Country Escape' })).toHaveAttribute('href', '/explore/1?guests=4');
  });

  it('applies filters from the URL on first load', async () => {
    renderExplorer('/explore?theme=Beach&minPrice=100&maxPrice=50&guests=4&sort=price&dir=desc');

    await screen.findByText('2 tours found');
    // maxPrice < minPrice is swapped instead of sending a request the API would reject
    expect(lastQuery()).toEqual({ theme: 'Beach', minPrice: 50, maxPrice: 100, guests: 4, sort: 'price', dir: 'desc' });
  });

  it('searches after the user stops typing and keeps the term in the URL', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await screen.findByText('2 tours found');

    await user.type(screen.getByRole('searchbox', { name: 'Search tours' }), 'galle');

    expect(screen.getByTestId('url')).toHaveTextContent('?q=galle');
    await waitFor(() => expect(lastQuery()).toEqual({ q: 'galle' }));
  });

  it('filters by theme chip, class and sort order', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await screen.findByText('2 tours found');

    const sidebar = within(screen.getByRole('complementary', { name: 'Filters' }));
    await user.click(await sidebar.findByRole('button', { name: 'Beach' }));
    await user.selectOptions(sidebar.getByLabelText('Class'), 'First');
    await user.selectOptions(sidebar.getByLabelText('Sort by'), 'price:asc');

    await waitFor(() => expect(lastQuery()).toEqual({ theme: 'Beach', classType: 'First', sort: 'price', dir: 'asc' }));
    expect(sidebar.getByRole('button', { name: 'Beach' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an empty state and clears filters', async () => {
    const user = userEvent.setup();
    mockedGetPackages.mockResolvedValue([]);
    renderExplorer('/explore?theme=Beach');

    expect(await screen.findByText('No tours match your filters')).toBeInTheDocument();
    mockedGetPackages.mockResolvedValue(TWO);
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('2 tours found')).toBeInTheDocument();
    expect(screen.getByTestId('url')).not.toHaveTextContent('theme');
    expect(lastQuery()).toEqual({});
  });

  it('switches between grid and list and remembers the choice', async () => {
    const user = userEvent.setup();
    const { unmount } = renderExplorer();
    await screen.findByText('2 tours found');
    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'List view' }));
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('trailwise_explorer_view')).toBe('list');
    unmount();

    renderExplorer();
    await screen.findByText('2 tours found');
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an error with retry when loading fails', async () => {
    const user = userEvent.setup();
    mockedGetPackages.mockRejectedValueOnce(new Error('network'));
    renderExplorer();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load tours/i);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('2 tours found')).toBeInTheDocument();
  });

  it('still works when the facets request fails', async () => {
    mockedGetFacets.mockRejectedValue(new Error('nope'));
    renderExplorer();

    expect(await screen.findByText('2 tours found')).toBeInTheDocument();
  });
});
