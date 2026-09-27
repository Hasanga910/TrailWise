class Guide {
  final String id;
  final String name;
  final List<String> languages;
  final List<String> specializations;
  final String contactInfo;
  final String? userId;
  final String? createdAt;
  final String? updatedAt;

  Guide({
    required this.id,
    required this.name,
    this.languages = const [],
    this.specializations = const [],
    required this.contactInfo,
    this.userId,
    this.createdAt,
    this.updatedAt,
  });

  factory Guide.fromJson(Map<String, dynamic> json) => Guide(
        id: json['id'] as String,
        name: json['name'] as String,
        languages: (json['languages'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        specializations: (json['specializations'] as List<dynamic>?)
                ?.map((e) => e.toString())
                .toList() ??
            const [],
        contactInfo: (json['contactInfo'] as String?) ?? '',
        userId: json['userId'] as String?,
        createdAt: json['createdAt'] as String?,
        updatedAt: json['updatedAt'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'languages': languages,
        'specializations': specializations,
        'contactInfo': contactInfo,
        if (userId != null) 'userId': userId,
      };

  Guide copyWith({
    String? id,
    String? name,
    List<String>? languages,
    List<String>? specializations,
    String? contactInfo,
    String? userId,
  }) {
    return Guide(
      id: id ?? this.id,
      name: name ?? this.name,
      languages: languages ?? this.languages,
      specializations: specializations ?? this.specializations,
      contactInfo: contactInfo ?? this.contactInfo,
      userId: userId ?? this.userId,
      createdAt: createdAt,
      updatedAt: updatedAt,
    );
  }
}
