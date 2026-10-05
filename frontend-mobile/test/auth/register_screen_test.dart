import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/login_screen.dart';
import 'package:trailwise_mobile/auth/register_screen.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';

Widget _app(Widget home, {ThemeData? theme}) => ChangeNotifierProvider(
      create: (_) => AuthProvider(),
      child: MaterialApp(theme: theme ?? AppTheme.light, home: home),
    );

void _phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(360, 640);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

void main() {
  testWidgets('RegisterScreen renders its fields and Register button', (tester) async {
    await tester.pumpWidget(_app(const RegisterScreen()));
    expect(find.text('Create Traveler Account'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Full name'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Email'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Password'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Register'), findsOneWidget);
  });

  testWidgets('RegisterScreen shows validation errors on an empty submit', (tester) async {
    await tester.pumpWidget(_app(const RegisterScreen()));
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Register'));
    await tester.tap(find.widgetWithText(FilledButton, 'Register'));
    await tester.pump();
    expect(find.text('Name is required'), findsOneWidget);
    expect(find.text('Enter a valid email'), findsOneWidget);
    expect(find.text('Password must be at least 8 characters'), findsOneWidget);
  });

  for (final dark in [false, true]) {
    testWidgets('Login and Register fit a 360 dp phone with errors showing (dark=$dark)',
        (tester) async {
      _phone(tester);
      final theme = dark ? AppTheme.dark : AppTheme.light;
      await tester.pumpWidget(_app(const LoginScreen(), theme: theme));
      await tester.tap(find.widgetWithText(FilledButton, 'Log in'));
      await tester.pump();
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(_app(const RegisterScreen(), theme: theme));
      await tester.tap(find.widgetWithText(FilledButton, 'Register'));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  }
}
