class PackageLocation {
  final String id;
  final String name;

  PackageLocation({required this.id, required this.name});

  factory PackageLocation.fromJson(Map<String, dynamic> json) => PackageLocation(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}
