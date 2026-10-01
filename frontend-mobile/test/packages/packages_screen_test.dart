import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/models/tour_package.dart';
import 'package:trailwise_mobile/packages/package_reviews_sheet.dart';
import 'package:trailwise_mobile/packages/packages_screen.dart';

import '../fakes/fake_api_client.dart';

Map<String, dynamic> _packageJson({
  double? averageRating,
  int? reviewCount,
}) {
  final json = <String, dynamic>{
    'id': 'pkg-1',
    'name': 'Cultural Triangle Explorer',
    'theme': 'Cultural',
    'durationDays': 4,
    'basePricePerPerson': 250,
    'maxGroupSize': 12,
    'photoUrl': null,
    'tiers': [
      {
        'id': 'tier-1',
        'classType': 'Normal',
        'includesFood': false,
        'basePricePerPerson': 250,
        'requiresAC': false,
      },
    ],
    'locations': <dynamic>[],
  };
  if (averageRating != null) json['averageRating'] = averageRating;
  if (reviewCount != null) json['reviewCount'] = reviewCount;
  return json;
}

void main() {
  group('1 & 2. TourPackage Model Parsing', () {
    test('1. Package model parses averageRating', () {
      final pkg = TourPackage.fromJson(_packageJson(averageRating: 4.8, reviewCount: 12));
      expect(pkg.averageRating, 4.8);
    });

    test('2. Package model parses reviewCount', () {
      final pkg = TourPackage.fromJson(_packageJson(averageRating: 4.8, reviewCount: 12));
      expect(pkg.reviewCount, 12);
    });

    test('Package model defaults averageRating to 0.0 and reviewCount to 0 when omitted', () {
      final pkg = TourPackage.fromJson(_packageJson());
      expect(pkg.averageRating, 0.0);
      expect(pkg.reviewCount, 0);
    });
  });

  group('3-6. Package Card Review Summary UI', () {
    testWidgets('3 & 4. Package with reviews shows ★ rating and count', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/packages': [_packageJson(averageRating: 4.8, reviewCount: 12)],
      });

      await tester.pumpWidget(MaterialApp(home: PackagesScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.textContaining('★ 4.8'), findsOneWidget);
      expect(find.textContaining('12 reviews'), findsOneWidget);
    });

    testWidgets('5. Package with no reviews shows "No reviews yet"', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/packages': [_packageJson(averageRating: 0.0, reviewCount: 0)],
      });

      await tester.pumpWidget(MaterialApp(home: PackagesScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.text('No reviews yet'), findsOneWidget);
    });

    testWidgets('6. Tapping review summary opens reviews viewer', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/packages': [_packageJson(averageRating: 4.8, reviewCount: 12)],
        '/api/packages/pkg-1/reviews': {
          'tourPackageId': 'pkg-1',
          'averageRating': 4.8,
          'totalReviews': 12,
          'reviews': [
            {
              'id': 'rev-1',
              'rating': 5,
              'comment': 'Unforgettable experience!',
              'submittedAt': '2026-09-29T10:00:00Z',
              'reviewerDisplayName': 'Verified Traveler',
              'isVerifiedTrip': true,
            }
          ],
        },
      });

      await tester.pumpWidget(MaterialApp(home: PackagesScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      // Tap the rating/review summary
      await tester.tap(find.textContaining('★ 4.8'));
      await tester.pumpAndSettle();

      // Verify the bottom sheet opened
      expect(find.byType(PackageReviewsBottomSheet), findsOneWidget);
      expect(find.text('Cultural Triangle Explorer'), findsWidgets);
      expect(find.text('Unforgettable experience!'), findsOneWidget);
    });

    testWidgets('PackagesScreen renders packages and a Request button', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/packages': [_packageJson()],
      });

      await tester.pumpWidget(MaterialApp(home: PackagesScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.text('Cultural Triangle Explorer'), findsOneWidget);
      expect(find.text('Request'), findsOneWidget);
    });

    testWidgets('PackagesScreen shows an empty state', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/packages': <dynamic>[],
      });

      await tester.pumpWidget(MaterialApp(home: PackagesScreen(apiClient: fake)));
      await tester.pumpAndSettle();

      expect(find.text('No tour packages yet.'), findsOneWidget);
    });
  });

  testWidgets('PackagesScreen shows Access Restricted when accessed by TourGuide', (tester) async {
    final fake = FakeApiClient();
    final guideUser = CurrentUser(
      id: 'guide-1',
      name: 'Guide Alpha',
      email: 'guide@trailwise.com',
      role: 'TourGuide',
    );

    await tester.pumpWidget(MaterialApp(
      home: PackagesScreen(
        apiClient: fake,
        currentUser: guideUser,
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Access Restricted'), findsOneWidget);
    expect(find.textContaining('only available to Travelers'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Go Back'), findsOneWidget);
    expect(find.text('Request'), findsNothing);
  });
}
