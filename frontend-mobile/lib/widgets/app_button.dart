import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum AppButtonVariant { primary, secondary, danger, ghost }

/// Button matching the web Button variants. Built on the Material buttons
/// (FilledButton / OutlinedButton / TextButton) so behaviour and test finders
/// stay the same.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.icon,
    this.loading = false,
    this.expand = false,
  });

  const AppButton.secondary({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.expand = false,
  }) : variant = AppButtonVariant.secondary;

  const AppButton.danger({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.expand = false,
  }) : variant = AppButtonVariant.danger;

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final IconData? icon;
  final bool loading;

  /// Stretch to the full available width.
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final enabled = onPressed != null && !loading;
    final VoidCallback? handler = enabled ? onPressed : null;

    final Widget child = loading
        ? const SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
          )
        : Text(label, textAlign: TextAlign.center);

    Widget button;
    switch (variant) {
      case AppButtonVariant.primary:
        button = icon == null || loading
            ? FilledButton(onPressed: handler, child: child)
            : FilledButton.icon(onPressed: handler, icon: Icon(icon, size: 18), label: Text(label));
      case AppButtonVariant.danger:
        final style = FilledButton.styleFrom(
          backgroundColor: colors.danger,
          foregroundColor: Theme.of(context).brightness == Brightness.dark
              ? colors.dangerSoft
              : Colors.white,
        );
        button = icon == null || loading
            ? FilledButton(style: style, onPressed: handler, child: child)
            : FilledButton.icon(
                style: style,
                onPressed: handler,
                icon: Icon(icon, size: 18),
                label: Text(label),
              );
      case AppButtonVariant.secondary:
        button = icon == null || loading
            ? OutlinedButton(onPressed: handler, child: child)
            : OutlinedButton.icon(onPressed: handler, icon: Icon(icon, size: 18), label: Text(label));
      case AppButtonVariant.ghost:
        button = icon == null || loading
            ? TextButton(onPressed: handler, child: child)
            : TextButton.icon(onPressed: handler, icon: Icon(icon, size: 18), label: Text(label));
    }

    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}
