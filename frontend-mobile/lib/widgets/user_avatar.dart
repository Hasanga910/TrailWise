import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Round brand-coloured avatar with the user's initials (web header chip).
class UserAvatar extends StatelessWidget {
  const UserAvatar({super.key, required this.name, this.radius = 16});

  final String name;
  final double radius;

  static String initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      label: name,
      excludeSemantics: true,
      child: Container(
        width: radius * 2,
        height: radius * 2,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: dark ? [Brand.c500, Brand.c700] : [Brand.c600, Brand.c800],
          ),
        ),
        child: Text(
          initials(name),
          style: TextStyle(
            color: Colors.white,
            fontSize: radius * 0.75,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
