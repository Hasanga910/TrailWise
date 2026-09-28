import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:trailwise_mobile/bookings/itinerary_screen.dart';
import 'package:trailwise_mobile/bookings/transport_info_card.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/package_tier.dart';
import 'package:trailwise_mobile/models/vehicle_assignment.dart';

import '../fakes/fake_api_client.dart';

Booking _testBooking() => Booking(
      id: 'booking-123',
      travelerId: 'traveler-abc',
      tourPackageId: 'pkg-456',
      tourPackageName: 'Ceylon Highlands & Tea Trail',
      packageTier: PackageTier(
        id: 'tier-1',
        classType: 'Luxury',
        includesFood: true,
        basePricePerPerson: 450,
        requiresAC: true,
      ),
      groupSize: 4,
      startDate: '2026-11-01',
      endDate: '2026-11-05',
      budgetPerPerson: 500,
      status: 'Confirmed',
      isLargeGroup: false,
    );

Map<String, dynamic> _assignedJson() => {
      'id': 'assign-1',
      'vehicleId': 'veh-99999999-1111',
      'vehicleName': 'Toyota KDH Commuter (8 seats)',
      'bookingId': 'booking-123',
      'driverId': 'drv-1',
      'driverName': 'Sunil Perera',
      'driverContact': '+94771234567',
      'startDate': '2026-11-01',
      'endDate': '2026-11-05',
      'createdAt': '2026-10-20T10:00:00Z',
      'updatedAt': '2026-10-20T10:00:00Z',
      'vehicleType': 'Van',
      'capacity': 8,
      'hasAC': true,
    };

void main() {
  group('TransportInfoCard', () {
    testWidgets('renders assigned vehicle and driver details when assignment is present', (tester) async {
      final assignment = VehicleAssignment.fromJson(_assignedJson());

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: TransportInfoCard(assignment: assignment),
          ),
        ),
      );

      // Verify allocated badge and specs
      expect(find.text('Assigned Transport'), findsOneWidget);
      expect(find.text('Allocated'), findsOneWidget);
      expect(find.text('Toyota KDH Commuter (8 seats)'), findsOneWidget);
      expect(find.text('Van'), findsOneWidget);
      expect(find.text('Air Conditioned (AC)'), findsOneWidget);
      expect(find.text('8 Seats'), findsOneWidget);

      // Verify driver info and contact
      expect(find.text('Sunil Perera'), findsOneWidget);
      expect(find.text('+94771234567'), findsOneWidget);
      expect(find.byIcon(Icons.phone), findsOneWidget);
    });

    testWidgets('renders graceful pending allocation notice when assignment is null', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TransportInfoCard(assignment: null),
          ),
        ),
      );

      expect(find.text('Transport Allocation Pending'), findsOneWidget);
      expect(
        find.text('Our coordinator is assigning your fleet'),
        findsOneWidget,
      );
    });

    testWidgets('renders loading state indicator when isLoading is true', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: TransportInfoCard(assignment: null, isLoading: true),
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });

  group('ItineraryScreen Integration', () {
    testWidgets('fetches and displays assigned transport card on load', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/vehicles/assignments/by-booking/booking-123': _assignedJson(),
      });

      await tester.pumpWidget(
        MaterialApp(
          home: ItineraryScreen(
            booking: _testBooking(),
            apiClient: fake,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.textContaining('Ceylon Highlands & Tea Trail'), findsWidgets);
      expect(find.text('Assigned Transport'), findsOneWidget);
      expect(find.text('Sunil Perera'), findsOneWidget);
      expect(find.text('Toyota KDH Commuter (8 seats)'), findsOneWidget);
    });

    testWidgets('gracefully shows pending card when no assignment exists (404/empty)', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/vehicles/assignments/by-booking/booking-123': null,
      });

      await tester.pumpWidget(
        MaterialApp(
          home: ItineraryScreen(
            booking: _testBooking(),
            apiClient: fake,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Transport Allocation Pending'), findsOneWidget);
    });
  });
}
