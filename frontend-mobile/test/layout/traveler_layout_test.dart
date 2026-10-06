import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/bookings/booking_request_screen.dart';
import 'package:trailwise_mobile/bookings/my_bookings_screen.dart';
import 'package:trailwise_mobile/models/package_tier.dart';
import 'package:trailwise_mobile/models/tour_package.dart';
import 'package:trailwise_mobile/packages/packages_screen.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';

import '../fakes/fake_api_client.dart';

final _traveler = CurrentUser(id: 'u', name: 'T', email: 't@x.com', role: 'Traveler');

Map<String, dynamic> _package() => {
      'id': 'pkg-1',
      'name': 'The Extraordinarily Long Cultural Triangle Explorer Experience',
      'theme': 'Cultural & Heritage Adventure',
      'durationDays': 4,
      'basePricePerPerson': 250,
      'maxGroupSize': 12,
      'photoUrl': null,
      'averageRating': 4.8,
      'reviewCount': 12,
      'tiers': [
        {
          'id': 'tier-1',
          'classType': 'Luxury Deluxe',
          'includesFood': true,
          'basePricePerPerson': 250,
          'requiresAC': true,
        },
      ],
      'locations': [
        {'id': 'l1', 'name': 'Sigiriya Rock Fortress', 'latitude': 1, 'longitude': 1},
        {'id': 'l2', 'name': 'Dambulla Cave Temple', 'latitude': 1, 'longitude': 1},
      ],
    };

Map<String, dynamic> _booking(String status) => {
      'id': 'b-$status',
      'travelerId': 'traveler-1',
      'tourPackageId': 'pkg-1',
      'tourPackageName': 'The Extraordinarily Long Cultural Triangle Explorer Experience',
      'packageTier': {
        'id': 'tier-1',
        'classType': 'Normal',
        'includesFood': false,
        'basePricePerPerson': 250,
        'requiresAC': false,
      },
      'groupSize': 20,
      'startDate': '2030-01-01',
      'endDate': '2030-01-05',
      'budgetPerPerson': 300,
      'status': status,
      'isLargeGroup': true,
      'hasReview': false,
      'isFullyPaid': false,
      'hasPendingPayment': false,
    };

void _phone(WidgetTester tester, {double textScale = 1.0}) {
  tester.view.physicalSize = const Size(360, 640);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

Widget _app(Widget home, bool dark) =>
    MaterialApp(theme: dark ? AppTheme.dark : AppTheme.light, home: home);

void main() {
  for (final dark in [false, true]) {
    final tag = dark ? 'dark' : 'light';

    testWidgets('PackagesScreen lists packages at 360 dp ($tag)', (tester) async {
      _phone(tester, textScale: 1.3);
      final api = FakeApiClient(getResponses: {'/api/packages': [_package()]});
      await tester.pumpWidget(
          _app(PackagesScreen(apiClient: api, currentUser: _traveler), dark));
      await tester.pumpAndSettle();
      expect(find.text('Request'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('PackagesScreen empty and error states ($tag)', (tester) async {
      _phone(tester);
      await tester.pumpWidget(_app(
          PackagesScreen(
              apiClient: FakeApiClient(getResponses: {'/api/packages': []}),
              currentUser: _traveler),
          dark));
      await tester.pumpAndSettle();
      expect(find.text('No tour packages yet.'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_app(
          PackagesScreen(
              apiClient: FakeApiClient(getError: ApiException(500, 'Server exploded')),
              currentUser: _traveler),
          dark));
      await tester.pumpAndSettle();
      expect(find.text('Server exploded'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('MyBookingsScreen shows every status badge at 360 dp ($tag)', (tester) async {
      _phone(tester, textScale: 1.3);
      final statuses = [
        'Requested',
        'PlanProposed',
        'PendingApproval',
        'NeedsManualReview',
        'Confirmed',
      ];
      final api = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': statuses.map(_booking).toList(),
          'totalCount': statuses.length,
          'page': 1,
          'pageSize': 10,
        },
      });
      await tester.pumpWidget(
          _app(MyBookingsScreen(apiClient: api, currentUser: _traveler), dark));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      final list = find.byType(Scrollable).last;
      for (final label in ['Requested', 'Plan Proposed', 'Pending Approval', 'Needs Manual Review', 'Confirmed']) {
        await tester.scrollUntilVisible(find.text(label), 200, scrollable: list);
        expect(find.text(label), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    });

    testWidgets('MyBookingsScreen empty and error states ($tag)', (tester) async {
      _phone(tester);
      await tester.pumpWidget(_app(
          MyBookingsScreen(
              apiClient: FakeApiClient(getResponses: {
                '/api/bookings/mine': {'items': [], 'totalCount': 0, 'page': 1, 'pageSize': 10},
              }),
              currentUser: _traveler),
          dark));
      await tester.pumpAndSettle();
      expect(find.text('No bookings match your filters.'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_app(
          MyBookingsScreen(
              apiClient: FakeApiClient(getError: ApiException(500, 'Nope')),
              currentUser: _traveler),
          dark));
      await tester.pumpAndSettle();
      expect(find.text('Nope'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('BookingRequestScreen fits 360 dp with the keyboard-sized viewport ($tag)',
        (tester) async {
      _phone(tester, textScale: 1.3);
      final package = TourPackage.fromJson(_package());
      final tier = PackageTier(
          id: 't', classType: 'Luxury Deluxe', includesFood: true, basePricePerPerson: 250, requiresAC: true);
      await tester.pumpWidget(_app(
          BookingRequestScreen(
              package: package, tier: tier, apiClient: FakeApiClient(getResponses: {
                '/api/discounts/active': [
                  {
                    'id': 'd1',
                    'minGroupSize': 10,
                    'percentageOff': 15,
                    'validFrom': '2030-01-01T00:00:00Z',
                    'validTo': '2030-12-31T00:00:00Z',
                  },
                ],
              }), currentUser: _traveler),
          dark));
      await tester.pumpAndSettle();
      expect(find.text('Submit request'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
