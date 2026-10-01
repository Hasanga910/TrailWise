import 'package_tier.dart';
import 'vehicle_assignment.dart';

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
  final bool hasReview;
  final String? paymentStatus;
  final double? remainingAmount;
  final bool isFullyPaid;
  final bool hasPendingPayment;
  final DateTime? createdAt;

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
    this.hasReview = false,
    this.paymentStatus,
    this.remainingAmount,
    this.isFullyPaid = false,
    this.hasPendingPayment = false,
    this.createdAt,
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
        hasReview: (json['hasReview'] ?? json['HasReview'] ?? false) as bool,
        paymentStatus: json['paymentStatus'] as String? ?? json['PaymentStatus'] as String?,
        remainingAmount: json['remainingAmount'] != null
            ? (json['remainingAmount'] as num).toDouble()
            : (json['RemainingAmount'] != null ? (json['RemainingAmount'] as num).toDouble() : null),
        isFullyPaid: (json['isFullyPaid'] ?? json['IsFullyPaid'] ?? false) as bool,
        hasPendingPayment: (json['hasPendingPayment'] ?? json['HasPendingPayment'] ?? false) as bool,
        createdAt: json['createdAt'] != null
            ? DateTime.tryParse(json['createdAt'].toString())
            : (json['CreatedAt'] != null
                ? DateTime.tryParse(json['CreatedAt'].toString())
                : null),
      );
}
