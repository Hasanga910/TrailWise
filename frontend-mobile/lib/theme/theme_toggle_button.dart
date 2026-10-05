import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'theme_provider.dart';

/// Sun/moon button that flips between light and dark.
class ThemeToggleButton extends StatelessWidget {
  const ThemeToggleButton({super.key});

  @override
  Widget build(BuildContext context) {
    final ThemeProvider theme;
    try {
      theme = Provider.of<ThemeProvider>(context);
    } on ProviderNotFoundException {
      // Screens pumped without the app-level provider just hide the toggle.
      return const SizedBox.shrink();
    }
    return IconButton(
      key: const Key('theme_toggle'),
      icon: Icon(theme.isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
      tooltip: theme.isDark ? 'Switch to light theme' : 'Switch to dark theme',
      onPressed: theme.toggle,
    );
  }
}
