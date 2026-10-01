import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as discountsApi from '../../api/discounts';
import type { DiscountDto } from '../../api/discounts';
import { DiscountManager, getDerivedStatus } from './DiscountManager';

const mockDiscounts: DiscountDto[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    description: 'Active Standard Discount',
    percentageOff: 10,
    minGroupSize: 5,
    isActive: true,
    validFrom: null,
    validUntil: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    description: 'Inactive Discount',
    percentageOff: 15,
    minGroupSize: 10,
    isActive: false,
    validFrom: null,
    validUntil: null,
    createdAt: '2026-09-02T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    description: 'Upcoming Promo Discount',
    percentageOff: 20,
    minGroupSize: 8,
    isActive: true,
    validFrom: '2026-11-01T00:00:00Z',
    validUntil: '2026-11-30T23:59:59Z',
    createdAt: '2026-09-03T00:00:00Z',
    updatedAt: '2026-09-03T00:00:00Z',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    description: 'Expired Summer Discount',
    percentageOff: 25,
    minGroupSize: 4,
    isActive: true,
    validFrom: '2026-06-01T00:00:00Z',
    validUntil: '2026-08-31T23:59:59Z',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  },
];

describe('DiscountManager Component and Derived Status', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1, 2, 3: form has IsActive, ValidFrom, ValidUntil
  it('1, 2, 3: form has IsActive, ValidFrom, and ValidUntil inputs', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue([]);

    render(<DiscountManager />);

    expect(await screen.findByLabelText(/is active/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/valid from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/valid until/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/is active/i)).toBeChecked(); // defaults to true
  });

  // 4. invalid date range rejected
  it('4. invalid date range (ValidUntil < ValidFrom) is rejected client-side', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue([]);
    const createSpy = vi.spyOn(discountsApi, 'createDiscount');

    const user = userEvent.setup();
    render(<DiscountManager />);

    await screen.findByText(/no discounts yet/i);

    await user.type(screen.getByLabelText(/description/i), 'Bad Date Discount');
    await user.clear(screen.getByLabelText(/percentage off/i));
    await user.type(screen.getByLabelText(/percentage off/i), '10');
    await user.clear(screen.getByLabelText(/minimum group size/i));
    await user.type(screen.getByLabelText(/minimum group size/i), '5');

    await user.type(screen.getByLabelText(/valid from/i), '2026-10-15T10:00');
    await user.type(screen.getByLabelText(/valid until/i), '2026-10-10T10:00');

    await user.click(screen.getByRole('button', { name: /add discount/i }));

    expect(await screen.findByText(/valid until must be after or equal to valid from/i)).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  // 5, 6, 7, 8: Derived status rules (Active, Inactive, Upcoming, Expired)
  it('5, 6, 7, 8: derived status logic correctly computes Active, Inactive, Upcoming, Expired', () => {
    const fixedNow = new Date('2026-10-01T12:00:00Z');

    // 5. Active
    expect(
      getDerivedStatus(
        { isActive: true, validFrom: null, validUntil: null },
        fixedNow,
      ),
    ).toBe('Active');

    expect(
      getDerivedStatus(
        {
          isActive: true,
          validFrom: '2026-09-01T00:00:00Z',
          validUntil: '2026-10-15T00:00:00Z',
        },
        fixedNow,
      ),
    ).toBe('Active');

    // 6. Inactive
    expect(
      getDerivedStatus(
        {
          isActive: false,
          validFrom: '2026-09-01T00:00:00Z',
          validUntil: '2026-10-15T00:00:00Z',
        },
        fixedNow,
      ),
    ).toBe('Inactive');

    // 7. Upcoming
    expect(
      getDerivedStatus(
        {
          isActive: true,
          validFrom: '2026-10-05T00:00:00Z',
          validUntil: '2026-10-15T00:00:00Z',
        },
        fixedNow,
      ),
    ).toBe('Upcoming');

    // 8. Expired
    expect(
      getDerivedStatus(
        {
          isActive: true,
          validFrom: '2026-08-01T00:00:00Z',
          validUntil: '2026-09-30T00:00:00Z',
        },
        fixedNow,
      ),
    ).toBe('Expired');
  });

  it('renders status badges in the discounts table', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue(mockDiscounts);

    render(<DiscountManager />);

    expect(await screen.findByText('Active Standard Discount')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  // 9. toggle calls backend
  it('9. toggle active calls toggleDiscountActive on backend and reloads', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue(mockDiscounts);
    const toggleSpy = vi.spyOn(discountsApi, 'toggleDiscountActive').mockResolvedValue({
      ...mockDiscounts[0],
      isActive: false,
    });

    const user = userEvent.setup();
    render(<DiscountManager />);

    expect(await screen.findByText('Active Standard Discount')).toBeInTheDocument();

    const deactivateButtons = screen.getAllByRole('button', { name: /^deactivate$/i });
    await user.click(deactivateButtons[0]);

    await waitFor(() =>
      expect(toggleSpy).toHaveBeenCalledWith(mockDiscounts[0].id, false),
    );
  });

  // 10. edit works
  it('10. editing a discount populates form and sends updateDiscount', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue(mockDiscounts);
    const updateSpy = vi.spyOn(discountsApi, 'updateDiscount').mockResolvedValue({
      ...mockDiscounts[0],
      description: 'Updated Description',
      percentageOff: 12,
    });

    const user = userEvent.setup();
    render(<DiscountManager />);

    expect(await screen.findByText('Active Standard Discount')).toBeInTheDocument();

    const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
    await user.click(editButtons[0]);

    expect(screen.getByText('Edit discount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();

    const descInput = screen.getByLabelText(/description/i);
    await user.clear(descInput);
    await user.type(descInput, 'Updated Description');

    const pctInput = screen.getByLabelText(/percentage off/i);
    await user.clear(pctInput);
    await user.type(pctInput, '12');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith(
        mockDiscounts[0].id,
        expect.objectContaining({
          description: 'Updated Description',
          percentageOff: 12,
          minGroupSize: 5,
          isActive: true,
        }),
      ),
    );
  });

  // 11. delete still works
  it('11. delete discount calls deleteDiscount and reloads', async () => {
    vi.spyOn(discountsApi, 'getDiscounts').mockResolvedValue(mockDiscounts);
    const deleteSpy = vi.spyOn(discountsApi, 'deleteDiscount').mockResolvedValue();

    const user = userEvent.setup();
    render(<DiscountManager />);

    expect(await screen.findByText('Active Standard Discount')).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i });
    await user.click(deleteButtons[0]);

    await waitFor(() =>
      expect(deleteSpy).toHaveBeenCalledWith(mockDiscounts[0].id),
    );
  });
});
