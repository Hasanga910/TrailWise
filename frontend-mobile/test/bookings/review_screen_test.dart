import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/review_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/package_tier.dart';

class RecordingApiClient extends ApiClient {
  RecordingApiClient({
    this.postResponse = const {},
    this.postError,
  });

  final Map<String, dynamic> postResponse;
  final ApiException? postError;

  int postCallCount = 0;
  final List<String> recordedPostPaths = [];
  final List<Map<String, dynamic>> recordedPostBodies = [];

  @override
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    if (postError != null) throw postError!;
    postCallCount++;
    recordedPostPaths.add(path);
    recordedPostBodies.add(body);
    return postResponse;
  }
}

Booking _fixtureBooking({String status = 'Completed'}) => Booking(
      id: 'booking-1',
      travelerId: 'traveler-1',
      tourPackageId: 'pkg-1',
      tourPackageName: 'Highland Heritage',
      packageTier: PackageTier(
        id: 'tier-1',
        classType: 'Normal',
        includesFood: false,
        basePricePerPerson: 200,
        requiresAC: false,
      ),
      groupSize: 2,
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      budgetPerPerson: 250,
      status: status,
      isLargeGroup: false,
    );

void main() {
  testWidgets('1. Completed booking renders booking summary and review form', (tester) async {
    final client = RecordingApiClient();

    await tester.pumpWidget(MaterialApp(
      home: ReviewScreen(booking: _fixtureBooking(status: 'Completed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Highland Heritage'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('Rate your experience'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Submit Review'), findsOneWidget);
  });

  testWidgets('2. Exactly 5 star controls are present', (tester) async {
    final client = RecordingApiClient();

    await tester.pumpWidget(MaterialApp(
      home: ReviewScreen(booking: _fixtureBooking(status: 'Completed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    for (int i = 1; i <= 5; i++) {
      expect(find.byKey(Key('star_$i')), findsOneWidget);
    }
    expect(find.byType(IconButton), findsNWidgets(5));
  });

  testWidgets('3. Tapping the 4th star sets rating to 4', (tester) async {
    final client = RecordingApiClient();

    await tester.pumpWidget(MaterialApp(
      home: ReviewScreen(booking: _fixtureBooking(status: 'Completed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    final star4 = find.byKey(const Key('star_4'));
    await tester.ensureVisible(star4);
    await tester.pumpAndSettle();
    await tester.tap(star4);
    await tester.pumpAndSettle();

    expect(find.text('4 / 5'), findsOneWidget);
  });

  testWidgets('4. Submitting with no rating shows local validation error and does not call POST', (tester) async {
    final client = RecordingApiClient();

    await tester.pumpWidget(MaterialApp(
      home: ReviewScreen(booking: _fixtureBooking(status: 'Completed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    final submitButton = find.widgetWithText(FilledButton, 'Submit Review');
    await tester.ensureVisible(submitButton);
    await tester.pumpAndSettle();
    await tester.tap(submitButton);
    await tester.pumpAndSettle();

    expect(find.text('Please select a rating between 1 and 5 stars.'), findsOneWidget);
    expect(client.postCallCount, 0);
  });

  testWidgets('5. Valid submission sends exactly POST /api/bookings/{id}/reviews', (tester) async {
    final client = RecordingApiClient(
      postResponse: {
        'id': 'rev-1',
        'bookingId': 'booking-1',
        'rating': 4,
        'comment': 'Great trip',
        'submittedAt': '2026-10-06T12:00:00Z',
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: ReviewScreen(booking: _fixtureBooking(status: 'Completed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    final star4 = find.byKey(const Key('star_4'));
    await tester.ensureVisible(star4);
    await tester.pumpAndSettle();
    await tester.tap(star4);
    await tester.pumpAndSettle();

    final commentField = find.widgetWithText(TextFormField, 'Comments (optional)');
    await tester.ensureVisible(commentField);
    await tester.pumpAndSettle();
    await tester.enterText(commentField, 'Great trip');
    await tester.pumpAndSettle();

    final submitButton = find.widgetWithText(FilledButton, 'Submit Review');
    await tester.ensureVisible(submitButton);
    await tester.pumpAndSettle();
    await tester.tap(submitButton);
    await tester.pumpAndSettle();

    expect(client.postCallCount, 1);
    expect(client.recordedPostPaths.first, '/api/bookings/booking-1/reviews');
    expect(client.recordedPostBodies.first, {
      'rating': 4,
      'comment': 'Great trip',
    });
  });

  testWidgets('6. Successful submission shows SnackBar, hides form, and shows success card', (tester) async {
    final client = RecordingApiClient(
      postResponse: {
        'id': 'rev-1',
        'bookingId': 'booking-1',
        'rating': 5,
        'comment': null,
        'submittedAt': '2026-10-06T12:00:00Z',
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: ReviewScreen(booking: _fixtureBooking(status: 'Completed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    final star5 = find.byKey(const Key('star_5'));
    await tester.ensureVisible(star5);
    await tester.pumpAndSettle();
    await tester.tap(star5);
    await tester.pumpAndSettle();

    final submitButton = find.widgetWithText(FilledButton, 'Submit Review');
    await tester.ensureVisible(submitButton);
    await tester.pumpAndSettle();
    await tester.tap(submitButton);
    await tester.pumpAndSettle();

    expect(find.text('Review submitted successfully.'), findsWidgets);
    expect(find.text('Rate your experience'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Submit Review'), findsNothing);
  });

  testWidgets('7. Backend 409 conflict displays "Review already submitted for this booking."', (tester) async {
    final client = RecordingApiClient(
      postError: ApiException(409, 'Review already submitted for this booking.'),
    );

    await tester.pumpWidget(MaterialApp(
      home: ReviewScreen(booking: _fixtureBooking(status: 'Completed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    final star5 = find.byKey(const Key('star_5'));
    await tester.ensureVisible(star5);
    await tester.pumpAndSettle();
    await tester.tap(star5);
    await tester.pumpAndSettle();

    final submitButton = find.widgetWithText(FilledButton, 'Submit Review');
    await tester.ensureVisible(submitButton);
    await tester.pumpAndSettle();
    await tester.tap(submitButton);
    await tester.pumpAndSettle();

    expect(find.text('Review already submitted for this booking.'), findsOneWidget);
    expect(find.text('Rate your experience'), findsOneWidget);
  });

  testWidgets('8. Non-Completed booking hides review form, shows info card, makes no POST', (tester) async {
    final client = RecordingApiClient();

    await tester.pumpWidget(MaterialApp(
      home: ReviewScreen(booking: _fixtureBooking(status: 'Confirmed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Reviews can only be submitted for completed bookings.'), findsOneWidget);
    expect(find.text('Rate your experience'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Submit Review'), findsNothing);
    expect(client.postCallCount, 0);
  });
}
