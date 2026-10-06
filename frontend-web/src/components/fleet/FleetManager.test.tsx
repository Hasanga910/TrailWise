import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vehiclesApi from '../../api/vehicles';
import { FleetVehiclesPage } from '../../pages/fleet/FleetVehiclesPage';

const mockVehicles: vehiclesApi.VehicleDto[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    type: 'Van',
    registrationNumber: 'WP-CAB-0001',
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
    registrationNumber: 'WP-CAC-0002',
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

describe('FleetVehiclesPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(vehiclesApi, 'getVehicles').mockResolvedValue(mockVehicles);
    vi.spyOn(vehiclesApi, 'getDrivers').mockResolvedValue(mockDrivers);
  });

  it('renders the fleet title, quick stats, and vehicle roster table', async () => {
    render(
      <MemoryRouter>
        <FleetVehiclesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /vehicle management/i })).toBeInTheDocument();

    // Vehicles loaded
    expect(await screen.findByText('#11111111')).toBeInTheDocument();
    expect(screen.getByText('#22222222')).toBeInTheDocument();

    // Stats
    expect(screen.getByText('Total Fleet')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // total fleet count
  });

  it('renders each vehicle\'s registration number in the roster table', async () => {
    render(
      <MemoryRouter>
        <FleetVehiclesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('WP-CAB-0001')).toBeInTheDocument();
    expect(screen.getByText('WP-CAC-0002')).toBeInTheDocument();
  });

  it('filters vehicles by registration number', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FleetVehiclesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('#11111111')).toBeInTheDocument();
    expect(screen.getByText('#22222222')).toBeInTheDocument();

    const registrationFilter = screen.getByPlaceholderText(/search by registration number or details\.\.\./i);
    await user.type(registrationFilter, 'cab');

    expect(screen.getByText('#11111111')).toBeInTheDocument();
    expect(screen.queryByText('#22222222')).not.toBeInTheDocument();
  });

  it('filters vehicles by vehicle type', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FleetVehiclesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('#11111111')).toBeInTheDocument();
    expect(screen.getByText('#22222222')).toBeInTheDocument();

    // Select SUV type
    const typeSelect = screen.getByDisplayValue(/all vehicle types/i);
    await user.selectOptions(typeSelect, 'SUV');

    // Van should be filtered out, SUV remains
    expect(screen.queryByText('#11111111')).not.toBeInTheDocument();
    expect(screen.getByText('#22222222')).toBeInTheDocument();
  });

  it('opens and submits Register Vehicle modal', async () => {
    const createSpy = vi.spyOn(vehiclesApi, 'createVehicle').mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      type: 'Coach',
      registrationNumber: 'WP-CAB-9999',
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
        <FleetVehiclesPage />
      </MemoryRouter>,
    );

    const addBtn = await screen.findByRole('button', { name: /register vehicle/i });
    await user.click(addBtn);

    expect(screen.getByRole('heading', { name: /register new vehicle/i })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/wp cab-1234 or nw-8921/i), 'WP-CAB-9999');

    const submitBtns = screen.getAllByRole('button', { name: /register vehicle/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ registrationNumber: 'WP-CAB-9999' }),
    );
  });

  it('updates vehicle maintenance status inline', async () => {
    const patchSpy = vi.spyOn(vehiclesApi, 'updateVehicleMaintenanceStatus').mockResolvedValue({
      ...mockVehicles[0],
      maintenanceStatus: 'UnderMaintenance',
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FleetVehiclesPage />
      </MemoryRouter>,
    );

    await screen.findByText('#11111111');

    const statusDropdowns = screen.getAllByRole('combobox');
    // Find the inline dropdown for the first vehicle
    const inlineStatusDropdown = statusDropdowns.find(
      (dropdown) => (dropdown as HTMLSelectElement).value === 'Available',
    );
    expect(inlineStatusDropdown).toBeDefined();
    await user.selectOptions(inlineStatusDropdown!, 'UnderMaintenance');

    expect(patchSpy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', {
      status: 'UnderMaintenance',
    });
  });

  it('opens delete confirmation modal and calls deleteVehicle on confirm', async () => {
    const deleteSpy = vi.spyOn(vehiclesApi, 'deleteVehicle').mockResolvedValue();

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <FleetVehiclesPage />
      </MemoryRouter>,
    );

    const deleteBtns = await screen.findAllByRole('button', { name: /^delete$/i });
    await user.click(deleteBtns[0]);

    // Check modal prompt
    expect(screen.getByRole('heading', { name: /delete vehicle/i })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /delete permanently/i });
    await user.click(confirmBtn);

    expect(deleteSpy).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111');
  });
});
