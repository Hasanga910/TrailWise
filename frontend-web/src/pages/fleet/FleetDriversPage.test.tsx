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
});
