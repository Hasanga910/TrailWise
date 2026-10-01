import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/my_bookings_screen.dart';
import 'package:trailwise_mobile/bookings/payment_status_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/package_tier.dart';
import 'package:trailwise_mobile/models/payment_status.dart';

class RecordedMultipartCall {
  final String path;
  final Map<String, String> fields;
  final List<int> fileBytes;
  final String filename;
  final String fileFieldName;

  RecordedMultipartCall({
    required this.path,
    required this.fields,
    required this.fileBytes,
    required this.filename,
    required this.fileFieldName,
  });
}

class RecordingApiClient extends ApiClient {
  RecordingApiClient({
    this.getStatusResponses = const [],
    this.postResponse = const {},
    this.postMultipartResponse = const {},
    this.getError,
    this.postError,
  });

  final List<Map<String, dynamic>> getStatusResponses;
  final Map<String, dynamic> postResponse;
  final Map<String, dynamic> postMultipartResponse;
  final ApiException? getError;
  final ApiException? postError;

  int getCallCount = 0;
  int postCallCount = 0;
  int postMultipartCallCount = 0;

  final List<Map<String, dynamic>> recordedPostBodies = [];
  final List<RecordedMultipartCall> recordedMultipartCalls = [];

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

  @override
  Future<dynamic> postMultipart(
    String path, {
    required Map<String, String> fields,
    required List<int> fileBytes,
    required String filename,
    String fileFieldName = 'bankSlip',
  }) async {
    if (postError != null) throw postError!;
    postMultipartCallCount++;
    recordedMultipartCalls.add(RecordedMultipartCall(
      path: path,
      fields: fields,
      fileBytes: fileBytes,
      filename: filename,
      fileFieldName: fileFieldName,
    ));
    return postMultipartResponse;
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

SelectedSlipFile _dummySlip({
  String name = 'bank_slip.png',
  int size = 50 * 1024,
  String extension = 'png',
  List<int> bytes = const [1, 2, 3, 4],
}) =>
    SelectedSlipFile(
      name: name,
      size: size,
      extension: extension,
      bytes: bytes,
    );

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  void setTestViewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
  }

