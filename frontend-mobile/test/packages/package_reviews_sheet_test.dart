import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/packages/package_reviews_sheet.dart';

import '../fakes/fake_api_client.dart';

class _ControllableFakeApiClient extends ApiClient {
  _ControllableFakeApiClient({
    this.completer,
    this.initialError,
    this.successResponse,
  });

  Completer<dynamic>? completer;
  ApiException? initialError;
  dynamic successResponse;
  int callCount = 0;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    callCount++;
    if (completer != null) {
      return completer!.future;
    }
    if (initialError != null && callCount == 1) {
      throw initialError!;
    }
    return successResponse;
  }
}

void main() {
  Widget buildSheet({
    required ApiClient apiClient,
    String packageId = 'pkg-1',
    String packageName = 'Ella Mountain Hike',
  }) {
    return MaterialApp(
      home: Scaffold(
        body: PackageReviewsBottomSheet(
          packageId: packageId,
          packageName: packageName,
          apiClient: apiClient,
        ),
      ),
    );
  }

  testWidgets('7. Reviews viewer loading state', (tester) async {
    final completer = Completer<dynamic>();
    final fake = _ControllableFakeApiClient(completer: completer);

    await tester.pumpWidget(buildSheet(apiClient: fake));
    // Initial pump without settling
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    completer.complete({
      'tourPackageId': 'pkg-1',
      'averageRating': 0.0,
      'totalReviews': 0,
      'reviews': <dynamic>[],
    });
    await tester.pumpAndSettle();

    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets(
      '8, 9, 10, 11, 12, 13. Reviews viewer renders average rating, total reviews, and review card details',
      (tester) async {
    final fake = FakeApiClient(getResponses: {
      '/api/packages/pkg-1/reviews': {
        'tourPackageId': 'pkg-1',
        'averageRating': 4.5,
        'totalReviews': 1,
        'reviews': [
          {
            'id': 'rev-1',
            'rating': 5,
            'comment': 'Stunning sunrise over the mountains!',
            'submittedAt': '2026-09-29T12:00:00Z',
            'reviewerDisplayName': 'Verified Traveler',
            'isVerifiedTrip': true,
          }
        ],
      },
    });

    await tester.pumpWidget(buildSheet(apiClient: fake));
    await tester.pumpAndSettle();

    // 8. Renders average rating
    expect(find.text('4.5'), findsOneWidget);

    // 9. Renders total reviews
    expect(find.textContaining('1 review'), findsOneWidget);

    // 10. Review card renders stars
    expect(find.byIcon(Icons.star), findsWidgets);
    expect(find.text('5/5'), findsOneWidget);

    // 11. Review card renders "Verified Traveler"
    expect(find.text('Verified Traveler'), findsOneWidget);

    // 12. Review card renders "Verified Trip"
    expect(find.text('Verified Trip'), findsOneWidget);

    // 13. Review card renders comment
    expect(find.text('Stunning sunrise over the mountains!'), findsOneWidget);

    // Formatted date renders
    expect(find.textContaining('Sep 2026'), findsOneWidget);
  });

  testWidgets('14. Empty review state displays placeholder text', (tester) async {
    final fake = FakeApiClient(getResponses: {
      '/api/packages/pkg-1/reviews': {
        'tourPackageId': 'pkg-1',
        'averageRating': 0.0,
        'totalReviews': 0,
        'reviews': <dynamic>[],
      },
    });

    await tester.pumpWidget(buildSheet(apiClient: fake));
    await tester.pumpAndSettle();

    expect(find.text('No reviews yet'), findsOneWidget);
    expect(
      find.text('Be the first verified traveler to review this tour after completing a trip.'),
      findsOneWidget,
    );
  });

  testWidgets('15. API error state provides Retry button', (tester) async {
    final fake = _ControllableFakeApiClient(
      initialError: ApiException(500, 'Failed to fetch reviews'),
      successResponse: {
        'tourPackageId': 'pkg-1',
        'averageRating': 5.0,
        'totalReviews': 1,
        'reviews': [
          {
            'id': 'rev-1',
            'rating': 5,
            'comment': 'Recovered after retry!',
            'submittedAt': '2026-09-29T12:00:00Z',
            'reviewerDisplayName': 'Verified Traveler',
            'isVerifiedTrip': true,
          }
        ],
      },
    );

    await tester.pumpWidget(buildSheet(apiClient: fake));
    await tester.pumpAndSettle();

    // Verify error message and Retry button
    expect(find.text('Failed to fetch reviews'), findsOneWidget);
    final retryButton = find.widgetWithText(FilledButton, 'Retry');
    expect(retryButton, findsOneWidget);

    // Tap retry
    await tester.tap(retryButton);
    await tester.pumpAndSettle();

    // Loaded state displays
    expect(find.text('Recovered after retry!'), findsOneWidget);
    expect(find.text('Failed to fetch reviews'), findsNothing);
  });
}
