import 'package:flutter/material.dart';

/// TrailWise wordmark (TW mark + "TrailWise"). Uses the white artwork in dark
/// mode, like the web Logo.
class Logo extends StatelessWidget {
  const Logo({super.key, this.height = 32, this.onDark = false});

  final double height;

  /// Force the white artwork (e.g. over a photo or brand gradient).
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final dark = onDark || Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      dark ? 'assets/branding/logo-wordmark-dark.png' : 'assets/branding/logo-wordmark.png',
      height: height,
      fit: BoxFit.contain,
      semanticLabel: 'TrailWise',
      errorBuilder: (_, _, _) => SizedBox(height: height),
    );
  }
}

/// The TW mark on its own (same artwork as the favicon).
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.height = 28, this.onDark = false});

  final double height;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final dark = onDark || Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      dark ? 'assets/branding/logo-mark-dark.png' : 'assets/branding/logo-mark.png',
      height: height,
      fit: BoxFit.contain,
      semanticLabel: 'TrailWise',
      errorBuilder: (_, _, _) => SizedBox(height: height),
    );
  }
}
