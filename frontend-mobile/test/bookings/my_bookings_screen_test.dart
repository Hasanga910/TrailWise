import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:trailwise_mobile/bookings/my_bookings_screen.dart';

import '../fakes/fake_api_client.dart';

Map<String, dynamic> _bookingJson({
  String status = 'Requested',
  bool hasReview = false,
}) =>
    {
      'id': 'booking-1',
      'travelerId': 'traveler-1',
      'tourPackageId': 'pkg-1',
      'tourPackageName': 'Cultural Triangle Explorer',
      'packageTier': {
        'id': 'tier-1',
        'classType': 'Normal',
        'includesFood': false,
        'basePricePerPerson': 250,
        'requiresAC': false,
      },
      'groupSize': 2,
      'startDate': '2030-01-01',
      'endDate': '2030-01-05',
      'budgetPerPerson': 300,
      'status': status,
      'isLargeGroup': false,
      'hasReview': hasReview,
    };

void main() {
  testWidgets('MyBookingsScreen renders bookings with a status chip', (tester) async {
    final fake = FakeApiClient(getResponses: {
      '/api/bookings/mine': {
        'items': [_bookingJson()],
        'totalCount': 1,
        'page': 1,
        'pageSize': 10,
      },
    });

    await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
    await tester.pumpAndSettle();

    expect(find.textContaining('Cultural Triangle Explorer'), findsOneWidget);
    expect(find.text('Requested'), findsOneWidget);
  });

  testWidgets('MyBookingsScreen shows an empty state', (tester) async {
    final fake = FakeApiClient(getResponses: {
      '/api/bookings/mine': {
        'items': <dynamic>[],
        'totalCount': 0,
        'page': 1,
        'pageSize': 10,
      },
    });

    await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
    await tester.pumpAndSettle();

    expect(find.text('No bookings match your filters.'), findsOneWidget);
  });

  group('16. Review Action Availability on My Bookings', () {
    testWidgets('Completed + not reviewed displays active Review button', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [_bookingJson(status: 'Completed', hasReview: false)],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      });

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      final reviewButton = find.widgetWithText(OutlinedButton, 'Review');
      expect(reviewButton, findsOneWidget);
      // Button is enabled
      final btnWidget = tester.widget<OutlinedButton>(reviewButton);
      expect(btnWidget.enabled, isTrue);
    });

    testWidgets('Completed + already reviewed displays disabled Reviewed button', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [_bookingJson(status: 'Completed', hasReview: true)],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      });

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      final reviewedButton = find.widgetWithText(OutlinedButton, 'Reviewed');
      expect(reviewedButton, findsOneWidget);
      // Button is disabled
      final btnWidget = tester.widget<OutlinedButton>(reviewedButton);
      expect(btnWidget.enabled, isFalse);
    });

    testWidgets('Non-completed bookings do not display Review or Reviewed button', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [
            _bookingJson(status: 'Requested', hasReview: false),
            _bookingJson(status: 'Confirmed', hasReview: false),
          ],
          'totalCount': 2,
          'page': 1,
          'pageSize': 10,
        },
      });

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Review'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'Reviewed'), findsNothing);
    });
  });
}
