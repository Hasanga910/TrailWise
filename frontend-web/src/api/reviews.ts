import { apiClient } from './apiClient';

export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  submittedAt: string;
  reviewerDisplayName: string;
  isVerifiedTrip: boolean;
}

export interface PackageReviews {
  tourPackageId: string;
  averageRating: number;
  totalReviews: number;
  reviews: PublicReview[];
}

export interface FeaturedReview {
  id: string;
  rating: number;
  comment: string;
  submittedAt: string;
  packageId: string;
  packageName: string;
  reviewerDisplayName: string;
}

/** Public: no login needed. */
export async function getPackageReviews(packageId: string, signal?: AbortSignal): Promise<PackageReviews> {
  const response = await apiClient.get<PackageReviews>(`/api/packages/${packageId}/reviews`, { signal });
  return response.data;
}

/** Public: the newest well-rated reviews across packages, for testimonials. */
export async function getFeaturedReviews(limit = 6, signal?: AbortSignal): Promise<FeaturedReview[]> {
  const response = await apiClient.get<FeaturedReview[]>('/api/reviews/featured', { params: { limit }, signal });
  return response.data;
}
