import 'package_tier.dart';
import 'vehicle_assignment.dart';

class AssignedGuide {
  final String id;
  final String name;
  final String? contactInfo;
  final List<String> languages;
  final List<String> specializations;

  AssignedGuide({
    required this.id,
    required this.name,
    this.contactInfo,
    required this.languages,
    required this.specializations,
  });

  factory AssignedGuide.fromJson(Map<String, dynamic> json) => AssignedGuide(
        id: json['id'] as String,
        name: json['name'] as String,
        contactInfo: json['contactInfo'] as String?,
        languages: (json['languages'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        specializations: (json['specializations'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'contactInfo': contactInfo,
        'languages': languages,
        'specializations': specializations,
      };
}

class Booking {
  final String id;
  final String travelerId;
  final String tourPackageId;
  final String tourPackageName;
  final PackageTier packageTier;
  final int groupSize;
  final String startDate;
  final String endDate;
  final double budgetPerPerson;
  final String status;
  final bool isLargeGroup;
  final VehicleAssignment? vehicleAssignment;
  final AssignedGuide? assignedGuide;

  Booking({
    required this.id,
    required this.travelerId,
    required this.tourPackageId,
    required this.tourPackageName,
    required this.packageTier,
    required this.groupSize,
    required this.startDate,
    required this.endDate,
    required this.budgetPerPerson,
    required this.status,
    required this.isLargeGroup,
    this.vehicleAssignment,
    this.assignedGuide,
  });

  factory Booking.fromJson(Map<String, dynamic> json) => Booking(
        id: json['id'] as String,
        travelerId: json['travelerId'] as String,
        tourPackageId: json['tourPackageId'] as String,
        tourPackageName: json['tourPackageName'] as String,
        packageTier: PackageTier.fromJson(json['packageTier'] as Map<String, dynamic>),
        groupSize: (json['groupSize'] as num).toInt(),
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String,
        budgetPerPerson: (json['budgetPerPerson'] as num).toDouble(),
        status: json['status'] as String,
        isLargeGroup: json['isLargeGroup'] as bool,
        vehicleAssignment: json['vehicleAssignment'] != null
            ? VehicleAssignment.fromJson(json['vehicleAssignment'] as Map<String, dynamic>)
            : null,
        assignedGuide: json['assignedGuide'] != null
            ? AssignedGuide.fromJson(json['assignedGuide'] as Map<String, dynamic>)
            : null,
      );
}
