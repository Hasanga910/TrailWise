import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/my_bookings_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';

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

class _DynamicBookingsApiClient extends ApiClient {
  int getMineCallCount = 0;
  bool returnHasReview = false;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    if (path == '/api/bookings/mine') {
      getMineCallCount++;
      return {
        'items': [_bookingJson(status: 'Completed', hasReview: returnHasReview)],
        'totalCount': 1,
        'page': 1,
        'pageSize': 10,
      };
    }
    return null;
  }

  @override
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    if (path == '/api/bookings/booking-1/reviews') {
      returnHasReview = true;
      return {
        'id': 'rev-1',
        'bookingId': 'booking-1',
        'rating': 5,
        'comment': 'Awesome tour!',
        'submittedAt': '2026-10-01T12:00:00Z',
      };
    }
    return {};
  }
}

void main() {
  group('Booking model hasReview parsing', () {
    test('fromJson parses hasReview=true correctly', () {
      final json = _bookingJson(status: 'Completed', hasReview: true);
      final booking = Booking.fromJson(json);
      expect(booking.hasReview, isTrue);
    });

    test('fromJson parses hasReview=false correctly', () {
      final json = _bookingJson(status: 'Completed', hasReview: false);
      final booking = Booking.fromJson(json);
      expect(booking.hasReview, isFalse);
    });

    test('fromJson parses PascalCase HasReview=true for API compatibility', () {
      final json = _bookingJson(status: 'Completed');
      json.remove('hasReview');
      json['HasReview'] = true;
      final booking = Booking.fromJson(json);
      expect(booking.hasReview, isTrue);
    });

    test('fromJson defaults hasReview to false when missing or null', () {
      final jsonWithoutField = _bookingJson(status: 'Completed');
      jsonWithoutField.remove('hasReview');
      final booking1 = Booking.fromJson(jsonWithoutField);
      expect(booking1.hasReview, isFalse);

      final jsonWithNull = _bookingJson(status: 'Completed');
      jsonWithNull['hasReview'] = null;
      final booking2 = Booking.fromJson(jsonWithNull);
      expect(booking2.hasReview, isFalse);
    });
  });

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

  testWidgets('shows a Cancel Booking button for an upcoming, non-terminal booking', (tester) async {
    final fake = FakeApiClient(getResponses: {
      '/api/bookings/mine': {
        'items': [_bookingJson(status: 'Confirmed')],
        'totalCount': 1,
        'page': 1,
        'pageSize': 10,
      },
    });

    await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
    await tester.pumpAndSettle();

    expect(find.text('Cancel Booking'), findsOneWidget);
  });

  testWidgets('does not show a Cancel Booking button for a completed booking', (tester) async {
    final fake = FakeApiClient(getResponses: {
      '/api/bookings/mine': {
        'items': [_bookingJson(status: 'Completed')],
        'totalCount': 1,
        'page': 1,
        'pageSize': 10,
      },
    });

    await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
    await tester.pumpAndSettle();

    expect(find.text('Cancel Booking'), findsNothing);
  });

  testWidgets('cancels an upcoming booking through the confirm dialog', (tester) async {
    final fake = FakeApiClient(
      getResponses: {
        '/api/bookings/mine': {
          'items': [_bookingJson(status: 'Confirmed')],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      },
      patchResponses: {
        '/api/bookings/booking-1/cancel': _bookingJson(status: 'Cancelled'),
      },
    );

    await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Cancel Booking'));
    await tester.pumpAndSettle();

    expect(find.text('Are you sure you want to cancel this booking?'), findsOneWidget);

    await tester.tap(find.text('Confirm cancellation'));
    await tester.pumpAndSettle();

    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets('MyBookingsScreen displays Access Restricted when accessed by TourGuide', (tester) async {
    final fake = FakeApiClient();
    final guideUser = CurrentUser(
      id: 'guide-1',
      name: 'Guide Alpha',
      email: 'guide@trailwise.com',
      role: 'TourGuide',
    );

    await tester.pumpWidget(MaterialApp(
      home: MyBookingsScreen(
        apiClient: fake,
        currentUser: guideUser,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Access Restricted'), findsOneWidget);
    expect(find.textContaining('Personal bookings are only available to Travelers'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Go Back'), findsOneWidget);
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

    testWidgets('Returning from ReviewScreen refreshes bookings and switches to disabled Reviewed', (tester) async {
      final client = _DynamicBookingsApiClient();

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      // Initially hasReview is false -> active "Review"
      final reviewButton = find.widgetWithText(OutlinedButton, 'Review');
      expect(reviewButton, findsOneWidget);
      expect(tester.widget<OutlinedButton>(reviewButton).enabled, isTrue);
      expect(client.getMineCallCount, 1);

      // Tap Review button to navigate to ReviewScreen
      await tester.tap(reviewButton);
      await tester.pumpAndSettle();

      // Now on ReviewScreen
      expect(find.text('Rate your experience'), findsOneWidget);

      // Select 5 stars and submit review
      await tester.tap(find.byKey(const Key('star_5')));
      await tester.pumpAndSettle();

      final submitBtn = find.widgetWithText(FilledButton, 'Submit Review');
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn);
      await tester.pumpAndSettle();

      expect(find.text('Review submitted successfully.'), findsWidgets);

      // Go back to MyBookingsScreen
      final backButton = find.byTooltip('Back');
      if (backButton.evaluate().isNotEmpty) {
        await tester.tap(backButton);
      } else {
        final backArrow = find.byType(BackButton);
        if (backArrow.evaluate().isNotEmpty) {
          await tester.tap(backArrow);
        } else {
          Navigator.of(tester.element(find.text('Review submitted successfully.').first)).pop();
        }
      }
      await tester.pumpAndSettle();

      // Confirmed: fresh GET /api/bookings/mine was triggered
      expect(client.getMineCallCount, 2);

      // Button is now disabled "Reviewed"
      final reviewedButton = find.widgetWithText(OutlinedButton, 'Reviewed');
      expect(reviewedButton, findsOneWidget);
      expect(tester.widget<OutlinedButton>(reviewedButton).enabled, isFalse);
    });
  });
}
