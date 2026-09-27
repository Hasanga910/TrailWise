import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/navigation/main_shell.dart';

import '../fakes/fake_api_client.dart';

class _MockAuthProvider extends ChangeNotifier implements AuthProvider {
  _MockAuthProvider(this.user, this._apiClient);

  final ApiClient _apiClient;

  @override
  CurrentUser? user;

  @override
  AuthStatus status = AuthStatus.authenticated;

  @override
  ApiClient get apiClient => _apiClient;

  @override
  String? errorMessage;

  @override
  Future<bool> login(String email, String password) async => true;

  @override
  Future<bool> register(String name, String email, String password) async =>
      true;

  @override
  Future<void> restoreSession() async {}

  @override
  Future<void> logout() async {}
}

void main() {
  testWidgets('TourGuide sees Home, Assigned Tours, and Availability tabs',
      (tester) async {
    final guideUser = CurrentUser(
      id: 'guide-1',
      name: 'Guide Kasun',
      email: 'guide@trailwise.com',
      role: 'TourGuide',
    );
    final fakeApi = FakeApiClient(
      getResponses: {
        '/api/guides/me/assigned-tours': [],
        '/api/guides': [],
      },
    );
    final authProvider = _MockAuthProvider(guideUser, fakeApi);

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthProvider>.value(
        value: authProvider,
        child: const MaterialApp(home: MainShell()),
      ),
    );

    await tester.pump();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Assigned Tours'), findsOneWidget);
    expect(find.text('Availability'), findsOneWidget);
    expect(find.text('Guides'), findsNothing);
    expect(find.text('Itineraries'), findsNothing);
    expect(find.text('Packages'), findsNothing);
    expect(find.text('My Bookings'), findsNothing);
  });

  testWidgets(
      'OperationsManager sees Home, Guides, Availability, and Itineraries tabs',
      (tester) async {
    final opsUser = CurrentUser(
      id: 'ops-1',
      name: 'Ops Manager',
      email: 'ops@trailwise.com',
      role: 'OperationsManager',
    );
    final fakeApi = FakeApiClient(
      getResponses: {
        '/api/guides': [],
      },
    );
    final authProvider = _MockAuthProvider(opsUser, fakeApi);

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthProvider>.value(
        value: authProvider,
        child: const MaterialApp(home: MainShell()),
      ),
    );

    await tester.pump();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Guides'), findsOneWidget);
    expect(find.text('Availability'), findsOneWidget);
    expect(find.text('Itineraries'), findsOneWidget);
    expect(find.text('Assigned Tours'), findsNothing);
    expect(find.text('My Bookings'), findsNothing);
  });

  testWidgets('Traveler sees Dashboard, Packages, and My Bookings tabs',
      (tester) async {
    final travelerUser = CurrentUser(
      id: 'traveler-1',
      name: 'Traveler John',
      email: 'john@trailwise.com',
      role: 'Traveler',
    );
    final fakeApi = FakeApiClient(
      getResponses: {
        '/api/packages': [],
        '/api/bookings/mine': {'items': [], 'totalCount': 0, 'page': 1, 'pageSize': 10},
      },
    );
    final authProvider = _MockAuthProvider(travelerUser, fakeApi);

    await tester.pumpWidget(
      ChangeNotifierProvider<AuthProvider>.value(
        value: authProvider,
        child: const MaterialApp(home: MainShell()),
      ),
    );

    await tester.pump();

    expect(find.text('Dashboard'), findsOneWidget);
    expect(find.text('Packages'), findsOneWidget);
    expect(find.text('My Bookings'), findsOneWidget);
    expect(find.text('Guides'), findsNothing);
    expect(find.text('Assigned Tours'), findsNothing);
  });
}
