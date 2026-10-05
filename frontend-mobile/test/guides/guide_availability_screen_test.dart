import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/guides/assigned_tours_screen.dart';
import 'package:trailwise_mobile/guides/guide_availability_screen.dart';
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
  Future<bool> register(String name, String email, String password) async => true;

  @override
  Future<void> restoreSession() async {}

  @override
  void updateUser(CurrentUser updatedUser) {
    user = updatedUser;
    notifyListeners();
  }

  @override
  Future<void> logout() async {}
}

void main() {
  group('Guide Availability Screen Tests', () {
    testWidgets('1. Availability screen renders month and header', (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/g-1/availability': <Map<String, dynamic>>[],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: GuideAvailabilityScreen(
            apiClient: fakeApi,
            guideId: 'g-1',
            initialDate: DateTime(2026, 10, 1),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Guide Availability'), findsOneWidget);
      expect(find.text('October 2026'), findsOneWidget);
      expect(find.text('Sun'), findsOneWidget);
      expect(find.text('Mon'), findsOneWidget);
    });

    testWidgets('2. Previous month navigation works', (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/g-1/availability': <Map<String, dynamic>>[],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: GuideAvailabilityScreen(
            apiClient: fakeApi,
            guideId: 'g-1',
            initialDate: DateTime(2026, 10, 1),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('October 2026'), findsOneWidget);

      await tester.tap(find.byKey(const Key('prev_month_button')));
      await tester.pumpAndSettle();

      expect(find.text('September 2026'), findsOneWidget);
    });

    testWidgets('3. Next month navigation works', (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/g-1/availability': <Map<String, dynamic>>[],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: GuideAvailabilityScreen(
            apiClient: fakeApi,
            guideId: 'g-1',
            initialDate: DateTime(2026, 10, 1),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('October 2026'), findsOneWidget);

      await tester.tap(find.byKey(const Key('next_month_button')));
      await tester.pumpAndSettle();

      expect(find.text('November 2026'), findsOneWidget);
    });

    testWidgets('4 & 5 & 6. Available, Unavailable, and Booked days render correctly',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/g-1/availability': [
            {
              'id': 'av-10',
              'guideId': 'g-1',
              'date': '2026-10-10',
              'isAvailable': false,
              'assignedBookingId': null,
            },
            {
              'id': 'av-12',
              'guideId': 'g-1',
              'date': '2026-10-12',
              'isAvailable': true,
              'assignedBookingId': 'booking-999',
            },
          ],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: GuideAvailabilityScreen(
            apiClient: fakeApi,
            guideId: 'g-1',
            initialDate: DateTime(2026, 10, 1),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 4. Default date (day 5 without record) is Available
      final day5 = find.byKey(const Key('day_2026-10-05'));
      expect(day5, findsOneWidget);
      expect(
        find.descendant(of: day5, matching: find.text('Available')),
        findsOneWidget,
      );

      // 5. Day 10 is Unavailable
      final day10 = find.byKey(const Key('day_2026-10-10'));
      expect(day10, findsOneWidget);
      expect(
        find.descendant(of: day10, matching: find.text('Unavailable')),
        findsOneWidget,
      );

      // 6. Day 12 is Booked with lock icon
      final day12 = find.byKey(const Key('day_2026-10-12'));
      expect(day12, findsOneWidget);
      expect(
        find.descendant(of: day12, matching: find.text('Booked')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: day12, matching: find.byIcon(Icons.lock)),
        findsOneWidget,
      );
    });

    testWidgets('7 & 10. Tapping editable day changes availability and refreshes state',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/g-1/availability': <Map<String, dynamic>>[],
        },
        putResponses: {
          '/api/guides/g-1/availability': [
            {
              'id': 'av-15',
              'guideId': 'g-1',
              'date': '2026-10-15',
              'isAvailable': false,
              'assignedBookingId': null,
            },
          ],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: GuideAvailabilityScreen(
            apiClient: fakeApi,
            guideId: 'g-1',
            initialDate: DateTime(2026, 10, 1),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Day 15 is initially Available (default)
      final day15 = find.byKey(const Key('day_2026-10-15'));
      expect(
        find.descendant(of: day15, matching: find.text('Available')),
        findsOneWidget,
      );

      // Tap day 15 to mark Unavailable
      await tester.tap(day15);
      await tester.pumpAndSettle();

      // Verified put call
      expect(fakeApi.putCalls.length, 1);
      expect(fakeApi.putCalls.first['path'], '/api/guides/g-1/availability');
      final body = fakeApi.putCalls.first['body'] as Map<String, dynamic>;
      expect(body['dates'], [
        {'date': '2026-10-15', 'isAvailable': false}
      ]);

      // Calendar state refreshed to Unavailable
      expect(
        find.descendant(of: day15, matching: find.text('Unavailable')),
        findsOneWidget,
      );
      expect(find.text('Date 2026-10-15 marked as Unavailable.'), findsOneWidget);
    });

    testWidgets('8. Booked day cannot be changed and shows notice', (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/g-1/availability': [
            {
              'id': 'av-12',
              'guideId': 'g-1',
              'date': '2026-10-12',
              'isAvailable': true,
              'assignedBookingId': 'booking-777',
            },
          ],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: GuideAvailabilityScreen(
            apiClient: fakeApi,
            guideId: 'g-1',
            initialDate: DateTime(2026, 10, 1),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final day12 = find.byKey(const Key('day_2026-10-12'));
      await tester.tap(day12);
      await tester.pumpAndSettle();

      // No PUT request sent
      expect(fakeApi.putCalls.isEmpty, isTrue);

      // Booked notice shown
      expect(
        find.text('Date 2026-10-12 is booked and cannot be changed.'),
        findsOneWidget,
      );
    });

    testWidgets('9. Save/API error displays cleanly in SnackBar', (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/g-1/availability': <Map<String, dynamic>>[],
        },
        putError: ApiException(500, 'Server update error'),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: GuideAvailabilityScreen(
            apiClient: fakeApi,
            guideId: 'g-1',
            initialDate: DateTime(2026, 10, 1),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final day15 = find.byKey(const Key('day_2026-10-15'));
      await tester.tap(day15);
      await tester.pumpAndSettle();

      expect(find.text('Server update error'), findsOneWidget);
    });

    testWidgets('11. Bottom nav opens Availability', (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me/assigned-tours': <Map<String, dynamic>>[],
          '/api/guides/me': {
            'id': 'g-1',
            'userId': 'u-1',
            'name': 'Guide User',
            'email': 'guide@trailwise.local',
            'contactInfo': '+94770000000',
            'languages': ['English'],
            'specializations': ['Hiking'],
          },
          '/api/guides/g-1/availability': <Map<String, dynamic>>[],
        },
      );

      final auth = _MockAuthProvider(
        CurrentUser(
          id: 'u-1',
          name: 'Guide User',
          email: 'guide@trailwise.local',
          role: 'TourGuide',
        ),
        fakeApi,
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: const MaterialApp(home: MainShell()),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Availability tab in navigation bar
      await tester.tap(
        find.descendant(of: find.byType(NavigationBar), matching: find.text('Availability')),
      );
      await tester.pumpAndSettle();

      // Availability screen is active
      expect(find.byType(GuideAvailabilityScreen), findsOneWidget);
      expect(find.text('Guide Availability'), findsOneWidget);
    });

    testWidgets('12. Existing assigned tour data is not broken', (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me/assigned-tours': [
            {
              'bookingId': 'bk-55',
              'startDate': '2026-11-01',
              'endDate': '2026-11-03',
              'groupSize': 2,
              'status': 'Confirmed',
              'tourPackageId': 'pkg-1',
              'tourPackageName': 'Ella Rock Hiking Expedition',
              'theme': 'Adventure',
              'locations': ['Ella'],
              'specialRequests': null,
              'guideId': 'g-1',
              'guideName': 'Guide User',
              'attended': false,
              'completed': false,
              'guideNotes': null,
              'tourStartedAt': null,
              'tourEndedAt': null,
              'paymentStatus': 'Paid',
              'isAdvancePaid': true,
            },
          ],
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: AssignedToursScreen(apiClient: fakeApi),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Ella Rock Hiking Expedition'), findsOneWidget);
      expect(find.text('Confirmed'), findsOneWidget);
    });
  });
}
