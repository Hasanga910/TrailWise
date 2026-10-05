import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/navigation/main_shell.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';

import '../fakes/fake_api_client.dart';

class _Auth extends ChangeNotifier implements AuthProvider {
  _Auth(this.user, this._api);
  final ApiClient _api;
  @override
  CurrentUser? user;
  @override
  AuthStatus status = AuthStatus.authenticated;
  @override
  ApiClient get apiClient => _api;
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

void main() {
  testWidgets(
    'traveler bottom nav uses the web-style icons and the Home cards switch tabs',
    (tester) async {
      final api = FakeApiClient(
        getResponses: {
          '/api/packages': <dynamic>[],
          '/api/bookings/mine': {
            'items': [],
            'totalCount': 0,
            'page': 1,
            'pageSize': 10,
          },
          '/api/support/tickets/mine': {
            'items': [],
            'totalCount': 0,
            'page': 1,
            'pageSize': 50,
          },
        },
      );
      final user = CurrentUser(
        id: 'u',
        name: 'Amal Silva',
        email: 'a@x.com',
        role: 'Traveler',
      );
      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: _Auth(user, api),
          child: MaterialApp(theme: AppTheme.light, home: const MainShell()),
        ),
      );
      await tester.pumpAndSettle();

      Finder inNav(IconData icon) => find.descendant(
        of: find.byType(NavigationBar),
        matching: find.byIcon(icon),
      );

      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('Packages'), findsOneWidget);
      expect(find.text('My Bookings'), findsOneWidget);
      expect(find.text('Support'), findsOneWidget);
      expect(inNav(Icons.space_dashboard), findsOneWidget); // selected
      expect(inNav(Icons.inventory_2_outlined), findsOneWidget);
      expect(inNav(Icons.event_note_outlined), findsOneWidget);
      expect(inNav(Icons.support_outlined), findsOneWidget);
      expect(find.text('AS'), findsOneWidget); // avatar in the Home app bar

      // Quick action on Home moves to the Packages tab.
      await tester.tap(find.text('Browse Packages'));
      await tester.pumpAndSettle();
      expect(inNav(Icons.inventory_2), findsOneWidget);
      expect(inNav(Icons.space_dashboard_outlined), findsOneWidget);
    },
  );
}
