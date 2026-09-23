class AssignedTour {
  final String bookingId;
  final String startDate;
  final String endDate;
  final int groupSize;
  final String status;
  final String tourPackageId;
  final String tourPackageName;
  final String theme;
  final List<String> locations;
  final String? specialRequests;
  final String guideId;
  final String guideName;

  AssignedTour({
    required this.bookingId,
    required this.startDate,
    required this.endDate,
    required this.groupSize,
    required this.status,
    required this.tourPackageId,
    required this.tourPackageName,
    required this.theme,
    required this.locations,
    this.specialRequests,
    required this.guideId,
    required this.guideName,
  });

  factory AssignedTour.fromJson(Map<String, dynamic> json) => AssignedTour(
        bookingId: json['bookingId'] as String,
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String,
        groupSize: (json['groupSize'] as num).toInt(),
        status: json['status'] as String,
        tourPackageId: json['tourPackageId'] as String,
        tourPackageName: json['tourPackageName'] as String,
        theme: json['theme'] as String,
        locations: (json['locations'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        specialRequests: json['specialRequests'] as String?,
        guideId: json['guideId'] as String,
        guideName: json['guideName'] as String,
      );
}
