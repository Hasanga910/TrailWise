import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Holds the light/dark choice. Light by default (the phone's system setting is
/// ignored); the choice is remembered with shared_preferences.
class ThemeProvider extends ChangeNotifier {
  static const prefsKey = 'themeMode';

  ThemeMode _mode = ThemeMode.light;

  ThemeMode get mode => _mode;
  bool get isDark => _mode == ThemeMode.dark;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(prefsKey);
      final next = saved == 'dark' ? ThemeMode.dark : ThemeMode.light;
      if (next != _mode) {
        _mode = next;
        notifyListeners();
      }
    } catch (_) {
      // Storage unavailable: stay on light.
    }
  }

  Future<void> toggle() async {
    _mode = isDark ? ThemeMode.light : ThemeMode.dark;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(prefsKey, isDark ? 'dark' : 'light');
    } catch (_) {
      // Not persisted; the in-memory choice still applies.
    }
  }
}
