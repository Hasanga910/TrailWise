import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/itinerary_screen.dart';
import 'package:trailwise_mobile/bookings/payment_status_screen.dart';
import 'package:trailwise_mobile/bookings/review_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/package_tier.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';

import '../fakes/fake_api_client.dart';

Booking _booking(String status) => Booking(
      id: 'booking-1',
      travelerId: 't',
      tourPackageId: 'pkg',
      tourPackageName: 'The Extraordinarily Long Cultural Triangle Explorer Experience',
      packageTier: PackageTier(
        id: 'tier',
        classType: 'Luxury Deluxe',
        includesFood: true,
        basePricePerPerson: 450,
        requiresAC: true,
      ),
      groupSize: 4,
      startDate: '2030-11-01',
      endDate: '2030-11-05',
      budgetPerPerson: 500,
      status: status,
      isLargeGroup: false,
      isFullyPaid: true,
    );

void _phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(360, 640);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = 1.3;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

Widget _app(Widget home, bool dark) =>
    MaterialApp(theme: dark ? AppTheme.dark : AppTheme.light, home: home);

void main() {
  for (final dark in [false, true]) {
    final tag = dark ? 'dark' : 'light';

    testWidgets('ItineraryScreen fits 360 dp ($tag)', (tester) async {
      _phone(tester);
      final api = FakeApiClient(getResponses: {
        '/api/bookings/booking-1/itinerary': [
          {
            'id': 's1',
            'bookingId': 'booking-1',
            'dayNumber': 1,
            'activity': 'Climb Sigiriya Rock Fortress at sunrise with the guide',
            'location': 'Sigiriya Rock Fortress, Central Province',
            'startTime': '06:30',
          },
        ],
      });
      await tester.pumpWidget(_app(
          ItineraryScreen(booking: _booking('NeedsManualReview'), apiClient: api), dark));
      await tester.pumpAndSettle();
      expect(find.text('Needs Manual Review'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('ItineraryScreen empty and error schedule states ($tag)', (tester) async {
      _phone(tester);
      await tester.pumpWidget(_app(
          ItineraryScreen(
              booking: _booking('Confirmed'),
              apiClient: FakeApiClient(getResponses: {'/api/bookings/booking-1/itinerary': []})),
          dark));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Itinerary Details'), 200, scrollable: find.byType(Scrollable).last);
      expect(find.text('Itinerary Details'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_app(
          ItineraryScreen(
              booking: _booking('Confirmed'),
              apiClient: FakeApiClient(getError: ApiException(500, 'Down'))),
          dark));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Retry schedule'), 200, scrollable: find.byType(Scrollable).last);
      expect(find.text('Retry schedule'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('ReviewScreen fits 360 dp ($tag)', (tester) async {
      _phone(tester);
      await tester.pumpWidget(_app(
          ReviewScreen(booking: _booking('Completed'), apiClient: FakeApiClient()), dark));
      await tester.pumpAndSettle();
      expect(find.text('Rate your experience'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('PaymentStatusScreen fits 360 dp and shows loading/error ($tag)', (tester) async {
      _phone(tester);
      final api = FakeApiClient(getResponses: {
        '/api/bookings/booking-1/payment-status': {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      });
      await tester.pumpWidget(
          _app(PaymentStatusScreen(booking: _booking('Confirmed'), apiClient: api), dark));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.text('Payment Method: Bank Transfer'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_app(
          PaymentStatusScreen(
              booking: _booking('Confirmed'),
              apiClient: FakeApiClient(getError: ApiException(500, 'Payment down'))),
          dark));
      await tester.pumpAndSettle();
      expect(find.text('Payment down'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
