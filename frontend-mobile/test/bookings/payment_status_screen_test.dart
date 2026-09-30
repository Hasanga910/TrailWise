import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/my_bookings_screen.dart';
import 'package:trailwise_mobile/bookings/payment_status_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/package_tier.dart';

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
}
