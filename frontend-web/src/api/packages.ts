import { apiClient } from './apiClient';

export type ClassType = 'First' | 'Second' | 'Normal';

export interface PackageTier {
  id: string;
  classType: ClassType;
  includesFood: boolean;
  basePricePerPerson: number;
  requiresAC: boolean;
}

export interface PackageLocation {
  id: string;
  name: string;
  /** Null when the place could not be found; such locations are listed but not plotted. */
  latitude?: number | null;
  longitude?: number | null;
}

export interface TourPackage {
  id: string;
  name: string;
  theme: string;
  durationDays: number;
  basePricePerPerson: number;
  maxGroupSize: number;
  photoUrl: string | null;
  tiers: PackageTier[];
  locations: PackageLocation[];
  averageRating?: number;
  reviewCount?: number;
  /** Lowest tier price (or the base price when there are no tiers). */
  startingPrice?: number;
}

export type PackageSort = 'name' | 'price' | 'duration' | 'rating';
export type SortDirection = 'asc' | 'desc';

/** Optional filters for the public catalogue; omitted keys are not sent. */
export interface PackageQuery {
  q?: string;
  theme?: string;
  minDays?: number;
  maxDays?: number;
  minPrice?: number;
  maxPrice?: number;
  classType?: ClassType;
  includesFood?: boolean;
  requiresAC?: boolean;
  guests?: number;
  minRating?: number;
  sort?: PackageSort;
  dir?: SortDirection;
}

export interface PackageFacets {
  themes: string[];
  minPrice: number;
  maxPrice: number;
  minDays: number;
  maxDays: number;
  maxGroupSize: number;
}

export interface PackageTierInput {
  classType: ClassType;
  includesFood: boolean;
  basePricePerPerson: number;
  requiresAC: boolean;
}

export interface PackageInput {
  name: string;
  theme: string;
  durationDays: number;
  basePricePerPerson: number;
  maxGroupSize: number;
  locationNames: string[];
  /** Optional manual coordinates, keyed by names present in `locationNames`. */
  locationCoordinates?: { name: string; latitude: number; longitude: number }[];
}

export interface CreatePackageInput extends PackageInput {
  tiers: PackageTierInput[];
}

/** Public: works without a token. Pass a query to filter and sort server-side. */
export async function getPackages(query?: PackageQuery, signal?: AbortSignal): Promise<TourPackage[]> {
  const params = query
    ? Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''))
    : undefined;
  const response = await apiClient.get<TourPackage[]>('/api/packages', { params, signal });
  return response.data;
}

export async function getPackageFacets(signal?: AbortSignal): Promise<PackageFacets> {
  const response = await apiClient.get<PackageFacets>('/api/packages/facets', { signal });
  return response.data;
}

export async function getPackageById(id: string, signal?: AbortSignal): Promise<TourPackage> {
  const response = await apiClient.get<TourPackage>(`/api/packages/${id}`, { signal });
  return response.data;
}

export async function createPackage(input: CreatePackageInput): Promise<TourPackage> {
  const response = await apiClient.post<TourPackage>('/api/packages', input);
  return response.data;
}

export async function updatePackage(id: string, input: PackageInput): Promise<TourPackage> {
  const response = await apiClient.put<TourPackage>(`/api/packages/${id}`, input);
  return response.data;
}

export async function deletePackage(id: string): Promise<void> {
  await apiClient.delete(`/api/packages/${id}`);
}

export async function addTier(id: string, input: PackageTierInput): Promise<TourPackage> {
  const response = await apiClient.post<TourPackage>(`/api/packages/${id}/tiers`, input);
  return response.data;
}

export async function updateTier(id: string, tierId: string, input: PackageTierInput): Promise<TourPackage> {
  const response = await apiClient.put<TourPackage>(`/api/packages/${id}/tiers/${tierId}`, input);
  return response.data;
}

export async function deleteTier(id: string, tierId: string): Promise<TourPackage> {
  const response = await apiClient.delete<TourPackage>(`/api/packages/${id}/tiers/${tierId}`);
  return response.data;
}

export async function uploadPackagePhoto(id: string, file: File): Promise<TourPackage> {
  const formData = new FormData();
  formData.append('photo', file);
  const response = await apiClient.post<TourPackage>(`/api/packages/${id}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