  testWidgets('1. Bank Transfer is the only method shown', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Payment Method: Bank Transfer'), findsOneWidget);
    expect(find.byType(DropdownButtonFormField<String>), findsNothing);
  });

  testWidgets('2. Card option is absent', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Card'), findsNothing);
    expect(find.textContaining('Credit Card'), findsNothing);
  });

  testWidgets('3. Payment summary renders', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Total Tour Cost:'), findsOneWidget);
    expect(find.text('\$800.00'), findsNWidgets(2));
    expect(find.text('Total Verified Paid:'), findsOneWidget);
    expect(find.text('\$0.00'), findsOneWidget);
    expect(find.text('Remaining Balance:'), findsOneWidget);
    expect(find.text('Payment Status:'), findsOneWidget);
    expect(find.text('Unpaid'), findsWidgets);
  });

  testWidgets('4. Minimum advance renders', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Minimum Advance:'), findsOneWidget);
    expect(find.text('\$400.00'), findsWidgets);
    expect(find.text('Your first payment must be at least 50% of the total tour cost.'), findsOneWidget);
  });

  testWidgets('5. First payment below 50% blocked client-side', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(),
      ),
    ));
    await tester.pumpAndSettle();

    // Select slip
    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    // Enter amount 250 (less than 400 min advance)
    final amountField = find.widgetWithText(TextFormField, 'Amount');
    await tester.ensureVisible(amountField);
    await tester.enterText(amountField, '250');
    await tester.pumpAndSettle();

    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(find.text('Initial payment must be at least \$400.00.'), findsOneWidget);
    expect(client.postMultipartCallCount, 0);
  });

  testWidgets('6. Exactly 50% allowed', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Pending',
          'hasPendingVerification': true,
          'minimumAdvance': 400.0,
        },
      ],
      postMultipartResponse: {'id': 'pay-1', 'status': 'Pending'},
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(),
      ),
    ));
    await tester.pumpAndSettle();

    // Select slip
    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    // Amount is already defaulted to 400.00
    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(client.postMultipartCallCount, 1);
    expect(client.recordedMultipartCalls.first.fields['amount'], '400.00');
  });

  testWidgets('7. Amount above total blocked', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(),
      ),
    ));
    await tester.pumpAndSettle();

    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    final amountField = find.widgetWithText(TextFormField, 'Amount');
    await tester.ensureVisible(amountField);
    await tester.enterText(amountField, '950');
    await tester.pumpAndSettle();

    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(find.text('Payment cannot exceed the total tour cost of \$800.00.'), findsOneWidget);
    expect(client.postMultipartCallCount, 0);
  });

  testWidgets('8. Slip is required', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => null,
      ),
    ));
    await tester.pumpAndSettle();

    // Amount is 400.00 but no slip selected
    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(find.text('Please select a bank slip.'), findsOneWidget);
    expect(client.postMultipartCallCount, 0);
  });

  testWidgets('9. Slip selection renders selected filename and details', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(
          name: 'may_transfer_receipt.pdf',
          size: 1024 * 1024 * 2,
          extension: 'pdf',
        ),
      ),
    ));
    await tester.pumpAndSettle();

    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    expect(find.text('may_transfer_receipt.pdf'), findsOneWidget);
    expect(find.text('PDF Document · 2.00 MB'), findsOneWidget);
    expect(find.text('Change File'), findsOneWidget);
    expect(find.text('Remove'), findsOneWidget);
  });

  testWidgets('10. Multipart submission calls correct endpoint', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Pending',
          'hasPendingVerification': true,
          'minimumAdvance': 400.0,
        },
      ],
      postMultipartResponse: {'id': 'pay-1', 'status': 'Pending'},
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(name: 'transfer.png'),
      ),
    ));
    await tester.pumpAndSettle();

    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(client.postMultipartCallCount, 1);
    final call = client.recordedMultipartCalls.first;
    expect(call.path, '/api/bookings/booking-1/payments/bank-transfer');
    expect(call.fileFieldName, 'bankSlip');
    expect(call.filename, 'transfer.png');
    expect(call.fields['amount'], '400.00');
  });

  testWidgets('11. Success message says submitted for verification', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Pending',
          'hasPendingVerification': true,
          'minimumAdvance': 400.0,
        },
      ],
      postMultipartResponse: {'id': 'pay-1', 'status': 'Pending'},
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(),
      ),
    ));
    await tester.pumpAndSettle();

    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(find.text('Bank transfer submitted for verification.'), findsOneWidget);
  });

  testWidgets('12. Pending state disables new submission', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Pending',
          'hasPendingVerification': true,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Payment verification pending'), findsOneWidget);
    expect(find.text('Your bank transfer slip has been submitted and is waiting for staff review.'), findsOneWidget);
    expect(find.text('Make a Payment'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Submit Payment'), findsNothing);
  });

  testWidgets('13. Pending state shows Refresh', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Pending',
          'hasPendingVerification': true,
          'minimumAdvance': 400.0,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(client.getCallCount, 1);
    final refreshBtn = find.widgetWithText(OutlinedButton, 'Refresh Status');
    expect(refreshBtn, findsOneWidget);

    await tester.tap(refreshBtn);
    await tester.pumpAndSettle();

    expect(client.getCallCount, 2);
    expect(find.text('Advance payment verified'), findsOneWidget);
  });

  testWidgets('14. DepositPaid allows balance payment', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Advance payment verified'), findsOneWidget);
    expect(find.text('Make a Payment'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Submit Payment'), findsOneWidget);
  });

  testWidgets('15. DepositPaid does not require 50% again', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 500.0,
          'remainingAmount': 300.0,
          'status': 'Pending',
          'hasPendingVerification': true,
          'minimumAdvance': 400.0,
        },
      ],
      postMultipartResponse: {'id': 'pay-2', 'status': 'Pending'},
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(),
      ),
    ));
    await tester.pumpAndSettle();

    // Select slip
    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    // Enter $100.00 (less than 50% of total, which is 400)
    final amountField = find.widgetWithText(TextFormField, 'Amount');
    await tester.ensureVisible(amountField);
    await tester.enterText(amountField, '100.00');
    await tester.pumpAndSettle();

    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(client.postMultipartCallCount, 1);
    expect(client.recordedMultipartCalls.first.fields['amount'], '100.00');
  });

  testWidgets('16. Balance payment above remaining rejected', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(),
      ),
    ));
    await tester.pumpAndSettle();

    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    // Remaining is 400, enter 450
    final amountField = find.widgetWithText(TextFormField, 'Amount');
    await tester.ensureVisible(amountField);
    await tester.enterText(amountField, '450.00');
    await tester.pumpAndSettle();

    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(find.text('Payment cannot exceed the remaining balance of \$400.00.'), findsOneWidget);
    expect(client.postMultipartCallCount, 0);
  });

  testWidgets('17. FullyPaid hides form', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 800.0,
          'remainingAmount': 0.0,
          'status': 'FullyPaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Make a Payment'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Submit Payment'), findsNothing);
  });

  testWidgets('18. FullyPaid displays success state', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 800.0,
          'remainingAmount': 0.0,
          'status': 'FullyPaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Booking is fully paid.'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
  });

  testWidgets('19. API error displays safely', (tester) async {
    setTestViewport(tester);
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

  testWidgets('20. Existing booking/payment navigation still works', (tester) async {
    setTestViewport(tester);
    final booking = _fixtureBooking(status: 'Confirmed');
    final fakeMyBookings = RecordingApiClient(
      getStatusResponses: [
        {
          'items': [
            {
              'id': booking.id,
              'travelerId': booking.travelerId,
              'tourPackageId': booking.tourPackageId,
              'tourPackageName': booking.tourPackageName,
              'packageTier': {
                'id': booking.packageTier.id,
                'classType': booking.packageTier.classType,
                'includesFood': booking.packageTier.includesFood,
                'basePricePerPerson': booking.packageTier.basePricePerPerson,
                'requiresAC': booking.packageTier.requiresAC,
              },
              'groupSize': booking.groupSize,
              'startDate': booking.startDate,
              'endDate': booking.endDate,
              'budgetPerPerson': booking.budgetPerPerson,
              'status': 'Confirmed',
              'isLargeGroup': false,
            }
          ],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: MyBookingsScreen(apiClient: fakeMyBookings),
    ));
    await tester.pumpAndSettle();

    final paymentButton = find.widgetWithText(OutlinedButton, 'Payment');
    expect(paymentButton, findsOneWidget);

    await tester.tap(paymentButton);
    await tester.pumpAndSettle();

    expect(find.byType(PaymentStatusScreen), findsOneWidget);
    expect(find.text('Payment Status'), findsOneWidget);
  });

  testWidgets('21. Rejection warning renders when reason exists', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
          'latestRejectedPaymentReason': 'Bank slip amount does not match the submitted amount.',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Previous payment was rejected'), findsOneWidget);
    expect(find.text('Please correct the issue and submit a new bank transfer slip.'), findsOneWidget);
  });

  testWidgets('22. Rejection reason text renders', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
          'latestRejectedPaymentReason': 'Bank slip amount does not match the submitted amount.',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Reason: Bank slip amount does not match the submitted amount.'), findsOneWidget);
  });

  testWidgets('23. Rejection date renders when available', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
          'latestRejectedPaymentReason': 'Receipt image is cropped.',
          'latestRejectedAt': '2026-10-02T14:30:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.textContaining('Rejected on:'), findsOneWidget);
    expect(find.textContaining('2026-10-02'), findsOneWidget);
  });

  testWidgets('24. New payment form remains available after rejection', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
          'latestRejectedPaymentReason': 'Invalid account number.',
          'latestRejectedAt': '2026-10-02T14:30:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Previous payment was rejected'), findsOneWidget);
    expect(find.text('Make a Payment'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Submit Payment'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Choose Bank Slip'), findsOneWidget);
  });

  testWidgets('25. Pending state takes priority over rejection warning', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Pending',
          'hasPendingVerification': true,
          'minimumAdvance': 400.0,
          'latestRejectedPaymentReason': 'Old rejected payment',
          'latestRejectedAt': '2026-10-01T10:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    // Pending state should be displayed as primary
    expect(find.text('Payment verification pending'), findsOneWidget);
    expect(find.text('Your bank transfer slip has been submitted and is waiting for staff review.'), findsOneWidget);
    // Old rejection warning should NOT be shown
    expect(find.text('Previous payment was rejected'), findsNothing);
    // Payment form should be hidden
    expect(find.text('Make a Payment'), findsNothing);
  });

  testWidgets('26. FullyPaid state hides rejection warning', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 800.0,
          'remainingAmount': 0.0,
          'status': 'FullyPaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
          'latestRejectedPaymentReason': 'Historical rejected attempt',
          'latestRejectedAt': '2026-09-20T12:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(booking: _fixtureBooking(), apiClient: client),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Booking is fully paid.'), findsOneWidget);
    expect(find.text('Previous payment was rejected'), findsNothing);
    expect(find.text('Make a Payment'), findsNothing);
  });

  testWidgets('27. Deadline date/time renders', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 10, 15, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Advance payment deadline'), findsOneWidget);
    expect(find.textContaining('Submit your advance bank transfer before:'), findsOneWidget);
  });

  testWidgets('28. Countdown renders for unpaid initial payment', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 10, 17, 45),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Time remaining: 00:42:15'), findsOneWidget);
    expect(find.text('Advance payment due in 00:42:15'), findsOneWidget);
    expect(find.text('Advance payment due in'), findsOneWidget);
  });

  testWidgets('29. Countdown decreases based on supplied time/clock abstraction', (tester) async {
    setTestViewport(tester);
    var currentTime = DateTime.utc(2026, 9, 29, 10, 17, 45);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => currentTime,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Time remaining: 00:42:15'), findsOneWidget);

    currentTime = DateTime.utc(2026, 9, 29, 10, 17, 46);
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Time remaining: 00:42:14'), findsOneWidget);
  });

  testWidgets('30. Less than 15-minute warning styling/state', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 10, 50, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Time remaining: 00:10:00'), findsOneWidget);
    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
  });

  testWidgets('31. Pending state hides primary countdown warning', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Pending',
          'hasPendingVerification': true,
          'paymentDueAt': '2026-09-29T11:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 10, 17, 45),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Payment submitted before the deadline and awaiting verification.'), findsOneWidget);
    expect(find.byKey(const Key('advance_payment_deadline_card')), findsNothing);
  });

  testWidgets('32. DepositPaid hides countdown', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 10, 17, 45),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('advance_payment_deadline_card')), findsNothing);
    expect(find.text('Advance payment verified'), findsOneWidget);
  });

  testWidgets('33. FullyPaid hides countdown', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 800.0,
          'remainingAmount': 0.0,
          'status': 'FullyPaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 10, 17, 45),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('advance_payment_deadline_card')), findsNothing);
    expect(find.text('Booking is fully paid.'), findsOneWidget);
  });

  testWidgets('34. Expired state hides payment form', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
          'isPaymentDeadlineExpired': true,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 11, 5, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Make a Payment'), findsNothing);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('35. Expired state displays cancellation guidance', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
          'isPaymentDeadlineExpired': true,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 11, 5, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Payment deadline expired'), findsOneWidget);
    expect(
      find.text('Your booking was cancelled because the advance payment was not submitted within 1 hour.'),
      findsOneWidget,
    );
  });

  testWidgets('36. Cancelled booking does not expose Pay action from My Bookings', (tester) async {
    setTestViewport(tester);
    final fakeMyBookings = RecordingApiClient(
      getStatusResponses: [
        {
          'items': [
            {
              'id': 'booking-cancelled-1',
              'travelerId': 'traveler-1',
              'tourPackageId': 'pkg-1',
              'tourPackageName': 'Cancelled Tour',
              'packageTier': {
                'id': 'tier-1',
                'classType': 'Normal',
                'includesFood': false,
                'basePricePerPerson': 200,
                'requiresAC': false,
              },
              'groupSize': 2,
              'startDate': '2026-10-01',
              'endDate': '2026-10-05',
              'budgetPerPerson': 250,
              'status': 'Cancelled',
              'isLargeGroup': false,
            },
          ],
          'totalCount': 1,
          'page': 1,
          'pageSize': 10,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: MyBookingsScreen(apiClient: fakeMyBookings),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Cancelled'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Payment'), findsNothing);
  });

  testWidgets('37. Null PaymentDueAt hides countdown and keeps UI stable', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': null,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 10, 17, 45),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('advance_payment_deadline_card')), findsNothing);
    expect(find.text('Bank Transfer Details'), findsOneWidget);
    expect(find.text('Make a Payment'), findsOneWidget);
    expect(find.text('Payment deadline expired'), findsNothing);
  });

  testWidgets('38. Timer stops at zero, cancels, and refreshes payment status without going negative', (tester) async {
    setTestViewport(tester);
    var currentTime = DateTime.utc(2026, 9, 29, 10, 59, 59);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
          'isPaymentDeadlineExpired': true,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => currentTime,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Advance payment due in 00:00:01'), findsOneWidget);
    expect(client.getCallCount, 1);

    // Advance clock past deadline
    currentTime = DateTime.utc(2026, 9, 29, 11, 0, 0);
    await tester.pump(const Duration(seconds: 1));

    // Timer detects zero/past, stops, and calls _loadPaymentStatus
    await tester.pumpAndSettle();

    expect(client.getCallCount, 2);
    expect(find.byKey(const Key('advance_payment_deadline_card')), findsNothing);
    expect(find.textContaining('00:00:-'), findsNothing);
    expect(find.text('Payment deadline expired'), findsOneWidget);
  });

  testWidgets('39. Timer is disposed safely when screen is popped or unmounted', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'paymentDueAt': '2026-09-29T11:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 9, 29, 10, 17, 45),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('advance_payment_deadline_card')), findsOneWidget);

    // Unmount widget
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));

    // Safe unmount without pending timer exceptions
    expect(find.byKey(const Key('advance_payment_deadline_card')), findsNothing);
  });

  testWidgets('40. Tapping Remove clears selected file, returns original picker UI, and preserves payment amount', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(
          name: 'first_slip.png',
          size: 1024 * 191,
          extension: 'png',
        ),
      ),
    ));
    await tester.pumpAndSettle();

    // Change amount field to a custom value
    final amountField = find.byType(TextFormField);
    await tester.enterText(amountField, '450.00');
    await tester.pumpAndSettle();

    // Select slip
    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    expect(find.text('first_slip.png'), findsOneWidget);
    expect(find.text('Change File'), findsOneWidget);
    expect(find.text('Remove'), findsOneWidget);

    // Tap Remove
    final removeBtn = find.text('Remove');
    await tester.ensureVisible(removeBtn);
    await tester.tap(removeBtn);
    await tester.pumpAndSettle();

    // Selected file should be cleared, original picker restored
    expect(find.text('first_slip.png'), findsNothing);
    expect(find.text('Remove'), findsNothing);
    expect(find.widgetWithText(OutlinedButton, 'Choose Bank Slip'), findsOneWidget);

    // Payment amount remains unchanged
    expect(find.text('450.00'), findsOneWidget);
  });

  testWidgets('41. Submitting payment after Remove is blocked without making API calls', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(name: 'first_slip.png'),
      ),
    ));
    await tester.pumpAndSettle();

    // Select slip
    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    // Tap Remove
    final removeBtn = find.text('Remove');
    await tester.ensureVisible(removeBtn);
    await tester.tap(removeBtn);
    await tester.pumpAndSettle();

    // Attempt submission
    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    // Blocked with error, no API call
    expect(find.text('Please select a bank slip.'), findsOneWidget);
    expect(client.postMultipartCallCount, 0);
  });

  testWidgets('42. Selecting another file after Remove works and submits new file', (tester) async {
    setTestViewport(tester);
    var slipCount = 0;
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Pending',
          'hasPendingVerification': true,
        },
      ],
      postMultipartResponse: {
        'id': 'payment-new',
        'status': 'Pending',
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async {
          slipCount++;
          if (slipCount == 1) {
            return _dummySlip(name: 'wrong_slip.png');
          } else {
            return _dummySlip(name: 'correct_slip.pdf', extension: 'pdf');
          }
        },
      ),
    ));
    await tester.pumpAndSettle();

    // Select first slip
    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();
    expect(find.text('wrong_slip.png'), findsOneWidget);

    // Remove first slip
    final removeBtn = find.text('Remove');
    await tester.ensureVisible(removeBtn);
    await tester.tap(removeBtn);
    await tester.pumpAndSettle();

    // Select second slip
    final pickBtn2 = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn2);
    await tester.tap(pickBtn2);
    await tester.pumpAndSettle();
    expect(find.text('correct_slip.pdf'), findsOneWidget);

    // Submit payment
    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(client.postMultipartCallCount, 1);
    expect(client.recordedMultipartCalls.first.filename, 'correct_slip.pdf');
  });

  testWidgets('43. Change File preserves ability to replace selected slip and submit', (tester) async {
    setTestViewport(tester);
    var slipCount = 0;
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Pending',
          'hasPendingVerification': true,
        },
      ],
      postMultipartResponse: {
        'id': 'payment-change',
        'status': 'Pending',
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async {
          slipCount++;
          if (slipCount == 1) {
            return _dummySlip(name: 'initial_slip.jpg', extension: 'jpg');
          } else {
            return _dummySlip(name: 'replacement_slip.pdf', extension: 'pdf');
          }
        },
      ),
    ));
    await tester.pumpAndSettle();

    // Pick initial slip
    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();
    expect(find.text('initial_slip.jpg'), findsOneWidget);

    // Tap Change File
    final changeBtn = find.text('Change File');
    await tester.ensureVisible(changeBtn);
    await tester.tap(changeBtn);
    await tester.pumpAndSettle();
    expect(find.text('replacement_slip.pdf'), findsOneWidget);

    // Submit
    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(client.postMultipartCallCount, 1);
    expect(client.recordedMultipartCalls.first.filename, 'replacement_slip.pdf');
  });

  testWidgets('44. Selected bank slip UI renders without overflow on narrow viewports', (tester) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(),
        apiClient: client,
        slipPicker: () async => _dummySlip(
          name: 'very_long_bank_transfer_deposit_slip_reference_2026_final.png',
          size: 1024 * 1024 * 3,
          extension: 'png',
        ),
      ),
    ));
    await tester.pumpAndSettle();

    // Select file
    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    expect(find.text('very_long_bank_transfer_deposit_slip_reference_2026_final.png'), findsOneWidget);
    expect(find.text('Change File'), findsOneWidget);
    expect(find.text('Remove'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('45. Completed + remaining balance shows payment form and allows payment submission', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'Pending',
          'hasPendingVerification': true,
        },
      ],
      postMultipartResponse: {
        'id': 'payment-balance-1',
        'status': 'Pending',
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        slipPicker: () async => _dummySlip(name: 'balance_slip.png', extension: 'png'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Make a Payment'), findsOneWidget);
    expect(find.text('Payments can only be made for confirmed or completed bookings.'), findsNothing);

    // Pick slip and submit
    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(client.postMultipartCallCount, 1);
    expect(client.recordedMultipartCalls.first.fields['amount'], '400.00');
  });

  testWidgets('46. Completed + pending verification blocks payment form', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': true,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Payment verification pending'), findsOneWidget);
    expect(find.text('Make a Payment'), findsNothing);
  });

  testWidgets('47. Completed + FullyPaid displays settled state', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 800.0,
          'remainingAmount': 0.0,
          'status': 'FullyPaid',
          'hasPendingVerification': false,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Booking is fully paid.'), findsOneWidget);
    expect(find.text('Make a Payment'), findsNothing);
  });

  testWidgets('48. Completed booking does not show advance countdown even if paymentDueAt is set', (tester) async {
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'paymentDueAt': DateTime.now().add(const Duration(hours: 1)).toUtc().toIso8601String(),
          'isPaymentDeadlineExpired': false,
          'minimumAdvance': 400.0,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('advance_payment_deadline_card')), findsNothing);
    expect(find.textContaining('Advance payment due in'), findsNothing);
    expect(find.text('Make a Payment'), findsOneWidget);
  });

  testWidgets('49. Completed unpaid + balance deadline future -> final-balance countdown visible', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': '2026-10-02T12:00:00Z',
          'isBalancePaymentDeadlineExpired': false,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('balance_payment_deadline_card')), findsOneWidget);
    expect(find.text('Final balance due in 24:00:00'), findsOneWidget);
    expect(find.text('Remaining balance due in 24:00:00'), findsOneWidget);
    expect(find.byKey(const Key('advance_payment_deadline_card')), findsNothing);
  });

  testWidgets('50. Completed countdown decreases on tick', (tester) async {
    setTestViewport(tester);
    var currentTime = DateTime.utc(2026, 10, 1, 12, 0, 0);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': '2026-10-02T12:00:00Z',
          'isBalancePaymentDeadlineExpired': false,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => currentTime,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Final balance due in 24:00:00'), findsOneWidget);

    currentTime = DateTime.utc(2026, 10, 1, 12, 0, 1);
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('Final balance due in 23:59:59'), findsOneWidget);
  });

  testWidgets('51. Completed pending verification -> final countdown hidden', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': true,
          'balancePaymentDueAt': '2026-10-02T12:00:00Z',
          'isBalancePaymentDeadlineExpired': false,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('balance_payment_deadline_card')), findsNothing);
    expect(find.text('Payment verification pending'), findsOneWidget);
  });

  testWidgets('52. Completed fully paid -> final countdown hidden', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 800.0,
          'remainingAmount': 0.0,
          'status': 'FullyPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': null,
          'isBalancePaymentDeadlineExpired': false,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('balance_payment_deadline_card')), findsNothing);
    expect(find.text('Booking is fully paid.'), findsOneWidget);
  });

  testWidgets('53. Completed expired -> payment form hidden and support guidance shown', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': '2026-10-01T10:00:00Z',
          'isBalancePaymentDeadlineExpired': true,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('completed_balance_deadline_expired_card')), findsOneWidget);
    expect(find.text('Final payment deadline expired'), findsOneWidget);
    expect(find.text('Please contact TrailWise Support for assistance with the remaining balance.'), findsOneWidget);
    expect(find.text('Make a Payment'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Submit Payment'), findsNothing);
    expect(find.widgetWithText(OutlinedButton, 'Choose Bank Slip'), findsNothing);
    expect(find.byKey(const Key('advance_payment_deadline_card')), findsNothing);
    expect(find.byKey(const Key('payment_deadline_expired_card')), findsNothing);
  });

  testWidgets('54. Completed expired -> outstanding balance still displayed in financial summary', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 300.0,
          'remainingAmount': 500.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': '2026-10-01T10:00:00Z',
          'isBalancePaymentDeadlineExpired': true,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Financial Summary'), findsOneWidget);
    expect(find.text('Remaining Balance:'), findsOneWidget);
    expect(find.text('\$500.00'), findsOneWidget);
  });

  testWidgets('55. Completed legacy null deadline -> no countdown and compatible payment behavior', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': null,
          'isBalancePaymentDeadlineExpired': false,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('balance_payment_deadline_card')), findsNothing);
    expect(find.byKey(const Key('completed_balance_deadline_expired_card')), findsNothing);
    expect(find.text('Make a Payment'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Submit Payment'), findsOneWidget);
  });

  testWidgets('56. Completed timer stops at zero, cancels, and refreshes payment status without going negative', (tester) async {
    setTestViewport(tester);
    var currentTime = DateTime.utc(2026, 10, 1, 11, 59, 59);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': '2026-10-01T12:00:00Z',
          'isBalancePaymentDeadlineExpired': false,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': '2026-10-01T12:00:00Z',
          'isBalancePaymentDeadlineExpired': true,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => currentTime,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Final balance due in 00:00:01'), findsOneWidget);
    expect(client.getCallCount, 1);

    currentTime = DateTime.utc(2026, 10, 1, 12, 0, 0);
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();

    expect(client.getCallCount, 2);
    expect(find.byKey(const Key('balance_payment_deadline_card')), findsNothing);
    expect(find.textContaining('00:00:-'), findsNothing);
    expect(find.byKey(const Key('completed_balance_deadline_expired_card')), findsOneWidget);
  });

  testWidgets('57. Completed timer is disposed safely when screen is unmounted', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': '2026-10-02T12:00:00Z',
          'isBalancePaymentDeadlineExpired': false,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('balance_payment_deadline_card')), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 1));

    expect(find.byKey(const Key('balance_payment_deadline_card')), findsNothing);
  });

  testWidgets('58. Completed balance submission succeeds before deadline', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': '2026-10-02T12:00:00Z',
          'isBalancePaymentDeadlineExpired': false,
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'Pending',
          'hasPendingVerification': true,
        },
      ],
      postMultipartResponse: {
        'id': 'payment-balance-1',
        'status': 'Pending',
      },
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
        slipPicker: () async => _dummySlip(name: 'final_balance_slip.png', extension: 'png'),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('balance_payment_deadline_card')), findsOneWidget);

    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(client.postMultipartCallCount, 1);
    expect(client.recordedMultipartCalls.first.fields['amount'], '400.00');
  });

  testWidgets('59. Completed late submission shows backend deadline error', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 400.0,
          'remainingAmount': 400.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'balancePaymentDueAt': '2026-10-01T12:00:00Z',
          'isBalancePaymentDeadlineExpired': false,
        },
      ],
      postError: ApiException(
        400,
        'Final payment deadline has expired. Please contact support.',
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Completed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 11, 0, 0),
        slipPicker: () async => _dummySlip(name: 'late_slip.png', extension: 'png'),
      ),
    ));
    await tester.pumpAndSettle();

    final pickBtn = find.widgetWithText(OutlinedButton, 'Choose Bank Slip');
    await tester.ensureVisible(pickBtn);
    await tester.tap(pickBtn);
    await tester.pumpAndSettle();

    final submitBtn = find.widgetWithText(FilledButton, 'Submit Payment');
    await tester.ensureVisible(submitBtn);
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(find.text('Final payment deadline has expired. Please contact support.'), findsOneWidget);
  });

  test('60. PaymentStatusDto fromJson parses bookingStatus', () {
    final json = {
      'bookingId': 'booking-1',
      'totalCost': 1000.0,
      'totalPaid': 500.0,
      'remainingAmount': 500.0,
      'status': 'DepositPaid',
      'bookingStatus': 'Completed',
    };
    final dto = PaymentStatusDto.fromJson(json);
    expect(dto.bookingStatus, 'Completed');

    // Backward compatibility when absent
    final legacyDto = PaymentStatusDto.fromJson({
      'bookingId': 'booking-2',
      'totalCost': 1000.0,
      'totalPaid': 0.0,
      'remainingAmount': 1000.0,
      'status': 'Unpaid',
    });
    expect(legacyDto.bookingStatus, isNull);
  });

  testWidgets('61. Stale widget Confirmed + API Completed uses Completed', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 1000.0,
          'totalPaid': 500.0,
          'remainingAmount': 500.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'bookingStatus': 'Completed',
          'balancePaymentDueAt': '2026-10-02T12:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Confirmed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    // Effective status displays Completed, not stale Confirmed
    expect(find.text('Completed'), findsOneWidget);
    // Shows balance guidance card
    expect(find.text('Balance payment'), findsOneWidget);
  });

  testWidgets('62. Balance countdown appears when API says Completed', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 1000.0,
          'totalPaid': 500.0,
          'remainingAmount': 500.0,
          'status': 'DepositPaid',
          'hasPendingVerification': false,
          'bookingStatus': 'Completed',
          'balancePaymentDueAt': '2026-10-01T14:30:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Confirmed'), // stale widget status
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('balance_payment_deadline_card')), findsOneWidget);
    expect(find.text('Final balance due in 02:30:00'), findsOneWidget);
  });

  testWidgets('63. Advance countdown appears when API says Confirmed + PaymentDueAt', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 1000.0,
          'totalPaid': 0.0,
          'remainingAmount': 1000.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'bookingStatus': 'Confirmed',
          'paymentDueAt': '2026-10-01T13:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'PendingApproval'), // stale widget status
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('advance_payment_deadline_card')), findsOneWidget);
    expect(find.text('Advance payment due in 01:00:00'), findsOneWidget);
  });

  testWidgets('64. Live API lifecycle status overrides stale widget status', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'bookingStatus': 'Confirmed',
          'paymentDueAt': '2026-10-01T13:00:00Z',
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Requested'), // Non-payable Requested in widget
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 0, 0),
      ),
    ));
    await tester.pumpAndSettle();

    // Since API says Confirmed, payment form is rendered
    expect(find.text('Make a Payment'), findsOneWidget);
    expect(find.text('Confirmed'), findsOneWidget);
  });

  testWidgets('65. Timer still stops at zero', (tester) async {
    setTestViewport(tester);
    var currentTime = DateTime.utc(2026, 10, 1, 12, 59, 58);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'bookingStatus': 'Confirmed',
          'paymentDueAt': '2026-10-01T13:00:00Z',
        },
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'bookingStatus': 'Confirmed',
          'paymentDueAt': '2026-10-01T13:00:00Z',
          'isPaymentDeadlineExpired': true,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Confirmed'),
        apiClient: client,
        nowProvider: () => currentTime,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Advance payment due in 00:00:02'), findsOneWidget);

    currentTime = DateTime.utc(2026, 10, 1, 13, 0, 2);
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();

    // Countdown does not show negative time, card transitions to expired
    expect(find.textContaining('-00:'), findsNothing);
  });

  testWidgets('66. Expired states remain correct', (tester) async {
    setTestViewport(tester);
    final client = RecordingApiClient(
      getStatusResponses: [
        {
          'bookingId': 'booking-1',
          'totalCost': 800.0,
          'totalPaid': 0.0,
          'remainingAmount': 800.0,
          'status': 'Unpaid',
          'hasPendingVerification': false,
          'bookingStatus': 'Confirmed',
          'paymentDueAt': '2026-10-01T12:00:00Z',
          'isPaymentDeadlineExpired': true,
        },
      ],
    );

    await tester.pumpWidget(MaterialApp(
      home: PaymentStatusScreen(
        booking: _fixtureBooking(status: 'Confirmed'),
        apiClient: client,
        nowProvider: () => DateTime.utc(2026, 10, 1, 12, 30, 0),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('payment_deadline_expired_card')), findsOneWidget);
    expect(find.text('Payment deadline expired'), findsOneWidget);
  });
}
