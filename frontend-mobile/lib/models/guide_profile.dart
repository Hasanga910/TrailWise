class GuideProfile {
  final String id;
  final String? userId;
  final String name;
  final String email;
  final String contactInfo;
  final List<String> languages;
  final List<String> specializations;

  GuideProfile({
    required this.id,
    this.userId,
    required this.name,
    required this.email,
    required this.contactInfo,
    this.languages = const [],
    this.specializations = const [],
  });

  factory GuideProfile.fromJson(Map<String, dynamic> json) {
    return GuideProfile(
      id: json['id'] as String,
      userId: json['userId'] as String?,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      contactInfo: json['contactInfo'] as String? ?? '',
      languages: (json['languages'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      specializations: (json['specializations'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'name': name,
        'email': email,
        'contactInfo': contactInfo,
        'languages': languages,
        'specializations': specializations,
      };
}
