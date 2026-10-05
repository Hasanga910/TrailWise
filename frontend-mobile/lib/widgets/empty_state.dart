import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Centered icon + title + hint. Scrollable so it never overflows on short
/// screens and still works inside a RefreshIndicator.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.inbox_outlined,
    this.action,
  });

  final String title;
  final String? message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final text = Theme.of(context).textTheme;
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.hasBoundedHeight ? constraints.maxHeight : 0),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: BoxDecoration(color: colors.brandSoft, shape: BoxShape.circle),
                    child: Icon(icon, size: 28, color: colors.brandText),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(title, style: text.titleMedium, textAlign: TextAlign.center),
                  if (message != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(message!, style: text.bodySmall, textAlign: TextAlign.center),
                  ],
                  if (action != null) ...[const SizedBox(height: AppSpacing.lg), action!],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
