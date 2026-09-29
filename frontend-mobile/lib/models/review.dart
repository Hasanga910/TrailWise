class Review {
  final String id;
  final String? bookingId;
  final int rating;
  final String? comment;
  final String submittedAt;
  final String reviewerDisplayName;
  final bool isVerifiedTrip;

  Review({
    required this.id,
    this.bookingId,
    required this.rating,
    this.comment,
    required this.submittedAt,
    this.reviewerDisplayName = 'Verified Traveler',
    this.isVerifiedTrip = true,
  });

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        id: json['id'] as String,
        bookingId: json['bookingId'] as String?,
        rating: (json['rating'] as num).toInt(),
        comment: json['comment'] as String?,
        submittedAt: json['submittedAt'] as String,
        reviewerDisplayName:
            (json['reviewerDisplayName'] as String?) ?? 'Verified Traveler',
        isVerifiedTrip: (json['isVerifiedTrip'] as bool?) ?? true,
      );
}

class PackageReviews {
  final String tourPackageId;
  final double averageRating;
  final int totalReviews;
  final List<Review> reviews;

  PackageReviews({
    required this.tourPackageId,
    required this.averageRating,
    required this.totalReviews,
    required this.reviews,
  });

  factory PackageReviews.fromJson(Map<String, dynamic> json) => PackageReviews(
        tourPackageId: json['tourPackageId'] as String,
        averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0.0,
        totalReviews: (json['totalReviews'] as num?)?.toInt() ?? 0,
        reviews: (json['reviews'] as List? ?? [])
            .map((r) => Review.fromJson(r as Map<String, dynamic>))
            .toList(),
      );
}
