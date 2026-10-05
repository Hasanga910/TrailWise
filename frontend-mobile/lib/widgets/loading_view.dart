import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Centered progress indicator.
class LoadingView extends StatelessWidget {
  const LoadingView({super.key});

  @override
  Widget build(BuildContext context) =>
      const Center(child: CircularProgressIndicator());
}

/// Placeholder rows for list screens that want a skeleton instead of a spinner.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 4, this.height = 88});

  final int count;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      padding: AppSpacing.page,
      itemCount: count,
      separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.md),
      itemBuilder: (_, _) => Container(
        height: height,
        decoration: BoxDecoration(
          color: colors.neutralSoft,
          borderRadius: BorderRadius.circular(AppRadius.card),
        ),
      ),
    );
  }
}
