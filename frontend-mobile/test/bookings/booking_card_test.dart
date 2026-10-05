import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/bookings/my_bookings_screen.dart';
import 'package:trailwise_mobile/bookings/review_screen.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/package_tier.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';
import 'package:trailwise_mobile/widgets/widgets.dart';

import '../fakes/fake_api_client.dart';

Map<String, dynamic> _booking({
  String status = 'Confirmed',
  bool guide = true,
  int group = 4,
}) => {
  'id': 'b1',
  'travelerId': 't',
  'tourPackageId': 'p',
  'tourPackageName': 'Cultural Triangle Explorer',
  'packageTier': {
    'id': 'x',
    'classType': 'Second',
    'includesFood': true,
    'basePricePerPerson': 320,
    'requiresAC': true,
  },
  'groupSize': group,
  'startDate': '2030-11-01',
  'endDate': '2030-11-04',
  'budgetPerPerson': 350,
  'status': status,
  'isLargeGroup': group >= 10,
  'hasReview': false,
  'isFullyPaid': false,
  'hasPendingPayment': false,
  if (guide)
    'assignedGuide': {
      'id': 'g',
      'name': 'Nimal Perera',
      'contactInfo': '+94771234567',
      'languages': ['English'],
      'specializations': ['Cultural'],
    },
};

final _traveler = CurrentUser(
  id: 'u',
  name: 'T',
  email: 't@x.com',
  role: 'Traveler',
);

void main() {
  testWidgets(
    'booking card: title, badge, dated rows with icons, guide panel and actions',
    (tester) async {
      final api = FakeApiClient(
        getResponses: {
          '/api/bookings/mine': {
            'items': [
              _booking(),
              _booking(status: 'PendingApproval', guide: false, group: 12),
            ],
            'totalCount': 2,
            'page': 1,
            'pageSize': 10,
          },
        },
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: MyBookingsScreen(apiClient: api, currentUser: _traveler),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Cultural Triangle Explorer — Second'),
        findsNWidgets(2),
      );
      expect(find.byType(StatusBadge), findsNWidgets(2));
      expect(find.text('2030-11-01 to 2030-11-04'), findsNWidgets(2));
      expect(find.text('4 travelers'), findsOneWidget);
      expect(find.text('12 travelers'), findsOneWidget);
      expect(find.text('\$350.00/person'), findsNWidgets(2));
      expect(find.byIcon(Icons.calendar_today_outlined), findsNWidgets(2));
      expect(find.text('Tour Guide: Nimal Perera'), findsOneWidget);
      expect(find.text('Tour Guide not assigned yet'), findsOneWidget);
      expect(find.text('Large group'), findsOneWidget);
      expect(find.text('Cancel Booking'), findsWidgets);
    },
  );

  testWidgets('review summary uses the same icon rows', (tester) async {
    final booking = Booking.fromJson(_booking(status: 'Completed'));
    expect(booking.packageTier, isA<PackageTier>());
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: ReviewScreen(booking: booking, apiClient: FakeApiClient()),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Cultural Triangle Explorer'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('2030-11-01 to 2030-11-04'), findsOneWidget);
    expect(find.text('Second Class'), findsOneWidget);
    expect(find.text('4 travelers'), findsOneWidget);
  });
}
