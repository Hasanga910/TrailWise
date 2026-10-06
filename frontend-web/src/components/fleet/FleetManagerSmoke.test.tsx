import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vehiclesApi from '../../api/vehicles';
import * as bookingsApi from '../../api/bookings';
import * as guidesApi from '../../api/guides';
import { FleetManager } from './FleetManager';

describe('FleetManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(vehiclesApi, 'getVehicles').mockResolvedValue([]);
    vi.spyOn(vehiclesApi, 'getDrivers').mockResolvedValue([]);
    vi.spyOn(vehiclesApi, 'getVehicleAssignments').mockResolvedValue([]);
    vi.spyOn(guidesApi, 'getGuides').mockResolvedValue([]);
    vi.spyOn(bookingsApi, 'getPagedBookings').mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 50 });
  });

  it('renders the workspace heading and an empty allocation queue', async () => {
    render(
      <MemoryRouter>
        <FleetManager />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /fleet & transport workspace/i })).toBeInTheDocument();
    expect(await screen.findByText(/no bookings require manual review/i)).toBeInTheDocument();
    expect(screen.getByText(/no booking selected/i)).toBeInTheDocument();
  });
});
