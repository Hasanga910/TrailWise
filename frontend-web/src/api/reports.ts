import { apiClient } from './apiClient';
import type { ApprovalCountsDto } from './approvals';

export interface PackageOccupancyDto {
  tourPackageId: string;
  packageName: string;
  maxGroupSize: number;
  bookingCount: number;
  bookedTravelers: number;
  averageGroupSize: number;
  occupancyPercentage: number;
}

export interface PackageRevenueDto {
  tourPackageId: string;
  packageName: string;
  revenue: number;
}

export interface MonthlyRevenueDto {
  year: number;
  month: number;
  label: string;
  revenue: number;
}

export interface RevenueReportResponse {
  totalRevenue: number;
  byPackage: PackageRevenueDto[];
  byMonth: MonthlyRevenueDto[];
}

export interface GuideUtilizationDto {
  guideId: string;
  guideName: string;
  assignedDays: number;
  availableDays: number;
  recordedDays: number;
  utilizationPercentage: number;
}

export async function getOccupancyReport(from: string, to: string): Promise<PackageOccupancyDto[]> {
  const response = await apiClient.get<PackageOccupancyDto[]>('/api/reports/occupancy', {
    params: { from, to },
  });
  return response.data;
}

export async function getRevenueReport(from?: string, to?: string): Promise<RevenueReportResponse> {
  const response = await apiClient.get<RevenueReportResponse>('/api/reports/revenue', {
    params: {
      from: from || undefined,
      to: to || undefined,
    },
  });
  return response.data;
}

export async function getGuideUtilizationReport(from?: string, to?: string): Promise<GuideUtilizationDto[]> {
  const response = await apiClient.get<GuideUtilizationDto[]>('/api/reports/guide-utilization', {
    params: {
      from: from || undefined,
      to: to || undefined,
    },
  });
  return response.data;
}

export async function exportAuditLogsCsv(from?: string, to?: string, entityType?: string): Promise<Blob> {
  const response = await apiClient.get('/api/reports/audit/export', {
    params: {
      from: from || undefined,
      to: to || undefined,
      entityType: entityType && entityType !== 'All' ? entityType : undefined,
    },
    responseType: 'blob',
  });
  return response.data;
}

// ---- Operations dashboard (design doc section 6) ----

export interface UpcomingTourDto {
  bookingId: string;
  tourPackageName: string;
  travelerName: string;
  startDate: string;
  endDate: string;
  groupSize: number;
  daysUntilStart: number;
  guideName: string | null;
  vehicleRegistration: string | null;
  driverName: string | null;
}

export interface DashboardRefundExceptionDto {
  approvalId: string;
  bookingId: string;
  tourPackageName: string;
  travelerName: string;
  startDate: string;
  daysUntilStart: number;
  /** The tour starts within `urgentWithinDays` days (or already has). */
  urgent: boolean;
  requestedAt: string;
}

export interface DashboardApprovalsDto {
  counts: ApprovalCountsDto;
  urgentWithinDays: number;
  urgentCount: number;
  refundExceptions: DashboardRefundExceptionDto[];
}

export interface UtilizationWindowDto {
  from: string;
  to: string;
  days: number;
}

export interface VehicleUtilizationItemDto {
  vehicleId: string;
  registrationNumber: string;
  type: string;
  maintenanceStatus: string;
  bookedDays: number;
  utilizationPercentage: number;
}

export interface OpsDashboardDto {
  generatedAt: string;
  upcomingTours: UpcomingTourDto[];
  approvals: DashboardApprovalsDto;
  guideUtilization: { window: UtilizationWindowDto; overallPercentage: number; guides: GuideUtilizationDto[] };
  vehicleUtilization: {
    window: UtilizationWindowDto;
    overallPercentage: number;
    inServiceVehicles: number;
    vehicles: VehicleUtilizationItemDto[];
  };
  workflows: { running: number; awaitingApproval: number; failed: number; bookingsNeedingManualReview: number };
}

export async function getOpsDashboard(): Promise<OpsDashboardDto> {
  const response = await apiClient.get<OpsDashboardDto>('/api/reports/dashboard');
  return response.data;
}
