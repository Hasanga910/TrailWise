import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as discountsApi from '../../api/discounts';
import type { DiscountDto } from '../../api/discounts';
import { DiscountManager } from './DiscountManager';

const mockDiscounts: DiscountDto[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    description: 'Group discount (10+ people)',
    percentageOff: 10,
    minGroupSize: 10,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    description: 'Large group discount (15+ people)',
    percentageOff: 15,
    minGroupSize: 15,
    createdAt: '2026-09-02T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z',
  },
];

describe('DiscountManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders discounts from getDiscounts', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue(mockDiscounts);

    render(<DiscountManager />);

    expect(await screen.findByText('Group discount (10+ people)')).toBeInTheDocument();
    expect(screen.getByText('Large group discount (15+ people)')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
    expect(screen.getByText('15+')).toBeInTheDocument();
  });

  it('shows an empty state when there are no discounts', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue([]);

    render(<DiscountManager />);

    expect(await screen.findByText(/no discounts yet/i)).toBeInTheDocument();
  });

  it('shows an error banner when the list request fails', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockRejectedValue(new Error('network error'));

    render(<DiscountManager />);

    expect(await screen.findByText(/could not load discounts/i)).toBeInTheDocument();
  });

  it('submits the Add Discount form and reloads the list', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue(mockDiscounts);
    const createSpy = vi.spyOn(discountsApi, 'createDiscount').mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      description: 'New discount',
      percentageOff: 20,
      minGroupSize: 20,
      createdAt: '2026-09-03T00:00:00Z',
      updatedAt: '2026-09-03T00:00:00Z',
    });

    const user = userEvent.setup();
    render(<DiscountManager />);

    await screen.findByText('Group discount (10+ people)');

    await user.type(screen.getByLabelText(/description/i), 'New discount');
    await user.clear(screen.getByLabelText(/percentage off/i));
    await user.type(screen.getByLabelText(/percentage off/i), '20');
    await user.clear(screen.getByLabelText(/minimum group size/i));
    await user.type(screen.getByLabelText(/minimum group size/i), '20');

    await user.click(screen.getByRole('button', { name: /add discount/i }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith({
        description: 'New discount',
        percentageOff: 20,
        minGroupSize: 20,
      }),
    );
  });

  it('shows an error when creating a discount fails', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue([]);
    vi.spyOn(discountsApi, 'createDiscount').mockRejectedValue(new Error('validation error'));

    const user = userEvent.setup();
    render(<DiscountManager />);

    await screen.findByText(/no discounts yet/i);

    await user.type(screen.getByLabelText(/description/i), 'Bad discount');
    await user.clear(screen.getByLabelText(/percentage off/i));
    await user.type(screen.getByLabelText(/percentage off/i), '10');
    await user.click(screen.getByRole('button', { name: /add discount/i }));

    expect(await screen.findByText(/could not create discount/i)).toBeInTheDocument();
  });

  it('deletes a discount', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue(mockDiscounts);
    const deleteSpy = vi.spyOn(discountsApi, 'deleteDiscount').mockResolvedValue();

    const user = userEvent.setup();
    render(<DiscountManager />);

    await screen.findByText('Group discount (10+ people)');

    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i });
    await user.click(deleteButtons[0]);

    await waitFor(() =>
      expect(deleteSpy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111'),
    );
  });
});
