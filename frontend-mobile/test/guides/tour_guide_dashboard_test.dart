import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/guides/guide_availability_screen.dart';
import 'package:trailwise_mobile/guides/tour_guide_dashboard.dart';
import 'package:trailwise_mobile/home/home_screen.dart';

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

Map<String, dynamic> _makeTour({
  required String bookingId,
  required String tourPackageName,
  required String startDate,
  required String endDate,
  String status = 'Confirmed',
  String? tourStartedAt,
  String? tourEndedAt,
}) =>
    {
      'bookingId': bookingId,
      'startDate': startDate,
      'endDate': endDate,
      'groupSize': 4,
      'status': status,
      'tourPackageId': 'pkg-1',
      'tourPackageName': tourPackageName,
      'theme': 'Cultural',
      'locations': ['Sigiriya', 'Kandy'],
      'specialRequests': null,
      'guideId': 'guide-1',
      'guideName': 'Janidu Kasuntha',
      'attended': false,
      'completed': false,
      'guideNotes': null,
      'tourStartedAt': tourStartedAt,
      'tourEndedAt': tourEndedAt,
      'paymentStatus': 'Paid',
      'isAdvancePaid': true,
    };

void main() {
  group('TourGuide Dashboard Tests', () {
    testWidgets('1 & 2 & 3. TourGuide dashboard renders with guide name and upcoming count',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me/assigned-tours': [
            _makeTour(
              bookingId: 'b-1',
              tourPackageName: 'Ancient Kingdoms Explorer',
              startDate: '2026-11-10',
              endDate: '2026-11-14',
            ),
            _makeTour(
              bookingId: 'b-2',
              tourPackageName: 'Hill Country Tea Trail',
              startDate: '2026-11-20',
              endDate: '2026-11-25',
            ),
          ],
        },
      );

      final auth = _MockAuthProvider(
        CurrentUser(
          id: 'u-1',
          name: 'Janidu Kasuntha',
          email: 'guide@trailwise.local',
          role: 'TourGuide',
        ),
        fakeApi,
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: MaterialApp(
            home: HomeScreen(apiClient: fakeApi),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Dashboard renders
      expect(find.byType(TourGuideDashboard), findsOneWidget);

      // Logged-in guide name shown
      expect(find.text('Welcome back, Janidu Kasuntha'), findsOneWidget);

      // Upcoming tour count shown
      expect(find.text('2 upcoming assigned tours'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
    });

    testWidgets('4 & 5 & 6. Quick Action buttons are visible with titles and descriptions',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me/assigned-tours': <Map<String, dynamic>>[],
        },
      );

      final auth = _MockAuthProvider(
        CurrentUser(
          id: 'u-1',
          name: 'Janidu Kasuntha',
          email: 'guide@trailwise.local',
          role: 'TourGuide',
        ),
        fakeApi,
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: MaterialApp(
            home: HomeScreen(apiClient: fakeApi),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 4. My Assigned Tours action visible
      expect(find.text('My Assigned Tours'), findsOneWidget);
      expect(find.text('View upcoming and active tours'), findsOneWidget);

      // 5. Guide Availability action visible
      expect(find.text('Guide Availability'), findsOneWidget);
      expect(find.text('Manage the days you are available'), findsOneWidget);

      // 6. Profile action visible
      expect(find.text('Profile'), findsOneWidget);
      expect(find.text('Update guide details and preferences'), findsOneWidget);
    });

    testWidgets('7. Dashboard Guide Availability action opens Availability screen',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me/assigned-tours': <Map<String, dynamic>>[],
          '/api/guides/me': {
            'id': 'g-1',
            'userId': 'u-1',
            'name': 'Janidu Kasuntha',
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
          name: 'Janidu Kasuntha',
          email: 'guide@trailwise.local',
          role: 'TourGuide',
        ),
        fakeApi,
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: MaterialApp(
            home: HomeScreen(apiClient: fakeApi),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Tap Guide Availability action
      final availabilityAction = find.byKey(const Key('action_guide_availability'));
      expect(availabilityAction, findsOneWidget);
      await tester.ensureVisible(availabilityAction);
      await tester.tap(availabilityAction);
      await tester.pumpAndSettle();

      // Opened Availability screen
      expect(find.byType(GuideAvailabilityScreen), findsOneWidget);
      expect(find.text('Guide Availability'), findsOneWidget);
    });

    testWidgets('8. Next Tour preview works when an upcoming tour exists',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me/assigned-tours': [
            _makeTour(
              bookingId: 'b-10',
              tourPackageName: 'Yala Safari Adventure',
              startDate: '2026-10-15',
              endDate: '2026-10-18',
              status: 'Confirmed',
            ),
          ],
        },
      );

      final auth = _MockAuthProvider(
        CurrentUser(
          id: 'u-1',
          name: 'Janidu Kasuntha',
          email: 'guide@trailwise.local',
          role: 'TourGuide',
        ),
        fakeApi,
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: MaterialApp(
            home: HomeScreen(apiClient: fakeApi),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Next Tour section renders with tour details
      expect(find.text('Next Tour'), findsOneWidget);
      expect(find.text('Yala Safari Adventure'), findsWidgets);
      expect(find.text('2026-10-15 — 2026-10-18'), findsOneWidget);
      expect(find.text('4 guests'), findsOneWidget);
    });

    testWidgets('9. Empty state appears when there are no tours', (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me/assigned-tours': <Map<String, dynamic>>[],
        },
      );

      final auth = _MockAuthProvider(
        CurrentUser(
          id: 'u-1',
          name: 'Janidu Kasuntha',
          email: 'guide@trailwise.local',
          role: 'TourGuide',
        ),
        fakeApi,
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: MaterialApp(
            home: HomeScreen(apiClient: fakeApi),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 0 upcoming tours and empty state shown
      expect(find.text('0 upcoming assigned tours'), findsOneWidget);
      expect(find.text('No upcoming tours'), findsOneWidget);
      expect(
        find.text('You currently have no upcoming assigned tours.'),
        findsOneWidget,
      );
    });

    testWidgets('10. No Traveler/Fleet/Ops/Admin controls appear on TourGuide dashboard',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me/assigned-tours': <Map<String, dynamic>>[],
        },
      );

      final auth = _MockAuthProvider(
        CurrentUser(
          id: 'u-1',
          name: 'Janidu Kasuntha',
          email: 'guide@trailwise.local',
          role: 'TourGuide',
        ),
        fakeApi,
      );

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: auth,
          child: MaterialApp(
            home: HomeScreen(apiClient: fakeApi),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify no traveler or driver controls
      expect(find.text('Packages'), findsNothing);
      expect(find.text('My Bookings'), findsNothing);
      expect(find.text('My Driving Tasks'), findsNothing);
      expect(find.text('Driver Profile & Settings'), findsNothing);
      expect(find.text('Fleet'), findsNothing);
      expect(find.text('Operations'), findsNothing);
    });
  });
}
