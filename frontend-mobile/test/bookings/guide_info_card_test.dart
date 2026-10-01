import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/bookings/guide_info_card.dart';
import 'package:trailwise_mobile/models/booking.dart';

void main() {
  group('GuideInfoCard', () {
    testWidgets('displays assigned guide card with name, contact, languages and specializations', (tester) async {
      final guide = AssignedGuide(
        id: 'guide-123',
        name: 'Janindu',
        contactInfo: '0775645000',
        languages: const ['Sinhala', 'English'],
        specializations: const ['Cultural', 'Wildlife'],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: GuideInfoCard(guide: guide),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Card title & status
      expect(find.text('Assigned Tour Guide'), findsOneWidget);
      expect(find.text('Assigned'), findsOneWidget);

      // Name & contact
      expect(find.text('Janindu'), findsOneWidget);
      expect(find.text('0775645000'), findsOneWidget);

      // Languages chips
      expect(find.text('Sinhala'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);

      // Specialization chips
      expect(find.text('Cultural'), findsOneWidget);
      expect(find.text('Wildlife'), findsOneWidget);
    });

    testWidgets('displays no-guide state when guide is null', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: GuideInfoCard(guide: null),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Assigned Tour Guide'), findsOneWidget);
      expect(find.text('Tour Guide not assigned yet'), findsOneWidget);
      expect(find.text('Janindu'), findsNothing);
    });

    testWidgets('displays fallback contact when contactInfo is null or empty', (tester) async {
      final guide = AssignedGuide(
        id: 'guide-456',
        name: 'Kasun Perera',
        contactInfo: null,
        languages: const ['English'],
        specializations: const [],
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: GuideInfoCard(guide: guide),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Kasun Perera'), findsOneWidget);
      expect(find.text('Not provided'), findsOneWidget);
    });
  });
}
