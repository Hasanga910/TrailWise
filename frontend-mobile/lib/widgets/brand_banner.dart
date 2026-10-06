import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Brand hero surface: Sigiriya photo under a brand-teal gradient, like the
/// web hero. Falls back to the plain brand colour if the photo can't load.
class BrandBanner extends StatelessWidget {
  const BrandBanner({super.key, required this.child, this.padding = const EdgeInsets.all(AppSpacing.xl)});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Brand.c950,
      child: Stack(
        children: [
          Positioned.fill(
            child: Opacity(
              opacity: 0.55,
              child: Image.asset(
                'assets/branding/hero-sigiriya.webp',
                fit: BoxFit.cover,
                excludeFromSemantics: true,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
            ),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Brand.c950.withValues(alpha: 0.35),
                    Brand.c950.withValues(alpha: 0.9),
                  ],
                ),
              ),
            ),
          ),
          Padding(padding: padding, child: child),
        ],
      ),
    );
  }
}
