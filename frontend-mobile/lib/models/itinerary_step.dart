class ItineraryStep {
  final String id;
  final String bookingId;
  final int dayNumber;
  final String activity;
  final String location;
  final String startTime;

  ItineraryStep({
    required this.id,
    required this.bookingId,
    required this.dayNumber,
    required this.activity,
    required this.location,
    required this.startTime,
  });

  factory ItineraryStep.fromJson(Map<String, dynamic> json) => ItineraryStep(
        id: json['id'] as String,
        bookingId: json['bookingId'] as String,
        dayNumber: (json['dayNumber'] as num).toInt(),
        activity: json['activity'] as String,
        location: json['location'] as String,
        startTime: json['startTime'] as String,
      );

  String get formattedStartTime {
    final parts = startTime.split(':');
    if (parts.length < 2) return startTime;
    return '${parts[0]}:${parts[1]}';
  }
}
