import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/itinerary_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/package_tier.dart';

import '../fakes/fake_api_client.dart';

Booking _sampleBooking({String id = 'booking-123'}) => Booking(
      id: id,
      travelerId: 'traveler-1',
      tourPackageId: 'pkg-1',
      tourPackageName: 'Sigiriya & Dambulla Explorer',
      packageTier: PackageTier(
        id: 'tier-1',
        classType: 'Normal',
        includesFood: true,
        basePricePerPerson: 250,
        requiresAC: false,
      ),
      groupSize: 4,
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      budgetPerPerson: 300,
      status: 'Confirmed',
      isLargeGroup: false,
    );

void main() {
  group('ItineraryScreen', () {
    testWidgets('shows day-grouped steps when the itinerary has data', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/booking-123/itinerary': [
          {
            'id': 'step-2',
            'bookingId': 'booking-123',
            'dayNumber': 1,
            'activity': 'Sigiriya Rock climb',
            'location': 'Sigiriya',
            'startTime': '06:00:00',
          },
          {
            'id': 'step-1',
            'bookingId': 'booking-123',
            'dayNumber': 1,
            'activity': 'Breakfast',
            'location': 'Hotel',
            'startTime': '05:00:00',
          },
          {
            'id': 'step-3',
            'bookingId': 'booking-123',
            'dayNumber': 2,
            'activity': 'Dambulla Cave Temple',
            'location': 'Dambulla',
            'startTime': '09:00:00',
          },
        ],
      });

      await tester.pumpWidget(MaterialApp(
        home: ItineraryScreen(booking: _sampleBooking(), apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Day 1'), findsOneWidget);
      expect(find.text('Day 2'), findsOneWidget);
      expect(find.text('Breakfast'), findsOneWidget);
      expect(find.text('Sigiriya Rock climb'), findsOneWidget);
      expect(find.text('Dambulla Cave Temple'), findsOneWidget);
      expect(find.text('Itinerary details coming soon.'), findsNothing);
    });

    testWidgets('shows an empty state when no itinerary has been set', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/booking-123/itinerary': <Map<String, dynamic>>[],
      });

      await tester.pumpWidget(MaterialApp(
        home: ItineraryScreen(booking: _sampleBooking(), apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('No schedule steps have been created for this tour yet. Detailed milestones will appear here as tour dates approach.'), findsOneWidget);
    });

    testWidgets('shows an error state with a retry button on failure', (tester) async {
      final fake = FakeApiClient(
        getError: ApiException(500, 'Failed to load itinerary. Please try again.'),
      );

      await tester.pumpWidget(MaterialApp(
        home: ItineraryScreen(booking: _sampleBooking(), apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Failed to load itinerary. Please try again.'), findsOneWidget);
      expect(find.text('Retry schedule'), findsOneWidget);
    });

    testWidgets('displays assigned tour guide card with guide info when guide is assigned', (tester) async {
      final bookingWithGuide = Booking(
        id: 'booking-guide-1',
        travelerId: 'traveler-1',
        tourPackageId: 'pkg-1',
        tourPackageName: 'Sigiriya & Dambulla Explorer',
        packageTier: PackageTier(
          id: 'tier-1',
          classType: 'Normal',
          includesFood: true,
          basePricePerPerson: 250,
          requiresAC: false,
        ),
        groupSize: 2,
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        budgetPerPerson: 300,
        status: 'Confirmed',
        isLargeGroup: false,
        assignedGuide: AssignedGuide(
          id: 'guide-1',
          name: 'Janindu',
          contactInfo: '0775645000',
          languages: const ['Sinhala', 'English'],
          specializations: const ['Cultural'],
        ),
      );

      final fake = FakeApiClient(getResponses: {
        '/api/bookings/booking-guide-1/itinerary': <Map<String, dynamic>>[],
      });

      await tester.pumpWidget(MaterialApp(
        home: ItineraryScreen(booking: bookingWithGuide, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Assigned Tour Guide'), findsOneWidget);
      expect(find.text('Janindu'), findsOneWidget);
      expect(find.text('0775645000'), findsOneWidget);
      expect(find.text('Sinhala'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);
      expect(find.text('Cultural'), findsOneWidget);
    });

    testWidgets('displays Tour Guide not assigned yet when guide is null', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/booking-123/itinerary': <Map<String, dynamic>>[],
      });

      await tester.pumpWidget(MaterialApp(
        home: ItineraryScreen(booking: _sampleBooking(), apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Assigned Tour Guide'), findsOneWidget);
      expect(find.text('Tour Guide not assigned yet'), findsOneWidget);
    });
  });
}
