class PackageTier {
  final String id;
  final String classType;
  final bool includesFood;
  final double basePricePerPerson;
  final bool requiresAC;

  PackageTier({
    required this.id,
    required this.classType,
    required this.includesFood,
    required this.basePricePerPerson,
    required this.requiresAC,
  });

  factory PackageTier.fromJson(Map<String, dynamic> json) => PackageTier(
        id: json['id'] as String,
        classType: json['classType'] as String,
        includesFood: json['includesFood'] as bool,
        basePricePerPerson: (json['basePricePerPerson'] as num).toDouble(),
        requiresAC: json['requiresAC'] as bool,
      );
}
