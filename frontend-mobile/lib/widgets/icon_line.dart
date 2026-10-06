import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Small muted icon + text row (dates, travelers, price...), as used on the
/// web cards.
class IconLine extends StatelessWidget {
  const IconLine({super.key, required this.icon, required this.label, this.color});

  final IconData icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final muted = color ?? AppColors.of(context).fgMuted;
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Icon(icon, size: 15, color: muted),
        ),
        const SizedBox(width: 6),
        Flexible(
          child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: muted)),
        ),
      ],
    );
  }
}
