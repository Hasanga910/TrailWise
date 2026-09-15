import { apiClient } from './apiClient';

export type ClassType = 'First' | 'Second' | 'Normal';

export interface PackageTier {
  id: string;
  classType: ClassType;
  includesFood: boolean;
  basePricePerPerson: number;
  requiresAC: boolean;
}

export interface TourPackage {
  id: string;
  name: string;
  theme: string;
  durationDays: number;
  basePricePerPerson: number;
  maxGroupSize: number;
  tiers: PackageTier[];
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
}

export interface CreatePackageInput extends PackageInput {
  tiers: PackageTierInput[];
}

export async function getPackages(): Promise<TourPackage[]> {
  const response = await apiClient.get<TourPackage[]>('/api/packages');
  return response.data;
}

export async function getPackageById(id: string): Promise<TourPackage> {
  const response = await apiClient.get<TourPackage>(`/api/packages/${id}`);
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
