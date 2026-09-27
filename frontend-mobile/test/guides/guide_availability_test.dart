import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/guides/guide_availability_screen.dart';
import 'package:trailwise_mobile/models/guide.dart';

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
  final guideUser = CurrentUser(
    id: 'user-guide-1',
    name: 'Kasun Guide',
    email: 'kasun@trailwise.com',
    role: 'TourGuide',
  );

  final opsUser = CurrentUser(
    id: 'user-ops',
    name: 'Ops Manager',
    email: 'ops@trailwise.com',
    role: 'OperationsManager',
  );

  final guide1 = Guide(
    id: 'guide-1',
    name: 'Kasun Perera',
    contactInfo: '+94 77 123 4567',
    userId: 'user-guide-1',
  );

  group('GuideAvailabilityScreen', () {
    testWidgets('TourGuide loads own availability and toggles a date',
        (tester) async {
      final now = DateTime.now();
      final dateKey =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-15';

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides': [guide1.toJson()],
          '/api/guides/guide-1/availability': [
            {
              'id': 'av-1',
              'guideId': 'guide-1',
              'date': dateKey,
              'isAvailable': true,
              'assignedBookingId': null,
            },
          ],
        },
        putResponses: {
          '/api/guides/guide-1/availability': [
            {
              'id': 'av-1',
              'guideId': 'guide-1',
              'date': dateKey,
              'isAvailable': false,
              'assignedBookingId': null,
            },
          ],
        },
      );

      final authProvider = _MockAuthProvider(guideUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: GuideAvailabilityScreen(apiClient: fakeApi),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('My Availability'), findsOneWidget);
      expect(find.text('Available'), findsOneWidget);

      // Tap on day 15 to toggle
      await tester.tap(find.text('15'));
      await tester.pump();

      // Pending changes bar should appear
      expect(find.textContaining('unsaved date change'), findsOneWidget);

      // Save changes
      await tester.tap(find.text('Save Changes'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(fakeApi.putCalls.length, 1);
      expect(fakeApi.putCalls.first['path'], '/api/guides/guide-1/availability');
    });

    testWidgets('OperationsManager can view selected guide availability',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides': [guide1.toJson()],
          '/api/guides/guide-1/availability': [],
        },
      );

      final authProvider = _MockAuthProvider(opsUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: GuideAvailabilityScreen(
              selectedGuide: guide1,
              apiClient: fakeApi,
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Guide Availability'), findsOneWidget);
      expect(find.text('Kasun Perera'), findsOneWidget);
    });
  });
}
