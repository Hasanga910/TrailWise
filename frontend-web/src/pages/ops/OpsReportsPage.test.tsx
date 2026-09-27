import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportAuditLogsCsv,
  getGuideUtilizationReport,
  getOccupancyReport,
  getRevenueReport,
  type GuideUtilizationDto,
  type PackageOccupancyDto,
  type RevenueReportResponse,
} from '../../api/reports';
import { OpsReportsPage } from './OpsReportsPage';

vi.mock('../../api/reports', () => ({
  getRevenueReport: vi.fn(),
  getOccupancyReport: vi.fn(),
  getGuideUtilizationReport: vi.fn(),
  exportAuditLogsCsv: vi.fn(),
}));

const mockGetRevenueReport = vi.mocked(getRevenueReport);
const mockGetOccupancyReport = vi.mocked(getOccupancyReport);
const mockGetGuideUtilizationReport = vi.mocked(getGuideUtilizationReport);
const mockExportAuditLogsCsv = vi.mocked(exportAuditLogsCsv);

const sampleRevenue: RevenueReportResponse = {
  totalRevenue: 25000,
  byPackage: [
    { tourPackageId: 'pkg-1', packageName: 'Highland Heritage', revenue: 15000 },
    { tourPackageId: 'pkg-2', packageName: 'Coastal Adventure', revenue: 10000 },
  ],
  byMonth: [
    { year: 2026, month: 8, label: '2026-08', revenue: 10000 },
    { year: 2026, month: 9, label: '2026-09', revenue: 15000 },
  ],
};

const sampleOccupancy: PackageOccupancyDto[] = [
  {
    tourPackageId: 'pkg-1',
    packageName: 'Highland Heritage',
    maxGroupSize: 10,
    bookingCount: 3,
    bookedTravelers: 24,
    averageGroupSize: 8.0,
    occupancyPercentage: 80.0,
  },
];

const sampleGuides: GuideUtilizationDto[] = [
  {
    guideId: 'guide-1',
    guideName: 'Kasun Perera',
    assignedDays: 8,
    availableDays: 12,
    recordedDays: 20,
    utilizationPercentage: 40.0,
  },
];

describe('OpsReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    mockGetRevenueReport.mockResolvedValue(sampleRevenue);
    mockGetOccupancyReport.mockResolvedValue(sampleOccupancy);
    mockGetGuideUtilizationReport.mockResolvedValue(sampleGuides);
    mockExportAuditLogsCsv.mockResolvedValue(new Blob(['id,action\n1,Payment']));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and renders report data on load', async () => {
    render(<OpsReportsPage />);

    await waitFor(() => {
      expect(mockGetRevenueReport).toHaveBeenCalledTimes(1);
      expect(mockGetOccupancyReport).toHaveBeenCalledTimes(1);
      expect(mockGetGuideUtilizationReport).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Operations Reports')).toBeInTheDocument();
  });

  it('renders revenue total, by package, and by month', async () => {
    render(<OpsReportsPage />);

    expect(await screen.findByText('$25,000.00')).toBeInTheDocument();
    expect(screen.getAllByText('Highland Heritage')[0]).toBeInTheDocument();
    expect(screen.getByText('Coastal Adventure')).toBeInTheDocument();
    expect(screen.getByText('2026-08')).toBeInTheDocument();
    expect(screen.getByText('2026-09')).toBeInTheDocument();
  });

  it('renders package occupancy data accurately', async () => {
    render(<OpsReportsPage />);

    await screen.findByText('$25,000.00');

    expect(screen.getAllByText('Highland Heritage').length).toBe(2);
    expect(screen.getByText('80.00%')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('8.00')).toBeInTheDocument();
  });

  it('renders guide utilization data and empty message when guide records are empty', async () => {
    mockGetGuideUtilizationReport.mockResolvedValueOnce([]);

    render(<OpsReportsPage />);

    await screen.findByText('$25,000.00');

    expect(
      screen.getByText('No guide availability records are available for this date range.'),
    ).toBeInTheDocument();
  });

  it('renders guide utilization table when guide records are present', async () => {
    render(<OpsReportsPage />);

    await screen.findByText('$25,000.00');

    expect(screen.getByText('Kasun Perera')).toBeInTheDocument();
    expect(screen.getByText('40.00%')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('calls exportAuditLogsCsv and triggers download when clicking Export Audit CSV', async () => {
    render(<OpsReportsPage />);

    await screen.findByText('$25,000.00');

    const entitySelect = screen.getByLabelText(/entity type/i);
    fireEvent.change(entitySelect, { target: { value: 'Payment' } });

    const exportBtn = screen.getByRole('button', { name: /export audit csv/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockExportAuditLogsCsv).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'Payment',
      );
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('shows validation error and blocks fetch when date range is invalid', async () => {
    render(<OpsReportsPage />);

    await screen.findByText('$25,000.00');
    expect(mockGetOccupancyReport).toHaveBeenCalledTimes(1);

    const fromInput = screen.getByLabelText(/from date/i);
    const toInput = screen.getByLabelText(/to date/i);

    fireEvent.change(fromInput, { target: { value: '2026-10-15' } });
    fireEvent.change(toInput, { target: { value: '2026-10-01' } });

    const refreshBtn = screen.getByRole('button', { name: /refresh data/i });
    fireEvent.click(refreshBtn);

    expect(
      await screen.findByText("'From' date must not be after 'To' date."),
    ).toBeInTheDocument();

    // Ensure no additional API calls were made on invalid refresh
    expect(mockGetOccupancyReport).toHaveBeenCalledTimes(1);
  });
});
