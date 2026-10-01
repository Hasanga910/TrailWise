import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/booking_request_screen.dart';
import 'package:trailwise_mobile/bookings/booking_status.dart';
import 'package:trailwise_mobile/bookings/payment_status_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/package_tier.dart';
import 'package:trailwise_mobile/models/payment_status.dart';
import 'package:trailwise_mobile/models/tour_package.dart';

class StubApiClient extends ApiClient {
  StubApiClient({this.getHandler});

  final Future<dynamic> Function(String path)? getHandler;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    if (getHandler != null) {
      return getHandler!(path);
    }
    return <String, dynamic>{};
  }

  @override
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    return <String, dynamic>{};
  }
}

Booking _createTestBooking({String status = BookingStatus.confirmed}) {
  return Booking(
    id: 'booking-123',
    travelerId: 'traveler-1',
    tourPackageId: 'pkg-1',
    tourPackageName: 'Sri Lanka Highland Odyssey',
    packageTier: PackageTier(
      id: 'tier-1',
      classType: 'Normal',
      includesFood: true,
      basePricePerPerson: 300,
      requiresAC: false,
    ),
    groupSize: 2,
    startDate: '2026-11-01',
    endDate: '2026-11-04',
    budgetPerPerson: 500,
    status: status,
    isLargeGroup: false,
    createdAt: DateTime.parse('2026-10-01T00:00:00Z'),
  );
}

TourPackage _createTestPackage() {
  return TourPackage(
    id: 'pkg-1',
    name: 'Highland Odyssey',
    theme: 'Nature',
    durationDays: 4,
    basePricePerPerson: 300,
    maxGroupSize: 15,
    photoUrl: null,
    tiers: const [],
    locations: const [],
  );
}

