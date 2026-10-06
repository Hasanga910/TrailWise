import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/home/home_screen.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';

class _Auth extends ChangeNotifier implements AuthProvider {
  _Auth(this.user);
  @override
  CurrentUser? user;
  @override
  AuthStatus status = AuthStatus.authenticated;
  @override
  ApiClient get apiClient => ApiClient();
  @override
  String? errorMessage;
  @override
  void updateUser(CurrentUser u) {}
  @override
  Future<bool> login(String e, String p) async => true;
  @override
  Future<bool> register(String n, String e, String p) async => true;
  @override
  Future<void> restoreSession() async {}
  @override
  Future<void> logout() async {}
}

Widget _app(CurrentUser user, {ValueChanged<int>? onSelectTab, bool dark = false}) =>
    ChangeNotifierProvider<AuthProvider>.value(
      value: _Auth(user),
      child: MaterialApp(
        theme: dark ? AppTheme.dark : AppTheme.light,
        home: HomeScreen(onSelectTab: onSelectTab),
      ),
    );

final _traveler = CurrentUser(id: 'u', name: 'Amal Silva', email: 'amal@example.com', role: 'Traveler');

void main() {
  testWidgets('traveler Home shows the hero and quick actions that switch tabs', (tester) async {
    final tapped = <int>[];
    await tester.pumpWidget(_app(_traveler, onSelectTab: tapped.add));
    expect(find.text('Welcome, Amal Silva'), findsOneWidget);
    expect(find.text('Discover Sri Lanka, your way.'), findsOneWidget);
    expect(find.text('Quick actions'), findsOneWidget);

    await tester.tap(find.text('Browse Packages'));
    await tester.tap(find.text('Track your bookings'));
    await tester.tap(find.text('Get help'));
    expect(tapped, [1, 2, 3]);
  });

  testWidgets('Home has no overflow at 360 dp in light and dark, large text', (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    for (final dark in [false, true]) {
      for (final role in ['Traveler', 'TourGuide', 'Driver']) {
        await tester.pumpWidget(_app(
            CurrentUser(id: 'u', name: 'Amal Silva With A Very Long Name', email: 'amal.silva.long.address@example.com', role: role),
            dark: dark));
        await tester.pump();
        expect(tester.takeException(), isNull, reason: '$role dark=$dark');
      }
    }
  });
}
