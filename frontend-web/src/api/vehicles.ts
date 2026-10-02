import { apiClient } from './apiClient';

export type VehicleType = 'Van' | 'Coach' | 'SUV';

export type VehicleMaintenanceStatus = 'Available' | 'UnderMaintenance' | 'OutOfService';

export interface VehicleDto {
  id: string;
  type: VehicleType;
  registrationNumber: string;
  capacity: number;
  hasAC: boolean;
  seatConfiguration: string;
  maintenanceStatus: VehicleMaintenanceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleRequest {
  type: VehicleType;
  registrationNumber: string;
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

export interface DriverAvailabilityResponse {
  driverId: string;
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
  guideId?: string;
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

export interface VehicleAssignmentDetailDto {
  id: string;
  vehicleId: string;
  vehicleName: string;
  bookingId: string;
  driverId: string;
  driverName: string;
  driverContact: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  vehicleType?: VehicleType;
  capacity?: number;
  hasAC?: boolean;
  registrationNumber?: string;
  bookingStatus?: string;
  travelerName?: string;
  travelerContact?: string;
  packageName?: string;
  packageTier?: string;
  itineraryHighlights?: string[];
  driverLicenseNumber?: string;
  guideName?: string;
  guideContact?: string;
  groupSize?: number;
  specialRequests?: string;
  languagePreference?: string;
}

export interface DriverDto {
  id: string;
  name: string;
  licenseNumber: string;
  contactInfo: string;
  createdAt: string;
  updatedAt: string;
  email?: string;
  userId?: string;
}

export interface CreateDriverRequest {
  name: string;
  licenseNumber: string;
  contactInfo?: string;
  email?: string;
  password?: string;
}

export interface UpdateDriverRequest {
  name: string;
  licenseNumber: string;
  contactInfo?: string;
  email?: string;
  password?: string;
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
 * Check if a driver is available for a given date range
 */
export async function checkDriverAvailability(
  id: string,
  from: string,
  to: string,
): Promise<DriverAvailabilityResponse> {
  const response = await apiClient.get<DriverAvailabilityResponse>(`/api/drivers/${id}/availability`, {
    params: { from, to },
  });
  return response.data;
}

/**
 * Fetch all vehicle assignments with related details
 */
export async function getVehicleAssignments(): Promise<VehicleAssignmentDetailDto[]> {
  const response = await apiClient.get<VehicleAssignmentDetailDto[]>('/api/vehicles/assignments');
  return response.data;
}

/**
 * Fetch assigned tours and vehicle tasks for the authenticated driver
 */
export async function getMyDriverAssignments(): Promise<VehicleAssignmentDetailDto[]> {
  const response = await apiClient.get<VehicleAssignmentDetailDto[]>('/api/drivers/me/assignments');
  return response.data;
}

/**
 * Fetch vehicle assignment for a specific booking
 */
export async function getAssignmentByBookingId(bookingId: string): Promise<VehicleAssignmentDetailDto | null> {
  try {
    const response = await apiClient.get<VehicleAssignmentDetailDto>(
      `/api/vehicles/assignments/by-booking/${bookingId}`,
      {
        validateStatus: (status) => status < 400 || status === 404,
      }
    );
    if (response.status === 404) {
      return null;
    }
    return response.data;
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Register a new driver
 */
export async function createDriver(request: CreateDriverRequest): Promise<DriverDto> {
  const response = await apiClient.post<DriverDto>('/api/drivers', request);
  return response.data;
}

/**
 * Update an existing driver
 */
export async function updateDriver(id: string, request: UpdateDriverRequest): Promise<DriverDto> {
  const response = await apiClient.put<DriverDto>(`/api/drivers/${id}`, request);
  return response.data;
}

/**
 * Delete a driver from the roster
 */
export async function deleteDriver(id: string): Promise<void> {
  await apiClient.delete(`/api/drivers/${id}`);
}

/**
 * Delete a vehicle from the fleet
 */
export async function deleteVehicle(id: string): Promise<void> {
  await apiClient.delete(`/api/vehicles/${id}`);
}

