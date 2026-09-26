import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vehiclesApi from '../../api/vehicles';
import { FleetManager } from './FleetManager';

const mockVehicles: vehiclesApi.VehicleDto[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'Van',
    capacity: 7,
    hasAC: true,
    seatConfiguration: '2-2-3',
    maintenanceStatus: 'Available',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    type: 'SUV',
    capacity: 4,
    hasAC: false,
    seatConfiguration: '2-2',
    maintenanceStatus: 'UnderMaintenance',
    createdAt: '2026-09-02T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z',
  },
];

const mockDrivers: vehiclesApi.DriverDto[] = [
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    name: 'Kasun Silva',
    licenseNumber: 'B-12345678',
    contactInfo: '0771234567',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

describe('FleetManager Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(vehiclesApi, 'getVehicles').mockResolvedValue(mockVehicles);
    vi.spyOn(vehiclesApi, 'getDrivers').mockResolvedValue(mockDrivers);
  });

  it('renders the fleet title, quick stats, and vehicle roster table', async () => {
    render(
      <MemoryRouter>
        <FleetManager />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /fleet & transport/i })).toBeInTheDocument();

    // Vehicles loaded
    expect(await screen.findByText('#11111111')).toBeInTheDocument();
    expect(screen.getByText('#22222222')).toBeInTheDocument();

    // Stats
    expect(screen.getByText('Total Fleet')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // total fleet count
  });

  it('filters vehicles by vehicle type', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FleetManager />
      </MemoryRouter>,
    );

    expect(await screen.findByText('#11111111')).toBeInTheDocument();
    expect(screen.getByText('#22222222')).toBeInTheDocument();

    // Select SUV type
    const typeSelect = screen.getByLabelText(/filter by vehicle type/i);
    await user.selectOptions(typeSelect, 'SUV');

    // Van should be filtered out, SUV remains
    expect(screen.queryByText('#11111111')).not.toBeInTheDocument();
    expect(screen.getByText('#22222222')).toBeInTheDocument();
  });

  it('opens and submits Add Vehicle modal', async () => {
    const createSpy = vi.spyOn(vehiclesApi, 'createVehicle').mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      type: 'Coach',
      capacity: 35,
      hasAC: true,
      seatConfiguration: '2-2-coach',
      maintenanceStatus: 'Available',
      createdAt: '2026-09-03T00:00:00Z',
      updatedAt: '2026-09-03T00:00:00Z',
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FleetManager />
      </MemoryRouter>,
    );

    const addBtn = await screen.findByRole('button', { name: /add vehicle/i });
    await user.click(addBtn);

    expect(screen.getByRole('heading', { name: /add vehicle to fleet/i })).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /save vehicle/i });
    await user.click(submitBtn);

    expect(createSpy).toHaveBeenCalled();
  });

  it('updates vehicle maintenance status inline', async () => {
    const patchSpy = vi.spyOn(vehiclesApi, 'updateVehicleMaintenanceStatus').mockResolvedValue({
      ...mockVehicles[0],
      maintenanceStatus: 'UnderMaintenance',
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FleetManager />
      </MemoryRouter>,
    );

    await screen.findByText('#11111111');

    const statusDropdown = screen.getByLabelText(/change status for vehicle 11111111/i);
    await user.selectOptions(statusDropdown, 'UnderMaintenance');

    expect(patchSpy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', {
      status: 'UnderMaintenance',
    });
  });

  it('opens and verifies vehicle availability query', async () => {
    const availSpy = vi.spyOn(vehiclesApi, 'checkVehicleAvailability').mockResolvedValue({
      vehicleId: mockVehicles[0].id,
      from: '2026-10-01',
      to: '2026-10-05',
      isAvailable: true,
      reason: null,
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FleetManager />
      </MemoryRouter>,
    );

    const checkBtns = await screen.findAllByRole('button', { name: /check availability/i });
    await user.click(checkBtns[0]);

    expect(screen.getByRole('heading', { name: /check availability: van/i })).toBeInTheDocument();

    const runBtn = screen.getByRole('button', { name: /run query/i });
    await user.click(runBtn);

    expect(availSpy).toHaveBeenCalled();
    expect(await screen.findByText(/available for the selected date range!/i)).toBeInTheDocument();
  });

  it('opens delete confirmation modal and calls deleteVehicle on confirm', async () => {
    const deleteSpy = vi.spyOn(vehiclesApi, 'deleteVehicle').mockResolvedValue();

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FleetManager />
      </MemoryRouter>,
    );

    const deleteBtns = await screen.findAllByRole('button', { name: /^delete$/i });
    await user.click(deleteBtns[0]);

    // Check modal prompt
    expect(screen.getByRole('heading', { name: /delete vehicle #11111111/i })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /yes, delete vehicle/i });
    await user.click(confirmBtn);

    expect(deleteSpy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  });
});
