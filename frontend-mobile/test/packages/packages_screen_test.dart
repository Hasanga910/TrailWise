import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:trailwise_mobile/packages/packages_screen.dart';

import '../fakes/fake_api_client.dart';

Map<String, dynamic> _packageJson() => {
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

void main() {
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
}
