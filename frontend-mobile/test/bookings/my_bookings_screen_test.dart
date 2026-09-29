import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/bookings/my_bookings_screen.dart';

import '../fakes/fake_api_client.dart';

Map<String, dynamic> _bookingJson({String status = 'Requested'}) => {
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
}
