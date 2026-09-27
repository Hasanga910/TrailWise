class Review {
  final String id;
  final String bookingId;
  final int rating;
  final String? comment;
  final String submittedAt;

  Review({
    required this.id,
    required this.bookingId,
    required this.rating,
    this.comment,
    required this.submittedAt,
  });

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        id: json['id'] as String,
        bookingId: json['bookingId'] as String,
        rating: (json['rating'] as num).toInt(),
        comment: json['comment'] as String?,
        submittedAt: json['submittedAt'] as String,
      );
}
