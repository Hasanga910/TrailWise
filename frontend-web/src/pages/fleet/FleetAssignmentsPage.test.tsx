import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vehiclesApi from '../../api/vehicles';
import { FleetAssignmentsPage } from './FleetAssignmentsPage';

const mockAssignments: vehiclesApi.VehicleAssignmentDetailDto[] = [
  {
    id: 'a1-uuid',
    vehicleId: 'v1-uuid',
    vehicleName: 'Van (8 seats)',
    bookingId: 'b1-uuid',
    driverId: 'd1-uuid',
    driverName: 'Sunil Silva',
    driverContact: '+94 77 123 4567',
    startDate: '2026-10-01',
    endDate: '2026-10-05',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  },
];

describe('FleetAssignmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(vehiclesApi, 'getVehicleAssignments').mockResolvedValue(mockAssignments);
  });

  it('renders vehicle assignments table and metrics', async () => {
    render(<FleetAssignmentsPage />);

    expect(screen.getByRole('heading', { name: /vehicle assignments/i })).toBeInTheDocument();
    expect(await screen.findByText('Van (8 seats)')).toBeInTheDocument();
    expect(screen.getByText('Sunil Silva')).toBeInTheDocument();
    expect(screen.getByText('b1-uuid')).toBeInTheDocument();
  });
});
