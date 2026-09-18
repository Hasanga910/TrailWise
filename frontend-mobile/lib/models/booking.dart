import 'package_tier.dart';

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
      );
}
