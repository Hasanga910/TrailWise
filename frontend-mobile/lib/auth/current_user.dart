class CurrentUser {
  final String id;
  final String name;
  final String email;
  final String role;

  CurrentUser({required this.id, required this.name, required this.email, required this.role});

  factory CurrentUser.fromJson(Map<String, dynamic> json) => CurrentUser(
        id: json['id'] as String,
        name: json['name'] as String,
        email: json['email'] as String,
        role: json['role'] as String,
      );
}
