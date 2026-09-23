import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/payment_status_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/package_tier.dart';

class RecordingApiClient extends ApiClient {
  RecordingApiClient({
    this.getStatusResponses = const [],
    this.postResponse = const {},
    this.getError,
    this.postError,
  });

  final List<Map<String, dynamic>> getStatusResponses;
  final Map<String, dynamic> postResponse;
  final ApiException? getError;
  final ApiException? postError;

  int getCallCount = 0;
  int postCallCount = 0;
  final List<Map<String, dynamic>> recordedPostBodies = [];

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    if (getError != null) throw getError!;
    final response = getStatusResponses.isNotEmpty
        ? getStatusResponses[getCallCount.clamp(0, getStatusResponses.length - 1)]
        : <String, dynamic>{};
    getCallCount++;
    return response;
  }

  @override
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    if (postError != null) throw postError!;
    postCallCount++;
    recordedPostBodies.add(body);
    return postResponse;
  }
}

Booking _fixtureBooking({String status = 'Confirmed'}) => Booking(
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
  testWidgets('1. Loads and renders payment status summary', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 600.0,
          'totalPaid': 200.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('\$600.00'), findsOneWidget);
    expect(find.text('\$200.00'), findsOneWidget);
    expect(find.text('\$400.00'), findsOneWidget);
    expect(find.text('DepositPaid'), findsOneWidget);
    expect(find.text('33% paid'), findsOneWidget);
  });

  testWidgets('2. Shows payment form for Confirmed booking with remaining balance', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 600.0,
          'totalPaid': 200.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(status: 'Confirmed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Make a Payment'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Submit Payment'), findsOneWidget);
    expect(find.text('400.00'), findsOneWidget); // Default amount in input
  });

  testWidgets('3. Submits POST /api/payments with bookingId, amount, and method', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 600.0,
          'totalPaid': 200.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 600.0,
          'totalPaid': 600.0,
          'remainingAmount': 0.0,
          'status': 'FullyPaid',
        },
      ],
      postResponse: {
        'id': 'pay-1',
        'bookingId': 'booking-1',
        'amount': 400.0,
        'method': 'Card',
        'status': 'FullyPaid',
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(status: 'Confirmed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    final submitButton = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitButton);
    await tester.pumpAndSettle();
    await tester.tap(submitButton);
    await tester.pumpAndSettle();

    expect(client.postCallCount, 1);
    expect(client.recordedPostBodies.first, {
      'bookingId': 'booking-1',
      'amount': 400.0,
      'method': 'Card',
    });
    expect(find.text('Payment recorded successfully.'), findsOneWidget);
  });

  testWidgets('4. Re-fetches status after successful payment and updates to FullyPaid', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 600.0,
          'totalPaid': 200.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 600.0,
          'totalPaid': 600.0,
          'remainingAmount': 0.0,
          'status': 'FullyPaid',
        },
      ],
      postResponse: {
        'id': 'pay-1',
        'bookingId': 'booking-1',
        'amount': 400.0,
        'method': 'Card',
        'status': 'FullyPaid',
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(status: 'Confirmed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(client.getCallCount, 1);

    final submitButton = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitButton);
    await tester.pumpAndSettle();
    await tester.tap(submitButton);
    await tester.pumpAndSettle();

    expect(client.getCallCount, 2);
    expect(find.text('Booking is fully paid.'), findsOneWidget);
    expect(find.text('Make a Payment'), findsNothing);
  });

  testWidgets('5. FullyPaid status hides payment form and shows success banner', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 600.0,
          'totalPaid': 600.0,
          'remainingAmount': 0.0,
          'status': 'FullyPaid',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(status: 'Confirmed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Booking is fully paid.'), findsOneWidget);
    expect(find.text('Make a Payment'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Submit Payment'), findsNothing);
  });

  testWidgets('6. Non-Confirmed booking hides payment form and shows info message', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 600.0,
          'totalPaid': 0.0,
          'remainingAmount': 600.0,
          'status': 'Pending',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(status: 'PendingApproval'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Payments can only be made for confirmed bookings.'), findsOneWidget);
    expect(find.text('Make a Payment'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Submit Payment'), findsNothing);
  });

  testWidgets('7. API failure displays useful error message', (tester) async {
    final client = RecordingApiClient(
      getError: ApiException(500, 'Server connection failure'),
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Server connection failure'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
  });

  testWidgets('8. BankTransfer method is sent exactly as BankTransfer', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 500.0,
          'totalPaid': 0.0,
          'remainingAmount': 500.0,
          'status': 'Pending',
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 500.0,
          'totalPaid': 200.0,
          'remainingAmount': 300.0,
          'status': 'DepositPaid',
        },
      ],
      postResponse: {
        'id': 'pay-2',
        'bookingId': 'booking-1',
        'amount': 200.0,
        'method': 'BankTransfer',
        'status': 'DepositPaid',
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(status: 'Confirmed'), apiClient: client),
    ));
    await tester.pumpAndSettle();

    // Change dropdown to Bank Transfer
    final cardDropdown = find.text('Card');
    await tester.ensureVisible(cardDropdown);
    await tester.pumpAndSettle();
    await tester.tap(cardDropdown);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Bank Transfer').last);
    await tester.pumpAndSettle();

    // Enter amount 200
    final amountField = find.widgetWithText(TextFormField, 'Amount');
    await tester.ensureVisible(amountField);
    await tester.pumpAndSettle();
    await tester.enterText(amountField, '200');

    final submitButton = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitButton);
    await tester.pumpAndSettle();
    await tester.tap(submitButton);
    await tester.pumpAndSettle();

    expect(client.postCallCount, 1);
    expect(client.recordedPostBodies.first['method'], 'BankTransfer');
    expect(client.recordedPostBodies.first['amount'], 200.0);
  });
}
