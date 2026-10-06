import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/packages/package_reviews_sheet.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';

import '../fakes/fake_api_client.dart';

Widget _app(ApiClient api, bool dark) => MaterialApp(
      theme: dark ? AppTheme.dark : AppTheme.light,
      home: Scaffold(
        body: PackageReviewsBottomSheet(
          packageId: 'pkg-1',
          packageName: 'The Extraordinarily Long Cultural Triangle Explorer Experience',
          apiClient: api,
        ),
      ),
    );

void main() {
  for (final dark in [false, true]) {
    testWidgets('Reviews sheet fits 360 dp: reviews, empty, error (dark=$dark)', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await tester.pumpWidget(_app(
          FakeApiClient(getResponses: {
            '/api/packages/pkg-1/reviews': {
              'tourPackageId': 'pkg-1',
              'averageRating': 4.5,
              'totalReviews': 1,
              'reviews': [
                {
                  'id': 'r1',
                  'rating': 5,
                  'comment': 'A wonderful trip with a very long comment that has to wrap over several lines at 360 dp.',
                  'submittedAt': '2026-09-29T12:00:00Z',
                  'reviewerDisplayName': 'Verified Traveler With A Long Name',
                  'isVerifiedTrip': true,
                },
              ],
            },
          }),
          dark));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_app(FakeApiClient(getError: ApiException(500, 'Failed')), dark));
      await tester.pumpAndSettle();
      expect(find.text('Retry'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
