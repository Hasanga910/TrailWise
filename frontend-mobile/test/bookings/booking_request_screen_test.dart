import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/bookings/booking_request_screen.dart';
import 'package:trailwise_mobile/models/package_tier.dart';
import 'package:trailwise_mobile/models/tour_package.dart';

import '../fakes/fake_api_client.dart';

TourPackage _fixturePackage() => TourPackage(
      id: 'pkg-1',
      name: 'Cultural Triangle Explorer',
      theme: 'Cultural',
      durationDays: 4,
      basePricePerPerson: 250,
      maxGroupSize: 12,
      photoUrl: null,
      tiers: const [],
      locations: const [],
    );

PackageTier _fixtureTier() => PackageTier(
      id: 'tier-1',
      classType: 'Normal',
      includesFood: false,
      basePricePerPerson: 250,
      requiresAC: false,
    );

Future<void> _pickDate(WidgetTester tester, String label) async {
  await tester.tap(find.widgetWithText(InputDecorator, label));
  await tester.pumpAndSettle();
  await tester.tap(find.text('OK'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('BookingRequestScreen renders backend field errors next to the right fields',
      (tester) async {
    final fake = FakeApiClient(
      postError: ApiException(
        400,
        'Please correct the highlighted fields.',
        fieldErrors: [FieldError('groupSize', 'Group size cannot exceed 12 for this package.')],
      ),
    );

    await tester.pumpWidget(MaterialApp(
      home: BookingRequestScreen(package: _fixturePackage(), tier: _fixtureTier(), apiClient: fake),
    ));

    await _pickDate(tester, 'Start date');
    await _pickDate(tester, 'End date');

    await tester.enterText(find.widgetWithText(TextField, 'Group size'), '13');
    await tester.enterText(find.widgetWithText(TextField, 'Budget per person'), '300');

    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Submit request'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Submit request'));
    await tester.pumpAndSettle();

    expect(find.text('Group size cannot exceed 12 for this package.'), findsOneWidget);
  });
}
