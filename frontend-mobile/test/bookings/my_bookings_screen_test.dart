import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/my_bookings_screen.dart';
import 'package:trailwise_mobile/bookings/payment_status_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';

import '../fakes/fake_api_client.dart';

Map<String, dynamic> _bookingJson({
  String id = 'booking-1',
  String tourPackageName = 'Cultural Triangle Explorer',
  String status = 'Requested',
  String startDate = '2030-01-01',
  String endDate = '2030-01-05',
  String? createdAt,
  bool hasReview = false,
  String? paymentStatus,
  double? remainingAmount,
  bool isFullyPaid = false,
  bool hasPendingPayment = false,
}) =>
    {
      'id': id,
      'travelerId': 'traveler-1',
      'tourPackageId': 'pkg-1',
      'tourPackageName': tourPackageName,
      'packageTier': {
        'id': 'tier-1',
        'classType': 'Normal',
        'includesFood': false,
        'basePricePerPerson': 250,
        'requiresAC': false,
      },
      'groupSize': 2,
      'startDate': startDate,
      'endDate': endDate,
      'budgetPerPerson': 300,
      'status': status,
      'isLargeGroup': false,
      'hasReview': hasReview,
      'paymentStatus': paymentStatus,
      'remainingAmount': remainingAmount,
      'isFullyPaid': isFullyPaid,
      'hasPendingPayment': hasPendingPayment,
      'createdAt': createdAt,
    };

class _RefreshTestApiClient extends ApiClient {
  int getMineCallCount = 0;
  List<Map<String, dynamic>> mineResponses = [];
  Map<String, dynamic>? lastQuery;
  Map<String, dynamic> Function(Map<String, dynamic>? query)? onGetMine;

  _RefreshTestApiClient({this.mineResponses = const [], this.onGetMine});

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    if (path == '/api/bookings/mine') {
      lastQuery = query;
      getMineCallCount++;
      if (onGetMine != null) {
        return onGetMine!(query);
      }
      final idx = getMineCallCount - 1 < mineResponses.length ? getMineCallCount - 1 : mineResponses.length - 1;
      return mineResponses[idx];
    }
    if (path.startsWith('/api/bookings/') && path.endsWith('/payment-status')) {
      return {
        'bookingId': 'booking-1',
        'totalCost': 500.0,
        'totalPaid': 0.0,
        'remainingAmount': 500.0,
        'status': 'Unpaid',
        'bookingStatus': 'Confirmed',
      };
    }
    return null;
  }
}

Map<String, dynamic> Function(Map<String, dynamic>? query) _createDynamicMineHandler(
    List<Map<String, dynamic>> allBookings) {
  return (query) {
    var items = List<Map<String, dynamic>>.from(allBookings);
    final sortBy = query?['sortBy'] ?? 'createdAt';
    final sortDirection = query?['sortDirection'] ?? 'desc';
    final status = query?['status'];
    final page = (query?['page'] as int?) ?? 1;
    final pageSize = (query?['pageSize'] as int?) ?? 10;

    if (status != null) {
      items = items.where((b) => b['status'] == status).toList();
    }

    items.sort((a, b) {
      int cmp = 0;
      if (sortBy == 'startDate') {
        cmp = (a['startDate'] as String).compareTo(b['startDate'] as String);
      } else if (sortBy == 'status') {
        cmp = (a['status'] as String).compareTo(b['status'] as String);
      } else {
        final aCreated = a['createdAt'] as String? ?? '';
        final bCreated = b['createdAt'] as String? ?? '';
        cmp = aCreated.compareTo(bCreated);
      }
      if (sortDirection == 'desc') cmp = -cmp;
      return cmp;
    });

    final totalCount = items.length;
    final start = (page - 1) * pageSize;
    final pagedItems = start < items.length
        ? items.skip(start).take(pageSize).toList()
        : <Map<String, dynamic>>[];

    return {
      'items': pagedItems,
      'totalCount': totalCount,
      'page': page,
      'pageSize': pageSize,
    };
  };
}

