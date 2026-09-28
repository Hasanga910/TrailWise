import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vehiclesApi from '../../api/vehicles';
import { FleetDriversPage } from './FleetDriversPage';

const mockDrivers: vehiclesApi.DriverDto[] = [
  {
    id: 'd1-uuid',
    name: 'Sunil Silva',
    licenseNumber: 'B-12345678',
    contactInfo: '+94 77 123 4567',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

describe('FleetDriversPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(vehiclesApi, 'getDrivers').mockResolvedValue(mockDrivers);
  });

  it('renders driver roster table and metrics', async () => {
    render(<FleetDriversPage />);

    expect(screen.getByRole('heading', { name: /driver roster/i })).toBeInTheDocument();
    expect(await screen.findByText('Sunil Silva')).toBeInTheDocument();
    expect(screen.getByText('B-12345678')).toBeInTheDocument();
  });

  it('opens register driver modal and creates new driver', async () => {
    const createSpy = vi.spyOn(vehiclesApi, 'createDriver').mockResolvedValue({
      id: 'd2-uuid',
      name: 'Nimal Perera',
      licenseNumber: 'B-99999999',
      contactInfo: '+94 71 000 0000',
      createdAt: '2026-09-02T00:00:00Z',
      updatedAt: '2026-09-02T00:00:00Z',
    });

    const user = userEvent.setup();
    render(<FleetDriversPage />);

    const openBtn = await screen.findByRole('button', { name: /register driver/i });
    await user.click(openBtn);

    expect(screen.getByRole('heading', { name: /register new driver/i })).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/sunil perera/i);
    const licenseInput = screen.getByPlaceholderText(/b-8492019/i);
    await user.type(nameInput, 'Nimal Perera');
    await user.type(licenseInput, 'B-99999999');

    const submitBtns = screen.getAllByRole('button', { name: /^register driver$/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    expect(createSpy).toHaveBeenCalledWith({
      name: 'Nimal Perera',
      licenseNumber: 'B-99999999',
      contactInfo: '',
    });
  });

  it('opens update driver modal and edits existing driver', async () => {
    const updateSpy = vi.spyOn(vehiclesApi, 'updateDriver').mockResolvedValue({
      id: 'd1-uuid',
      name: 'Sunil Silva Updated',
      licenseNumber: 'B-12345678-UPD',
      contactInfo: '+94 77 999 8888',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-02T00:00:00Z',
    });

    const user = userEvent.setup();
    render(<FleetDriversPage />);

    const editBtn = await screen.findByRole('button', { name: /^edit$/i });
    await user.click(editBtn);

    expect(screen.getByRole('heading', { name: /update driver details/i })).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('Sunil Silva');
    await user.clear(nameInput);
    await user.type(nameInput, 'Sunil Silva Updated');

    const saveBtn = screen.getByRole('button', { name: /update driver/i });
    await user.click(saveBtn);

    expect(updateSpy).toHaveBeenCalledWith('d1-uuid', {
      name: 'Sunil Silva Updated',
      licenseNumber: 'B-12345678',
      contactInfo: '+94 77 123 4567',
    });
  });

  it('opens delete confirmation modal and deletes driver', async () => {
    const deleteSpy = vi.spyOn(vehiclesApi, 'deleteDriver').mockResolvedValue();

    const user = userEvent.setup();
    render(<FleetDriversPage />);

    const deleteBtn = await screen.findByRole('button', { name: /^delete$/i });
    await user.click(deleteBtn);

    expect(screen.getByRole('heading', { name: /delete driver/i })).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm delete/i });
    await user.click(confirmBtn);

    expect(deleteSpy).toHaveBeenCalledWith('d1-uuid');
  });
});
