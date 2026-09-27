class ItineraryStep {
  final String? id;
  final String? bookingId;
  final int dayNumber;
  final String activity;
  final String location;
  final String startTime;

  ItineraryStep({
    this.id,
    this.bookingId,
    required this.dayNumber,
    required this.activity,
    required this.location,
    required this.startTime,
  });

  factory ItineraryStep.fromJson(Map<String, dynamic> json) => ItineraryStep(
        id: json['id'] as String?,
        bookingId: json['bookingId'] as String?,
        dayNumber: (json['dayNumber'] as num).toInt(),
        activity: json['activity'] as String,
        location: json['location'] as String,
        startTime: json['startTime'] as String,
      );

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        if (bookingId != null) 'bookingId': bookingId,
        'dayNumber': dayNumber,
        'activity': activity,
        'location': location,
        'startTime': startTime,
      };

  ItineraryStep copyWith({
    String? id,
    String? bookingId,
    int? dayNumber,
    String? activity,
    String? location,
    String? startTime,
  }) {
    return ItineraryStep(
      id: id ?? this.id,
      bookingId: bookingId ?? this.bookingId,
      dayNumber: dayNumber ?? this.dayNumber,
      activity: activity ?? this.activity,
      location: location ?? this.location,
      startTime: startTime ?? this.startTime,
    );
  }
}
