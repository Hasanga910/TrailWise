import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/packages/packages_screen.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';

import '../fakes/fake_api_client.dart';

Map<String, dynamic> _pkg({String? photo, List<Map<String, dynamic>>? tiers}) => {
      'id': 'p1',
      'name': 'Cultural Triangle Explorer',
      'theme': 'Cultural',
      'durationDays': 4,
      'basePricePerPerson': 250,
      'maxGroupSize': 12,
      'photoUrl': photo,
      'tiers': tiers ??
          [
            {'id': 't1', 'classType': 'First', 'includesFood': true, 'basePricePerPerson': 1450, 'requiresAC': true},
            {'id': 't2', 'classType': 'Normal', 'includesFood': false, 'basePricePerPerson': 250, 'requiresAC': false},
          ],
      'locations': [
        {'id': 'l1', 'name': 'Sigiriya, Central Province'},
        {'id': 'l2', 'name': 'Dambulla'},
        {'id': 'l3', 'name': 'Anuradhapura'},
        {'id': 'l4', 'name': 'Polonnaruwa'},
      ],
    };

final _traveler = CurrentUser(id: 'u', name: 'T', email: 't@x.com', role: 'Traveler');

Future<void> _pump(WidgetTester tester, Map<String, dynamic> pkg, {bool dark = false}) async {
  await tester.pumpWidget(MaterialApp(
    theme: dark ? AppTheme.dark : AppTheme.light,
    home: PackagesScreen(
      apiClient: FakeApiClient(getResponses: {
        '/api/packages': [pkg],
      }),
      currentUser: _traveler,
    ),
  ));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('card shows theme badge, location summary, meta, badges and a From price', (tester) async {
    await _pump(tester, _pkg());
    expect(find.text('Cultural'), findsOneWidget);
    expect(find.text('Sigiriya · Dambulla · Anuradhapura +1 more'), findsOneWidget);
    expect(find.text('4 days'), findsOneWidget);
    expect(find.text('Up to 12'), findsOneWidget);
    expect(find.text('Normal'), findsWidgets);
    expect(find.text('AC'), findsOneWidget);
    expect(find.text('Food'), findsOneWidget);
    expect(find.text('From'), findsOneWidget);
    // Lowest tier price, whole dollars.
    expect(find.textContaining(r'$250 /person', findRichText: true), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Request'), findsNWidgets(2));
  });

  testWidgets('without a photo (or when it fails to load) a branded placeholder is shown',
      (tester) async {
    await _pump(tester, _pkg());
    expect(find.byIcon(Icons.landscape_outlined), findsOneWidget);
    expect(find.byType(Image), findsNothing);

    await tester.pumpWidget(const SizedBox());
    await _pump(tester, _pkg(photo: '/uploads/p1.webp'));
    // Image.network fails in tests (HTTP is blocked) and falls back to the placeholder.
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.landscape_outlined), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a package without tiers falls back to the base price', (tester) async {
    await _pump(tester, _pkg(tiers: []));
    expect(find.textContaining(r'$250 /person', findRichText: true), findsOneWidget);
    expect(find.text('Request'), findsNothing);
  });
}
