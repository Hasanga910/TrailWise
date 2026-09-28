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
  final bool attended;
  final bool completed;
  final String? guideNotes;
  final DateTime? tourStartedAt;
  final DateTime? tourEndedAt;

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
    this.attended = false,
    this.completed = false,
    this.guideNotes,
    this.tourStartedAt,
    this.tourEndedAt,
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
        attended: (json['attended'] as bool?) ?? false,
        completed: (json['completed'] as bool?) ?? false,
        guideNotes: json['guideNotes'] as String?,
        tourStartedAt: json['tourStartedAt'] != null
            ? DateTime.tryParse(json['tourStartedAt'] as String)
            : null,
        tourEndedAt: json['tourEndedAt'] != null
            ? DateTime.tryParse(json['tourEndedAt'] as String)
            : null,
      );

  AssignedTour copyWith({
    String? bookingId,
    String? startDate,
    String? endDate,
    int? groupSize,
    String? status,
    String? tourPackageId,
    String? tourPackageName,
    String? theme,
    List<String>? locations,
    String? specialRequests,
    String? guideId,
    String? guideName,
    bool? attended,
    bool? completed,
    String? guideNotes,
    bool clearGuideNotes = false,
    DateTime? tourStartedAt,
    DateTime? tourEndedAt,
  }) {
    return AssignedTour(
      bookingId: bookingId ?? this.bookingId,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      groupSize: groupSize ?? this.groupSize,
      status: status ?? this.status,
      tourPackageId: tourPackageId ?? this.tourPackageId,
      tourPackageName: tourPackageName ?? this.tourPackageName,
      theme: theme ?? this.theme,
      locations: locations ?? this.locations,
      specialRequests: specialRequests ?? this.specialRequests,
      guideId: guideId ?? this.guideId,
      guideName: guideName ?? this.guideName,
      attended: attended ?? this.attended,
      completed: completed ?? this.completed,
      guideNotes: clearGuideNotes ? null : (guideNotes ?? this.guideNotes),
      tourStartedAt: tourStartedAt ?? this.tourStartedAt,
      tourEndedAt: tourEndedAt ?? this.tourEndedAt,
    );
  }
}