void main() {
  group('Discount Validity & Traveler Pricing Breakdown Tests', () {
    // 1. PricingBreakdown model parsing
    test('1. PricingBreakdown model parsing', () {
      final json = {
        'baseCost': 600.0,
        'cateringCost': 60.0,
        'addOnCost': 0.0,
        'subtotal': 660.0,
        'discountAmount': 66.0,
        'finalTotal': 594.0,
        'discountDescription': 'Large Group Discount',
        'discountPercentage': 10.0,
      };

      final breakdown = PricingBreakdown.fromJson(json);

      expect(breakdown.baseCost, 600.0);
      expect(breakdown.cateringCost, 60.0);
      expect(breakdown.addOnCost, 0.0);
      expect(breakdown.subtotal, 660.0);
      expect(breakdown.discountAmount, 66.0);
      expect(breakdown.finalTotal, 594.0);
      expect(breakdown.discountDescription, 'Large Group Discount');
      expect(breakdown.discountPercentage, 10.0);

      final paymentStatusJson = {
        'bookingId': 'b-1',
        'totalCost': 594.0,
        'totalPaid': 0.0,
        'remainingAmount': 594.0,
        'status': 'Pending',
        'pricingBreakdown': json,
      };

      final status = PaymentStatusDto.fromJson(paymentStatusJson);
      expect(status.pricingBreakdown, isNotNull);
      expect(status.pricingBreakdown!.finalTotal, 594.0);
    });

    // 2-10, 12, 13: Payment Status renders Cost Breakdown Card with full itemized details
    testWidgets('2-10, 12, 13: Cost Breakdown renders all items, discount, and preserves Financial Summary',
        (tester) async {
      final client = StubApiClient(
        getHandler: (path) async {
          if (path.contains('/payment-status')) {
            return {
              'bookingId': 'booking-123',
              'totalCost': 594.0,
              'totalPaid': 0.0,
              'remainingAmount': 594.0,
              'status': 'Pending',
              'pricingBreakdown': {
                'baseCost': 600.0,
                'cateringCost': 60.0,
                'addOnCost': 0.0,
                'subtotal': 660.0,
                'discountAmount': 66.0,
                'finalTotal': 594.0,
                'discountDescription': 'Large Group Discount',
                'discountPercentage': 10.0,
              },
            };
          }
          return {};
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: PaymentStatusScreen(
          booking: _createTestBooking(),
          apiClient: client,
        ),
      ));
      await tester.pumpAndSettle();

      // 2. Cost Breakdown rendered
      expect(find.text('Cost Breakdown'), findsOneWidget);

      // 3. Base Cost displayed
      expect(find.text('\$600.00'), findsOneWidget);

      // 4. Catering displayed
      expect(find.text('\$60.00'), findsOneWidget);

      // 5. Add-ons displayed
      expect(find.text('\$0.00'), findsNWidgets(2)); // Add-ons in breakdown and Total Verified Paid in summary

      // 6. Subtotal displayed
      expect(find.text('\$660.00'), findsOneWidget);

      // 7. Discount amount displayed as negative
      expect(find.text('-\$66.00'), findsOneWidget);

      // 8. Discount percentage shown
      expect(find.text('Group Discount (10%):'), findsOneWidget);

      // 9. Discount description shown if present
      expect(find.text('Large Group Discount'), findsOneWidget);

      // 10. Final Total displayed
      expect(find.text('\$594.00'), findsNWidgets(3)); // Breakdown Final Total, Summary Total Cost, and Remaining Balance

      // 12. existing Financial Summary remains present
      expect(find.text('Financial Summary'), findsOneWidget);

      // 13. Total Tour Cost remains unchanged
      expect(find.text('Total Tour Cost:'), findsOneWidget);
    });

    // 11. zero discount shows "No discount applied"
    testWidgets('11. zero discount shows "No discount applied" and \$0.00', (tester) async {
      final client = StubApiClient(
        getHandler: (path) async {
          return {
            'bookingId': 'booking-123',
            'totalCost': 600.0,
            'totalPaid': 0.0,
            'remainingAmount': 600.0,
            'status': 'Pending',
            'pricingBreakdown': {
              'baseCost': 600.0,
              'cateringCost': 0.0,
              'addOnCost': 0.0,
              'subtotal': 600.0,
              'discountAmount': 0.0,
              'finalTotal': 600.0,
              'discountDescription': null,
              'discountPercentage': 0.0,
            },
          };
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: PaymentStatusScreen(
          booking: _createTestBooking(),
          apiClient: client,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Group Discount:'), findsOneWidget);
      expect(find.text('No discount applied'), findsOneWidget);
      expect(find.text('\$0.00'), findsNWidgets(4)); // Catering, Addons, Discount, Total Verified Paid
    });

    // 14. advance countdown still works
    testWidgets('14. advance countdown still works with Cost Breakdown', (tester) async {
      final fixedNow = DateTime.utc(2026, 10, 1, 10, 0, 0);
      final dueAt = fixedNow.add(const Duration(hours: 48));

      final client = StubApiClient(
        getHandler: (path) async {
          return {
            'bookingId': 'booking-123',
            'totalCost': 500.0,
            'totalPaid': 0.0,
            'remainingAmount': 500.0,
            'status': 'Unpaid',
            'paymentDueAt': dueAt.toIso8601String(),
            'isPaymentDeadlineExpired': false,
            'bookingStatus': BookingStatus.confirmed,
            'pricingBreakdown': {
              'baseCost': 500.0,
              'cateringCost': 0.0,
              'addOnCost': 0.0,
              'subtotal': 500.0,
              'discountAmount': 0.0,
              'finalTotal': 500.0,
            },
          };
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: PaymentStatusScreen(
          booking: _createTestBooking(status: BookingStatus.confirmed),
          apiClient: client,
          nowProvider: () => fixedNow,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('advance_payment_deadline_card')), findsOneWidget);
      expect(find.text('Advance payment deadline'), findsOneWidget);
      expect(find.text('Cost Breakdown'), findsOneWidget);
    });

    // 15. final balance countdown still works
    testWidgets('15. final balance countdown still works with Cost Breakdown', (tester) async {
      final fixedNow = DateTime.utc(2026, 10, 1, 10, 0, 0);
      final dueAt = fixedNow.add(const Duration(hours: 24));

      final client = StubApiClient(
        getHandler: (path) async {
          return {
            'bookingId': 'booking-123',
            'totalCost': 500.0,
            'totalPaid': 250.0,
            'remainingAmount': 250.0,
            'status': 'DepositPaid',
            'balancePaymentDueAt': dueAt.toIso8601String(),
            'isBalancePaymentDeadlineExpired': false,
            'bookingStatus': BookingStatus.completed,
            'pricingBreakdown': {
              'baseCost': 500.0,
              'cateringCost': 0.0,
              'addOnCost': 0.0,
              'subtotal': 500.0,
              'discountAmount': 0.0,
              'finalTotal': 500.0,
            },
          };
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: PaymentStatusScreen(
          booking: _createTestBooking(status: BookingStatus.completed),
          apiClient: client,
          nowProvider: () => fixedNow,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('balance_payment_deadline_card')), findsOneWidget);
      expect(find.text('Final balance due in 24:00:00'), findsOneWidget);
      expect(find.text('Cost Breakdown'), findsOneWidget);
    });

    // 16-19: Active discounts load in BookingRequestScreen
    testWidgets('16-19: Active discounts load, format validity, display threshold, and are read-only',
        (tester) async {
      final client = StubApiClient(
        getHandler: (path) async {
          if (path == '/api/discounts/active') {
            return [
              {
                'id': 'd-1',
                'description': '10% Group Discount',
                'percentageOff': 10.0,
                'minGroupSize': 5,
                'validFrom': '2026-10-01T00:00:00Z',
                'validUntil': '2026-10-31T23:59:59Z',
              },
              {
                'id': 'd-2',
                'description': '15% Mega Discount',
                'percentageOff': 15.0,
                'minGroupSize': 10,
                'validFrom': null,
                'validUntil': null,
              }
            ];
          }
          return {};
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: BookingRequestScreen(
          package: _createTestPackage(),
          tier: PackageTier(
            id: 't-1',
            classType: 'Normal',
            includesFood: true,
            basePricePerPerson: 300,
            requiresAC: false,
          ),
          apiClient: client,
        ),
      ));
      await tester.pumpAndSettle();

      // 16. active discounts load
      expect(find.text('Available Group Discounts'), findsOneWidget);
      expect(find.text('10% off'), findsOneWidget);
      expect(find.text('15% off'), findsOneWidget);

      // 17. group threshold displayed
      expect(find.text('Groups of 5 or more'), findsOneWidget);
      expect(find.text('Groups of 10 or more'), findsOneWidget);

      // 18. validity text displayed
      expect(find.text('1 Oct 2026 - 31 Oct 2026'), findsOneWidget);
      expect(find.text('Always available'), findsOneWidget);

      // 19. traveler cannot select/override discount
      expect(find.text('Eligible discounts are applied automatically during pricing.'), findsOneWidget);
      expect(find.byType(Checkbox), findsNothing);
      expect(find.byType(Radio), findsNothing);
    });

    // 20. narrow-screen layout does not overflow
    testWidgets('20. narrow-screen layout does not overflow', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = StubApiClient(
        getHandler: (path) async {
          return {
            'bookingId': 'booking-123',
            'totalCost': 594.0,
            'totalPaid': 0.0,
            'remainingAmount': 594.0,
            'status': 'Pending',
            'pricingBreakdown': {
              'baseCost': 600.0,
              'cateringCost': 60.0,
              'addOnCost': 0.0,
              'subtotal': 660.0,
              'discountAmount': 66.0,
              'finalTotal': 594.0,
              'discountDescription': 'Large Group Discount',
              'discountPercentage': 10.0,
            },
          };
        },
      );

      await tester.pumpWidget(MaterialApp(
        home: PaymentStatusScreen(
          booking: _createTestBooking(),
          apiClient: client,
        ),
      ));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Cost Breakdown'), findsOneWidget);
      expect(find.text('Financial Summary'), findsOneWidget);
    });
  });
}
