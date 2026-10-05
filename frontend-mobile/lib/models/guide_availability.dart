class GuideAvailability {
  final String id;
  final String guideId;
  final String date; // 'YYYY-MM-DD'
  final bool isAvailable;
  final String? assignedBookingId;

  GuideAvailability({
    required this.id,
    required this.guideId,
    required this.date,
    required this.isAvailable,
    this.assignedBookingId,
  });

  factory GuideAvailability.fromJson(Map<String, dynamic> json) =>
      GuideAvailability(
        id: json['id'] as String,
        guideId: json['guideId'] as String,
        date: json['date'] as String,
        isAvailable: (json['isAvailable'] as bool?) ?? false,
        assignedBookingId: json['assignedBookingId'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'guideId': guideId,
        'date': date,
        'isAvailable': isAvailable,
        'assignedBookingId': assignedBookingId,
      };
}
