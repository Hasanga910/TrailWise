class DriverAssignment {
  final String id;
  final String vehicleId;
  final String vehicleName;
  final String bookingId;
  final String driverId;
  final String driverName;
  final String driverContact;
  final String startDate;
  final String endDate;
  final String? vehicleType;
  final int? capacity;
  final bool? hasAC;
  final String? registrationNumber;
  final String? bookingStatus;
  final String? travelerName;
  final String? travelerContact;
  final String? packageName;
  final String? packageTier;
  final List<String>? itineraryHighlights;
  final String? driverLicenseNumber;
  final String? guideName;
  final String? guideContact;
  final int? groupSize;
  final String? specialRequests;
  final String? languagePreference;

  DriverAssignment({
    required this.id,
    required this.vehicleId,
    required this.vehicleName,
    required this.bookingId,
    required this.driverId,
    required this.driverName,
    required this.driverContact,
    required this.startDate,
    required this.endDate,
    this.vehicleType,
    this.capacity,
    this.hasAC,
    this.registrationNumber,
    this.bookingStatus,
    this.travelerName,
    this.travelerContact,
    this.packageName,
    this.packageTier,
    this.itineraryHighlights,
    this.driverLicenseNumber,
    this.guideName,
    this.guideContact,
    this.groupSize,
    this.specialRequests,
    this.languagePreference,
  });

  factory DriverAssignment.fromJson(Map<String, dynamic> json) => DriverAssignment(
        id: json['id'] as String,
        vehicleId: json['vehicleId'] as String,
        vehicleName: (json['vehicleName'] as String?) ?? 'Vehicle',
        bookingId: json['bookingId'] as String,
        driverId: json['driverId'] as String,
        driverName: (json['driverName'] as String?) ?? '',
        driverContact: (json['driverContact'] as String?) ?? '',
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String,
        vehicleType: json['vehicleType']?.toString(),
        capacity: (json['capacity'] as num?)?.toInt(),
        hasAC: json['hasAC'] as bool?,
        registrationNumber: json['registrationNumber'] as String?,
        bookingStatus: json['bookingStatus']?.toString(),
        travelerName: json['travelerName'] as String?,
        travelerContact: json['travelerContact'] as String?,
        packageName: json['packageName'] as String?,
        packageTier: json['packageTier'] as String?,
        itineraryHighlights: (json['itineraryHighlights'] as List<dynamic>?)
            ?.map((e) => e.toString())
            .toList(),
        driverLicenseNumber: json['driverLicenseNumber'] as String?,
        guideName: json['guideName'] as String?,
        guideContact: json['guideContact'] as String?,
        groupSize: (json['groupSize'] as num?)?.toInt(),
        specialRequests: json['specialRequests'] as String?,
        languagePreference: json['languagePreference'] as String?,
      );
}
