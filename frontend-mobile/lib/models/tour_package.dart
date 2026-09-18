import 'package_location.dart';
import 'package_tier.dart';

class TourPackage {
  final String id;
  final String name;
  final String theme;
  final int durationDays;
  final double basePricePerPerson;
  final int maxGroupSize;
  final String? photoUrl;
  final List<PackageTier> tiers;
  final List<PackageLocation> locations;

  TourPackage({
    required this.id,
    required this.name,
    required this.theme,
    required this.durationDays,
    required this.basePricePerPerson,
    required this.maxGroupSize,
    required this.photoUrl,
    required this.tiers,
    required this.locations,
  });

  factory TourPackage.fromJson(Map<String, dynamic> json) => TourPackage(
        id: json['id'] as String,
        name: json['name'] as String,
        theme: json['theme'] as String,
        durationDays: (json['durationDays'] as num).toInt(),
        basePricePerPerson: (json['basePricePerPerson'] as num).toDouble(),
        maxGroupSize: (json['maxGroupSize'] as num).toInt(),
        photoUrl: json['photoUrl'] as String?,
        tiers: (json['tiers'] as List)
            .map((t) => PackageTier.fromJson(t as Map<String, dynamic>))
            .toList(),
        locations: (json['locations'] as List)
            .map((l) => PackageLocation.fromJson(l as Map<String, dynamic>))
            .toList(),
      );
}
