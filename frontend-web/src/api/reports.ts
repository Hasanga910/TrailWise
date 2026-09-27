import { apiClient } from './apiClient';

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
