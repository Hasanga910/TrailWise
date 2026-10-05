import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';
import 'package:trailwise_mobile/theme/theme_provider.dart';
import 'package:trailwise_mobile/theme/theme_toggle_button.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('defaults to light and ignores nothing saved', () async {
    final p = ThemeProvider();
    await p.load();
    expect(p.mode, ThemeMode.light);
  });

  test('toggle flips the mode and persists it', () async {
    final p = ThemeProvider();
    await p.toggle();
    expect(p.mode, ThemeMode.dark);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString(ThemeProvider.prefsKey), 'dark');

    final restored = ThemeProvider();
    await restored.load();
    expect(restored.mode, ThemeMode.dark);
  });

  testWidgets('toggle button switches icon and tooltip', (tester) async {
    final provider = ThemeProvider();
    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: provider,
        child: MaterialApp(
          theme: AppTheme.light,
          home: const Scaffold(body: ThemeToggleButton()),
        ),
      ),
    );
    expect(find.byIcon(Icons.dark_mode_outlined), findsOneWidget);
    await tester.tap(find.byKey(const Key('theme_toggle')));
    await tester.pump();
    expect(provider.isDark, isTrue);
    expect(find.byIcon(Icons.light_mode_outlined), findsOneWidget);
  });

  testWidgets('toggle button is hidden without a ThemeProvider', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(body: ThemeToggleButton())));
    expect(find.byKey(const Key('theme_toggle')), findsNothing);
  });

  test('light and dark themes use the web brand colours', () {
    expect(AppTheme.light.colorScheme.primary, Brand.c700);
    expect(AppTheme.dark.colorScheme.primary, Brand.c500);
    expect(AppTheme.light.extension<AppColors>()!.surface, const Color(0xFFFFFFFF));
    expect(AppTheme.dark.extension<AppColors>()!.surface, const Color(0xFF0E1513));
  });
}
