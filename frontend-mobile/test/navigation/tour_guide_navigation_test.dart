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
  void updateUser(CurrentUser updated) {
    user = updated;
    notifyListeners();
  }

  @override
  Future<bool> login(String email, String password) async => true;

  @override
  Future<bool> register(String name, String email, String password) async => true;

  @override
  Future<void> restoreSession() async {}

  @override
  Future<void> logout() async {}
}

void main() {
  group('MainShell navigation', () {
    testWidgets('TourGuide bottom nav shows Dashboard, Assigned Tours, Profile; Packages is absent',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me/assigned-tours': <Map<String, dynamic>>[],
          '/api/guides/me': {
            'id': 'g-1',
            'userId': 'u-1',
            'name': 'Guide User',
            'email': 'guide@example.com',
            'contactInfo': '+94770000000',
            'languages': ['English'],
            'specializations': ['Hiking'],
          },
        },
      );

      final mockAuth = _MockAuthProvider(
        CurrentUser(id: 'u-1', name: 'Guide User', email: 'guide@example.com', role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: mockAuth,
          child: const MaterialApp(home: MainShell()),
        ),
      );
      await tester.pumpAndSettle();

      // Navigation bar destinations for TourGuide
      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('Assigned Tours'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);

      // Packages should NOT exist for TourGuide
      expect(find.text('Packages'), findsNothing);
      expect(find.text('My Bookings'), findsNothing);
    });

    testWidgets('Traveler bottom nav shows Dashboard, Packages, My Bookings (unchanged)',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/packages': <Map<String, dynamic>>[],
          '/api/bookings/my': <Map<String, dynamic>>[],
          '/api/support/tickets/mine': {
            'items': <Map<String, dynamic>>[],
            'totalCount': 0,
            'page': 1,
            'pageSize': 50,
            'totalPages': 0,
          },
        },
      );

      final mockAuth = _MockAuthProvider(
        CurrentUser(id: 'u-2', name: 'Traveler User', email: 'traveler@example.com', role: 'Traveler'),
        fakeApi,
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: mockAuth,
          child: const MaterialApp(home: MainShell()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('Packages'), findsOneWidget);
      expect(find.text('My Bookings'), findsOneWidget);

      // Profile should NOT be on Traveler navigation bar
      expect(find.text('Assigned Tours'), findsNothing);
      expect(find.text('Profile'), findsNothing);
    });
  });
}
