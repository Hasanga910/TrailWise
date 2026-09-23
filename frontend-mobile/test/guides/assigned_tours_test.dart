import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/guides/assigned_tours_screen.dart';
import 'package:trailwise_mobile/models/assigned_tour.dart';
import 'package:trailwise_mobile/navigation/main_shell.dart';

import '../fakes/fake_api_client.dart';

class _CompleterFakeApiClient extends ApiClient {
  _CompleterFakeApiClient(this.future);
  final Future<dynamic> future;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) => future;
}

class _MockAuthProvider extends ChangeNotifier implements AuthProvider {
  _MockAuthProvider(this._user, this._apiClient);

  final CurrentUser? _user;
  final ApiClient _apiClient;

  @override
  CurrentUser? get user => _user;

  @override
  AuthStatus get status => AuthStatus.authenticated;

  @override
  ApiClient get apiClient => _apiClient;

  @override
  String? get errorMessage => null;

  @override
  Future<bool> login(String email, String password) async => true;

  @override
  Future<bool> register(String name, String email, String password) async => true;

  @override
  Future<void> restoreSession() async {}

  @override
  Future<void> logout() async {}
}

Map<String, dynamic> _sampleTourJson({
  String bookingId = 'booking-1',
  String tourPackageName = 'Cultural Heritage Tour',
  String theme = 'Cultural',
  String startDate = '2026-10-10',
  String endDate = '2026-10-12',
  int groupSize = 4,
  String status = 'Confirmed',
  List<String> locations = const ['Kandy', 'Sigiriya'],
  String? specialRequests = 'Vegetarian meals',
}) =>
    {
      'bookingId': bookingId,
      'startDate': startDate,
      'endDate': endDate,
      'groupSize': groupSize,
      'status': status,
      'tourPackageId': 'pkg-1',
      'tourPackageName': tourPackageName,
      'theme': theme,
      'locations': locations,
      'specialRequests': specialRequests,
      'guideId': 'guide-1',
      'guideName': 'Guide Alpha',
    };

void main() {
  group('AssignedTour Model', () {
    test('fromJson parses backend response correctly', () {
      final json = _sampleTourJson();
      final tour = AssignedTour.fromJson(json);

      expect(tour.bookingId, 'booking-1');
      expect(tour.startDate, '2026-10-10');
      expect(tour.endDate, '2026-10-12');
      expect(tour.groupSize, 4);
      expect(tour.status, 'Confirmed');
      expect(tour.tourPackageId, 'pkg-1');
      expect(tour.tourPackageName, 'Cultural Heritage Tour');
      expect(tour.theme, 'Cultural');
      expect(tour.locations, ['Kandy', 'Sigiriya']);
      expect(tour.specialRequests, 'Vegetarian meals');
      expect(tour.guideId, 'guide-1');
      expect(tour.guideName, 'Guide Alpha');
    });

    test('fromJson handles null specialRequests and empty locations', () {
      final json = _sampleTourJson(specialRequests: null, locations: []);
      final tour = AssignedTour.fromJson(json);

      expect(tour.specialRequests, isNull);
      expect(tour.locations, isEmpty);
    });
  });

  group('AssignedToursScreen', () {
    testWidgets('Loading state appears while request is pending', (tester) async {
      final completer = Completer<dynamic>();
      final fake = _CompleterFakeApiClient(completer.future);

      await tester.pumpWidget(MaterialApp(home: AssignedToursScreen(apiClient: fake)));
      await tester.pump(); // Render first frame before future completes

      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      completer.complete(<dynamic>[]);
      await tester.pumpAndSettle();
    });

    testWidgets('Empty response displays "No tours assigned yet"', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/guides/me/assigned-tours': <dynamic>[],
      });

      await tester.pumpWidget(MaterialApp(home: AssignedToursScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.text('No tours assigned yet'), findsOneWidget);
      expect(find.text('My Assigned Tours'), findsOneWidget);
    });

    testWidgets('Assigned tour data renders correctly on cards', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/guides/me/assigned-tours': [
          _sampleTourJson(),
        ],
      });

      await tester.pumpWidget(MaterialApp(home: AssignedToursScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.text('Cultural Heritage Tour'), findsOneWidget);
      expect(find.text('Cultural'), findsOneWidget);
      expect(find.text('Confirmed'), findsOneWidget);
      expect(find.text('2026-10-10 to 2026-10-12'), findsOneWidget);
      expect(find.text('4 travelers'), findsOneWidget);
      expect(find.text('Locations: Kandy, Sigiriya'), findsOneWidget);
      expect(find.text('Special requests: Vegetarian meals'), findsOneWidget);
    });

    testWidgets('Error state displays clear error message and Retry button', (tester) async {
      final fake = FakeApiClient(
        getError: ApiException(500, 'Server unavailable. Please try again later.'),
      );

      await tester.pumpWidget(MaterialApp(home: AssignedToursScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.text('Server unavailable. Please try again later.'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
    });
  });

  group('Navigation', () {
    testWidgets('MainShell displays Assigned Tours tab for TourGuide', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/guides/me/assigned-tours': <dynamic>[],
        '/api/packages': <dynamic>[],
      });
      final guideUser = CurrentUser(
        id: 'guide-user-1',
        name: 'Kasun Guide',
        email: 'kasun@trailwise.local',
        role: 'TourGuide',
      );
      final mockAuth = _MockAuthProvider(guideUser, fake);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: mockAuth,
          child: const MaterialApp(home: MainShell()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Assigned Tours'), findsOneWidget);
      expect(find.text('My Bookings'), findsNothing);
    });

    testWidgets('MainShell preserves My Bookings tab for Traveler', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': <dynamic>[],
          'totalCount': 0,
          'page': 1,
          'pageSize': 10,
        },
        '/api/packages': <dynamic>[],
      });
      final travelerUser = CurrentUser(
        id: 'traveler-user-1',
        name: 'Jane Traveler',
        email: 'jane@trailwise.local',
        role: 'Traveler',
      );
      final mockAuth = _MockAuthProvider(travelerUser, fake);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: mockAuth,
          child: const MaterialApp(home: MainShell()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('My Bookings'), findsOneWidget);
      expect(find.text('Assigned Tours'), findsNothing);
    });
  });
}
