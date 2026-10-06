import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'app_card.dart';
import 'brand_banner.dart';
import 'logo.dart';

/// Phone version of the web auth pages: a branded hero (photo with a brand
/// gradient, wordmark and tagline) with the form in a card overlapping it.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.appBarTitle,
    required this.tagline,
    required this.heading,
    required this.child,
    this.subtitle,
    this.footer,
  });

  final String appBarTitle;
  final String tagline;
  final String heading;
  final String? subtitle;
  final Widget child;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = AppColors.of(context);
    final top = MediaQuery.paddingOf(context).top + kToolbarHeight;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(appBarTitle),
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        shape: const Border(),
        titleTextStyle: theme.textTheme.titleMedium?.copyWith(color: Colors.white),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _Hero(topInset: top, tagline: tagline),
            Transform.translate(
              offset: const Offset(0, -AppSpacing.xxl),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: AppCard(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(heading, style: theme.textTheme.displaySmall),
                        if (subtitle != null) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            subtitle!,
                            style: theme.textTheme.bodyMedium?.copyWith(color: colors.fgMuted),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.xl),
                        child,
                        if (footer != null) ...[
                          const SizedBox(height: AppSpacing.md),
                          footer!,
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
          ],
        ),
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.topInset, required this.tagline});

  final double topInset;
  final String tagline;

  @override
  Widget build(BuildContext context) {
    return BrandBanner(
      padding: EdgeInsets.fromLTRB(AppSpacing.xl, topInset + AppSpacing.sm, AppSpacing.xl, 72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Logo(height: 34, onDark: true),
          const SizedBox(height: AppSpacing.lg),
          Text(
            tagline,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
                  height: 1.25,
                ),
          ),
        ],
      ),
    );
  }
}
