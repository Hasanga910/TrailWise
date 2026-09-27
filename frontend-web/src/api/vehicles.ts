import { apiClient } from './apiClient';

export type VehicleType = 'Van' | 'Coach' | 'SUV';

export type VehicleMaintenanceStatus = 'Available' | 'UnderMaintenance' | 'OutOfService';

export interface VehicleDto {
  id: string;
  type: VehicleType;
  capacity: number;
  hasAC: boolean;
  seatConfiguration: string;
  maintenanceStatus: VehicleMaintenanceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleRequest {
  type: VehicleType;
  capacity: number;
  hasAC: boolean;
  seatConfiguration?: string;
  maintenanceStatus?: VehicleMaintenanceStatus;
}

export interface UpdateMaintenanceStatusRequest {
  status: VehicleMaintenanceStatus;
}

export interface VehicleAvailabilityResponse {
  vehicleId: string;
  from: string;
  to: string;
  isAvailable: boolean;
  reason?: string | null;
}

export interface ReserveVehicleRequest {
  bookingId: string;
  driverId: string;
  startDate: string;
  endDate: string;
}

export interface VehicleAssignmentDto {
  id: string;
  vehicleId: string;
  bookingId: string;
  driverId: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriverDto {
  id: string;
  name: string;
  licenseNumber: string;
  contactInfo: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDriverRequest {
  name: string;
  licenseNumber: string;
  contactInfo?: string;
}

export interface GetVehiclesFilter {
  hasAC?: boolean;
  minCapacity?: number;
  type?: VehicleType;
  status?: VehicleMaintenanceStatus;
}

/**
 * Fetch all vehicles with optional filters (AC, min capacity, vehicle type, maintenance status)
 */
export async function getVehicles(filter?: GetVehiclesFilter): Promise<VehicleDto[]> {
  const response = await apiClient.get<VehicleDto[]>('/api/vehicles', { params: filter });
  return response.data;
}

/**
 * Fetch a single vehicle by its ID
 */
export async function getVehicleById(id: string): Promise<VehicleDto> {
  const response = await apiClient.get<VehicleDto>(`/api/vehicles/${id}`);
  return response.data;
}

/**
 * Create a new vehicle in the fleet
 */
export async function createVehicle(request: CreateVehicleRequest): Promise<VehicleDto> {
  const response = await apiClient.post<VehicleDto>('/api/vehicles', request);
  return response.data;
}

/**
 * Update the maintenance status of a vehicle (Available, UnderMaintenance, OutOfService)
 */
export async function updateVehicleMaintenanceStatus(
  id: string,
  request: UpdateMaintenanceStatusRequest,
): Promise<VehicleDto> {
  const response = await apiClient.patch<VehicleDto>(`/api/vehicles/${id}/maintenance-status`, request);
  return response.data;
}

/**
 * Check if a vehicle is available for a given date range
 */
export async function checkVehicleAvailability(
  id: string,
  from: string,
  to: string,
): Promise<VehicleAvailabilityResponse> {
  const response = await apiClient.get<VehicleAvailabilityResponse>(`/api/vehicles/${id}/availability`, {
    params: { from, to },
  });
  return response.data;
}

/**
 * Reserve / allocate a vehicle to a booking with an assigned driver
 */
export async function reserveVehicle(
  vehicleId: string,
  request: ReserveVehicleRequest,
): Promise<VehicleAssignmentDto> {
  const response = await apiClient.post<VehicleAssignmentDto>(`/api/vehicles/${vehicleId}/reservations`, request);
  return response.data;
}

/**
 * Fetch all registered drivers
 */
export async function getDrivers(): Promise<DriverDto[]> {
  const response = await apiClient.get<DriverDto[]>('/api/drivers');
  return response.data;
}

/**
 * Register a new driver
 */
export async function createDriver(request: CreateDriverRequest): Promise<DriverDto> {
  const response = await apiClient.post<DriverDto>('/api/drivers', request);
  return response.data;
}

/**
 * Delete a vehicle from the fleet
 */
export async function deleteVehicle(id: string): Promise<void> {
  await apiClient.delete(`/api/vehicles/${id}`);
}

