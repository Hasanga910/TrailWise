import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/bookings/itinerary_screen.dart';

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

  final travelerUser = CurrentUser(
    id: 'user-traveler-1',
    name: 'Traveler John',
    email: 'john@gmail.com',
    role: 'Traveler',
  );

  final sampleSteps = [
    {
      'id': 'step-1',
      'bookingId': 'booking-1',
      'dayNumber': 1,
      'activity': 'Ella Rock Morning Hike',
      'location': 'Ella Rock',
      'startTime': '08:30:00',
    },
    {
      'id': 'step-2',
      'bookingId': 'booking-1',
      'dayNumber': 1,
      'activity': 'Nine Arches Bridge Train Viewing',
      'location': 'Nine Arches',
      'startTime': '15:00:00',
    },
  ];

  group('ItineraryScreen', () {
    testWidgets('TourGuide loads steps and can save updated itinerary',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/bookings/booking-1/itinerary': sampleSteps,
        },
        postResponses: {
          '/api/bookings/booking-1/itinerary': sampleSteps,
        },
      );

      final authProvider = _MockAuthProvider(guideUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: ItineraryScreen(
              bookingId: 'booking-1',
              title: 'Ella Trek Itinerary',
              apiClient: fakeApi,
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Ella Trek Itinerary'), findsOneWidget);
      expect(find.text('Ella Rock Morning Hike'), findsOneWidget);
      expect(find.text('Nine Arches Bridge Train Viewing'), findsOneWidget);
      expect(find.byType(FloatingActionButton), findsOneWidget);
      expect(find.text('Save'), findsOneWidget);

      // Tap Save
      await tester.tap(find.text('Save'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(fakeApi.postCalls.length, 1);
      expect(fakeApi.postCalls.first['path'], '/api/bookings/booking-1/itinerary');
      expect(find.text('Itinerary saved successfully'), findsOneWidget);
    });

    testWidgets('Traveler sees read-only itinerary view with no edit controls',
        (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/bookings/booking-1/itinerary': sampleSteps,
        },
      );

      final authProvider = _MockAuthProvider(travelerUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: ItineraryScreen(
              bookingId: 'booking-1',
              title: 'Traveler View Itinerary',
              apiClient: fakeApi,
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Ella Rock Morning Hike'), findsOneWidget);
      expect(find.byType(FloatingActionButton), findsNothing);
      expect(find.text('Save'), findsNothing);
      expect(find.byIcon(Icons.delete_outline), findsNothing);
    });
  });
}