class _DynamicBookingsApiClient extends ApiClient {
  int getMineCallCount = 0;
  bool returnHasReview = false;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    if (path == '/api/bookings/mine') {
      getMineCallCount++;
      return {
        'items': [_bookingJson(status: 'Completed', hasReview: returnHasReview, isFullyPaid: true)],
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

  testWidgets('MyBookingsScreen renders assigned tour guide name on booking card', (tester) async {
    final bookingData = _bookingJson(status: 'Confirmed');
    bookingData['assignedGuide'] = {
      'id': 'guide-1',
      'name': 'Janindu',
      'contactInfo': '0775645000',
      'languages': ['Sinhala', 'English'],
      'specializations': ['Cultural'],
    };

    final fake = FakeApiClient(getResponses: {
      '/api/bookings/mine': {
        'items': [bookingData],
        'totalCount': 1,
        'page': 1,
        'pageSize': 10,
      },
    });

    await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
    await tester.pumpAndSettle();

    expect(find.text('Tour Guide: Janindu'), findsOneWidget);
  });

  testWidgets('MyBookingsScreen renders Tour Guide not assigned yet when guide is null', (tester) async {
    final fake = FakeApiClient(getResponses: {
      '/api/bookings/mine': {
        'items': [_bookingJson(status: 'Requested')],
        'totalCount': 1,
        'page': 1,
        'pageSize': 10,
      },
    });

    await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
    await tester.pumpAndSettle();

    expect(find.text('Tour Guide not assigned yet'), findsOneWidget);
  });

  group('16. Review Action Availability on My Bookings', () {
    testWidgets('Completed + not reviewed displays active Review button', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [_bookingJson(status: 'Completed', hasReview: false, isFullyPaid: true)],
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
          'items': [_bookingJson(status: 'Completed', hasReview: true, isFullyPaid: true)],
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

  group('Booking Action Buttons Responsive Layout', () {
    testWidgets('Confirmed booking on narrow viewport renders all 3 actions in Wrap without overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = FakeApiClient(
        getResponses: {
          '/api/bookings/mine': {
            'items': [
              _bookingJson(status: 'Confirmed'),
            ],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
        },
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.widgetWithText(TextButton, 'Get Support'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Payment'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Cancel Booking'), findsOneWidget);
    });

    testWidgets('Completed unreviewed booking on narrow viewport renders Get Support and Review without overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = FakeApiClient(
        getResponses: {
          '/api/bookings/mine': {
            'items': [
              _bookingJson(status: 'Completed', hasReview: false, isFullyPaid: true),
            ],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
        },
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.widgetWithText(TextButton, 'Get Support'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Review'), findsOneWidget);
    });

    testWidgets('Completed reviewed booking on narrow viewport renders Get Support and disabled Reviewed without overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = FakeApiClient(
        getResponses: {
          '/api/bookings/mine': {
            'items': [
              _bookingJson(status: 'Completed', hasReview: true, isFullyPaid: true),
            ],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
        },
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.widgetWithText(TextButton, 'Get Support'), findsOneWidget);
      final reviewed = find.widgetWithText(OutlinedButton, 'Reviewed');
      expect(reviewed, findsOneWidget);
      expect(tester.widget<OutlinedButton>(reviewed).enabled, isFalse);
    });

    testWidgets('Requested booking on narrow viewport renders Get Support and Cancel Booking without overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = FakeApiClient(
        getResponses: {
          '/api/bookings/mine': {
            'items': [
              _bookingJson(status: 'Requested'),
            ],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
        },
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.widgetWithText(TextButton, 'Get Support'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Cancel Booking'), findsOneWidget);
    });
  });

  group('Completed and Confirmed Settlement Actions', () {
    testWidgets('1. Completed + remaining balance shows Payment and hides Review', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [
            _bookingJson(
              status: 'Completed',
              paymentStatus: 'DepositPaid',
              remainingAmount: 200.0,
              isFullyPaid: false,
              hasPendingPayment: false,
            ),
          ],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      });

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Payment'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Review'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'Reviewed'), findsNothing);
    });

    testWidgets('2. Completed + pending shows Payment Status and hides Review', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [
            _bookingJson(
              status: 'Completed',
              paymentStatus: 'Pending',
              remainingAmount: 200.0,
              isFullyPaid: false,
              hasPendingPayment: true,
            ),
          ],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      });

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Payment Status'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Review'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'Reviewed'), findsNothing);
    });

    testWidgets('3. Completed + FullyPaid shows Review and hides Payment', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [
            _bookingJson(
              status: 'Completed',
              paymentStatus: 'FullyPaid',
              remainingAmount: 0.0,
              isFullyPaid: true,
              hasPendingPayment: false,
              hasReview: false,
            ),
          ],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      });

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Review'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Payment'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'Payment Status'), findsNothing);
    });

    testWidgets('4. Completed + FullyPaid + HasReview shows disabled Reviewed', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [
            _bookingJson(
              status: 'Completed',
              paymentStatus: 'FullyPaid',
              remainingAmount: 0.0,
              isFullyPaid: true,
              hasPendingPayment: false,
              hasReview: true,
            ),
          ],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      });

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      final reviewed = find.widgetWithText(OutlinedButton, 'Reviewed');
      expect(reviewed, findsOneWidget);
      expect(tester.widget<OutlinedButton>(reviewed).enabled, isFalse);
      expect(find.widgetWithText(OutlinedButton, 'Payment'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'Payment Status'), findsNothing);
    });

    testWidgets('5. Confirmed + partial shows Payment and hides Review', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [
            _bookingJson(
              status: 'Confirmed',
              paymentStatus: 'DepositPaid',
              remainingAmount: 200.0,
              isFullyPaid: false,
              hasPendingPayment: false,
            ),
          ],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      });

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Payment'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Review'), findsNothing);
    });

    testWidgets('6. Confirmed + FullyPaid shows Payment Status and hides Review', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/mine': {
          'items': [
            _bookingJson(
              status: 'Confirmed',
              paymentStatus: 'FullyPaid',
              remainingAmount: 0.0,
              isFullyPaid: true,
              hasPendingPayment: false,
            ),
          ],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      });

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Payment Status'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, 'Review'), findsNothing);
    });
  });

  group('My Bookings Refresh Tests', () {
    testWidgets('1. Returning from PaymentStatusScreen triggers reload', (tester) async {
      final client = _RefreshTestApiClient(
        mineResponses: [
          {
            'items': [_bookingJson(id: 'b-1', status: 'Confirmed', paymentStatus: 'DepositPaid', remainingAmount: 250.0)],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
          {
            'items': [_bookingJson(id: 'b-1', status: 'Completed', paymentStatus: 'FullyPaid', remainingAmount: 0.0, isFullyPaid: true)],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
        ],
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();
      expect(client.getMineCallCount, 1);
      expect(find.widgetWithText(OutlinedButton, 'Payment'), findsOneWidget);

      // Open payment
      await tester.tap(find.widgetWithText(OutlinedButton, 'Payment'));
      await tester.pumpAndSettle();

      // We are in PaymentStatusScreen; now pop back
      final backButton = find.byType(BackButton);
      if (backButton.evaluate().isNotEmpty) {
        await tester.tap(backButton);
      } else {
        Navigator.of(tester.element(find.byType(PaymentStatusScreen))).pop();
      }
      await tester.pumpAndSettle();

      // Returning triggers reload
      expect(client.getMineCallCount, 2);
      expect(find.widgetWithText(OutlinedButton, 'Review'), findsOneWidget);
    });

    testWidgets('2. Refresh icon triggers GET /api/bookings/mine', (tester) async {
      final client = _RefreshTestApiClient(
        mineResponses: [
          {
            'items': [_bookingJson(id: 'b-1', status: 'Confirmed')],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
        ],
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();
      expect(client.getMineCallCount, 1);

      await tester.tap(find.byKey(const Key('my_bookings_refresh_button')));
      await tester.pumpAndSettle();
      expect(client.getMineCallCount, 2);
    });

    testWidgets('3. Pull-to-refresh triggers reload', (tester) async {
      final client = _RefreshTestApiClient(
        mineResponses: [
          {
            'items': [_bookingJson(id: 'b-1', status: 'Confirmed')],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
        ],
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();
      expect(client.getMineCallCount, 1);

      await tester.fling(find.byType(ListView), const Offset(0.0, 300.0), 1000.0);
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(client.getMineCallCount, 2);
    });

    testWidgets('4. Refreshed booking state replaces cached state', (tester) async {
      final client = _RefreshTestApiClient(
        mineResponses: [
          {
            'items': [_bookingJson(id: 'b-1', status: 'Confirmed', tourPackageName: 'Old Cached Tour')],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
          {
            'items': [_bookingJson(id: 'b-1', status: 'Confirmed', tourPackageName: 'Fresh Reloaded Tour')],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
        ],
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();
      expect(find.textContaining('Old Cached Tour'), findsOneWidget);

      await tester.tap(find.byKey(const Key('my_bookings_refresh_button')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Fresh Reloaded Tour'), findsOneWidget);
      expect(find.textContaining('Old Cached Tour'), findsNothing);
    });

    testWidgets('5. Filters remain selected after refresh', (tester) async {
      final client = _RefreshTestApiClient(
        mineResponses: [
          {
            'items': [_bookingJson(id: 'b-1', status: 'Confirmed')],
            'totalCount': 1,
            'page': 1,
            'pageSize': 10,
          },
        ],
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      // Change status filter to Confirmed
      await tester.tap(find.byKey(const Key('status_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmed').last);
      await tester.pumpAndSettle();

      expect(client.lastQuery?['status'], 'Confirmed');

      // Tap refresh
      await tester.tap(find.byKey(const Key('my_bookings_refresh_button')));
      await tester.pumpAndSettle();

      // Query still has 'status': 'Confirmed'
      expect(client.lastQuery?['status'], 'Confirmed');
    });
  });

  group('My Bookings Sorting Tests', () {
    final bookingEarly = _bookingJson(
      id: 'b-early',
      tourPackageName: 'Early Created Tour',
      startDate: '2030-05-01',
      status: 'Confirmed',
      createdAt: '2026-01-01T10:00:00Z',
    );
    final bookingLate = _bookingJson(
      id: 'b-late',
      tourPackageName: 'Late Created Tour',
      startDate: '2030-01-01',
      status: 'Requested',
      createdAt: '2026-06-01T10:00:00Z',
    );

    testWidgets('1. Latest to Oldest (Default) sends createdAt/desc and renders latest first', (tester) async {
      final client = _RefreshTestApiClient(
        onGetMine: _createDynamicMineHandler([bookingEarly, bookingLate]),
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      expect(client.lastQuery?['sortBy'], 'createdAt');
      expect(client.lastQuery?['sortDirection'], 'desc');

      // Default is Latest to Oldest: bookingLate (June) should be above bookingEarly (Jan)
      final earlyPos = tester.getTopLeft(find.textContaining('Early Created Tour')).dy;
      final latePos = tester.getTopLeft(find.textContaining('Late Created Tour')).dy;
      expect(latePos < earlyPos, isTrue);
    });

    testWidgets('2. Oldest to Latest sends createdAt/asc and renders oldest first', (tester) async {
      final client = _RefreshTestApiClient(
        onGetMine: _createDynamicMineHandler([bookingEarly, bookingLate]),
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('sort_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Oldest to Latest').last);
      await tester.pumpAndSettle();

      expect(client.lastQuery?['sortBy'], 'createdAt');
      expect(client.lastQuery?['sortDirection'], 'asc');

      final earlyPos = tester.getTopLeft(find.textContaining('Early Created Tour')).dy;
      final latePos = tester.getTopLeft(find.textContaining('Late Created Tour')).dy;
      expect(earlyPos < latePos, isTrue);
    });

    testWidgets('3. Trip Date Soonest sends startDate/asc', (tester) async {
      final client = _RefreshTestApiClient(
        onGetMine: _createDynamicMineHandler([bookingEarly, bookingLate]),
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      // bookingLate startDate is 2030-01-01, bookingEarly is 2030-05-01
      await tester.tap(find.byKey(const Key('sort_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Trip Date: Soonest').last);
      await tester.pumpAndSettle();

      expect(client.lastQuery?['sortBy'], 'startDate');
      expect(client.lastQuery?['sortDirection'], 'asc');

      final earlyPos = tester.getTopLeft(find.textContaining('Early Created Tour')).dy;
      final latePos = tester.getTopLeft(find.textContaining('Late Created Tour')).dy;
      expect(latePos < earlyPos, isTrue);
    });

    testWidgets('4. Trip Date Latest sends startDate/desc', (tester) async {
      final client = _RefreshTestApiClient(
        onGetMine: _createDynamicMineHandler([bookingEarly, bookingLate]),
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      // bookingEarly is 2030-05-01, bookingLate is 2030-01-01
      await tester.tap(find.byKey(const Key('sort_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Trip Date: Latest').last);
      await tester.pumpAndSettle();

      expect(client.lastQuery?['sortBy'], 'startDate');
      expect(client.lastQuery?['sortDirection'], 'desc');

      final earlyPos = tester.getTopLeft(find.textContaining('Early Created Tour')).dy;
      final latePos = tester.getTopLeft(find.textContaining('Late Created Tour')).dy;
      expect(earlyPos < latePos, isTrue);
    });

    testWidgets('5. Status sort sends status/asc', (tester) async {
      final client = _RefreshTestApiClient(
        onGetMine: _createDynamicMineHandler([bookingLate, bookingEarly]), // Late=Requested, Early=Confirmed
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      // Status alphabetical: 'Confirmed' < 'Requested', so bookingEarly first
      await tester.tap(find.byKey(const Key('sort_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Status').last);
      await tester.pumpAndSettle();

      expect(client.lastQuery?['sortBy'], 'status');
      expect(client.lastQuery?['sortDirection'], 'asc');

      final earlyPos = tester.getTopLeft(find.textContaining('Early Created Tour')).dy;
      final latePos = tester.getTopLeft(find.textContaining('Late Created Tour')).dy;
      expect(earlyPos < latePos, isTrue);
    });

    testWidgets('6. Changing sort resets to page 1', (tester) async {
      final fiveBookings = List.generate(
        5,
        (i) => _bookingJson(
          id: 'b-$i',
          tourPackageName: 'Tour $i',
          createdAt: '2026-0${i + 1}-01T10:00:00Z',
        ),
      );

      final client = _RefreshTestApiClient(
        onGetMine: _createDynamicMineHandler(fiveBookings),
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      // Go to page 2 (with 5 items and DefaultPageSize=10, let's test page reset directly)
      await tester.tap(find.byKey(const Key('sort_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Oldest to Latest').last);
      await tester.pumpAndSettle();

      expect(client.lastQuery?['page'], 1);
    });

    testWidgets('7. Sorting survives refresh', (tester) async {
      final client = _RefreshTestApiClient(
        onGetMine: _createDynamicMineHandler([bookingEarly, bookingLate]),
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('sort_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Oldest to Latest').last);
      await tester.pumpAndSettle();

      // Tap refresh
      await tester.tap(find.byKey(const Key('my_bookings_refresh_button')));
      await tester.pumpAndSettle();

      expect(client.lastQuery?['sortBy'], 'createdAt');
      expect(client.lastQuery?['sortDirection'], 'asc');

      // Sort order is preserved: Early before Late
      final earlyPos = tester.getTopLeft(find.textContaining('Early Created Tour')).dy;
      final latePos = tester.getTopLeft(find.textContaining('Late Created Tour')).dy;
      expect(earlyPos < latePos, isTrue);
    });

    testWidgets('8. Filters + sorting work together', (tester) async {
      final client = _RefreshTestApiClient(
        onGetMine: _createDynamicMineHandler([bookingEarly, bookingLate]),
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      // Filter by Confirmed
      await tester.tap(find.byKey(const Key('status_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmed').last);
      await tester.pumpAndSettle();

      // Sort by Soonest
      await tester.tap(find.byKey(const Key('sort_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Trip Date: Soonest').last);
      await tester.pumpAndSettle();

      expect(client.lastQuery?['status'], 'Confirmed');
      expect(client.lastQuery?['sortBy'], 'startDate');
      expect(client.lastQuery?['sortDirection'], 'asc');
    });

    testWidgets('9. Pagination across 5 bookings with pageSize 2 (Latest vs Oldest)', (tester) async {
      final b1 = _bookingJson(id: 'b-1', tourPackageName: 'Booking 1', createdAt: '2026-01-01T10:00:00Z');
      final b2 = _bookingJson(id: 'b-2', tourPackageName: 'Booking 2', createdAt: '2026-02-01T10:00:00Z');
      final b3 = _bookingJson(id: 'b-3', tourPackageName: 'Booking 3', createdAt: '2026-03-01T10:00:00Z');
      final b4 = _bookingJson(id: 'b-4', tourPackageName: 'Booking 4', createdAt: '2026-04-01T10:00:00Z');
      final b5 = _bookingJson(id: 'b-5', tourPackageName: 'Booking 5', createdAt: '2026-05-01T10:00:00Z');

      // Create handler simulating pageSize=2
      Map<String, dynamic> handler(Map<String, dynamic>? query) {
        var items = [b1, b2, b3, b4, b5];
        final sortDirection = query?['sortDirection'] ?? 'desc';
        final page = (query?['page'] as int?) ?? 1;
        const pageSize = 2;

        items.sort((a, b) {
          final aCreated = a['createdAt'] as String;
          final bCreated = b['createdAt'] as String;
          final cmp = aCreated.compareTo(bCreated);
          return sortDirection == 'desc' ? -cmp : cmp;
        });

        final start = (page - 1) * pageSize;
        final pagedItems = items.skip(start).take(pageSize).toList();

        return {
          'items': pagedItems,
          'totalCount': 5,
          'page': page,
          'pageSize': pageSize,
        };
      }

      final client = _RefreshTestApiClient(onGetMine: handler);

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      // Page 1 Latest: Booking 5 and Booking 4
      expect(find.textContaining('Booking 5'), findsOneWidget);
      expect(find.textContaining('Booking 4'), findsOneWidget);
      expect(find.textContaining('Booking 3'), findsNothing);

      // Next -> Page 2: Booking 3 and Booking 2
      await tester.tap(find.widgetWithText(TextButton, 'Next'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Booking 3'), findsOneWidget);
      expect(find.textContaining('Booking 2'), findsOneWidget);
      expect(find.textContaining('Booking 5'), findsNothing);

      // Next -> Page 3: Booking 1
      await tester.tap(find.widgetWithText(TextButton, 'Next'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Booking 1'), findsOneWidget);

      // Change sort to Oldest to Latest -> resets to Page 1: Booking 1 and Booking 2
      await tester.tap(find.byKey(const Key('sort_filter_dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Oldest to Latest').last);
      await tester.pumpAndSettle();

      expect(find.textContaining('Booking 1'), findsOneWidget);
      expect(find.textContaining('Booking 2'), findsOneWidget);
      expect(find.textContaining('Booking 5'), findsNothing);
    });

    testWidgets('10. Narrow viewport (320px) no overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final client = _RefreshTestApiClient(
        onGetMine: _createDynamicMineHandler([bookingEarly]),
      );

      await tester.pumpWidget(MaterialApp(home: MyBookingsScreen(apiClient: client)));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  });
}
