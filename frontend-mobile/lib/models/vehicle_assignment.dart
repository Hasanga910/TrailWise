class VehicleAssignment {
  final String id;
  final String vehicleId;
  final String vehicleName;
  final String bookingId;
  final String driverId;
  final String driverName;
  final String driverContact;
  final String startDate;
  final String endDate;
  final String createdAt;
  final String updatedAt;
  final String? vehicleType;
  final int? capacity;
  final bool? hasAC;
  final String? registrationNumber;
  final String? guideName;
  final String? guideContact;
  final String? specialRequests;

  VehicleAssignment({
    required this.id,
    required this.vehicleId,
    required this.vehicleName,
    required this.bookingId,
    required this.driverId,
    required this.driverName,
    required this.driverContact,
    required this.startDate,
    required this.endDate,
    required this.createdAt,
    required this.updatedAt,
    this.vehicleType,
    this.capacity,
    this.hasAC,
    this.registrationNumber,
    this.guideName,
    this.guideContact,
    this.specialRequests,
  });

  factory VehicleAssignment.fromJson(Map<String, dynamic> json) => VehicleAssignment(
        id: json['id'] as String,
        vehicleId: json['vehicleId'] as String,
        vehicleName: json['vehicleName'] as String? ?? 'Vehicle',
        bookingId: json['bookingId'] as String,
        driverId: json['driverId'] as String,
        driverName: json['driverName'] as String? ?? 'Driver',
        driverContact: json['driverContact'] as String? ?? '',
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String,
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
        vehicleType: json['vehicleType'] as String?,
        capacity: (json['capacity'] as num?)?.toInt(),
        hasAC: json['hasAC'] as bool?,
        registrationNumber: json['registrationNumber'] as String?,
        guideName: json['guideName'] as String?,
        guideContact: json['guideContact'] as String?,
        specialRequests: json['specialRequests'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'vehicleId': vehicleId,
        'vehicleName': vehicleName,
        'bookingId': bookingId,
        'driverId': driverId,
        'driverName': driverName,
        'driverContact': driverContact,
        'startDate': startDate,
        'endDate': endDate,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
        if (vehicleType != null) 'vehicleType': vehicleType,
        if (capacity != null) 'capacity': capacity,
        if (hasAC != null) 'hasAC': hasAC,
      };
}
