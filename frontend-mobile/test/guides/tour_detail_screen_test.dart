import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/guides/tour_detail_screen.dart';
import 'package:trailwise_mobile/models/assigned_tour.dart';

import '../fakes/fake_api_client.dart';

AssignedTour _sampleTour({
  String bookingId = 'booking-123',
  String tourPackageName = 'Sigiriya & Dambulla Explorer',
  String theme = 'Cultural Heritage',
  String startDate = '2026-11-01',
  String endDate = '2026-11-03',
  int groupSize = 5,
  String status = 'Confirmed',
  List<String> locations = const ['Sigiriya', 'Dambulla'],
  String? specialRequests = 'Need English audio guide',
  bool attended = false,
  bool completed = false,
  String? guideNotes,
}) =>
    AssignedTour(
      bookingId: bookingId,
      startDate: startDate,
      endDate: endDate,
      groupSize: groupSize,
      status: status,
      tourPackageId: 'pkg-1',
      tourPackageName: tourPackageName,
      theme: theme,
      locations: locations,
      specialRequests: specialRequests,
      guideId: 'guide-1',
      guideName: 'Nimal Guide',
      attended: attended,
      completed: completed,
      guideNotes: guideNotes,
    );

void main() {
  group('AssignedTour Model (Task C2 fields)', () {
    test('1. AssignedTour.fromJson parses attended/completed/guideNotes correctly', () {
      final json = {
        'bookingId': 'b-42',
        'startDate': '2026-10-15',
        'endDate': '2026-10-18',
        'groupSize': 3,
        'status': 'Confirmed',
        'tourPackageId': 'p-1',
        'tourPackageName': 'Ella Adventure Trek',
        'theme': 'Adventure',
        'locations': ['Ella', 'Nine Arch Bridge'],
        'specialRequests': 'Early morning start',
        'guideId': 'g-10',
        'guideName': 'Kamal Guide',
        'attended': true,
        'completed': true,
        'guideNotes': 'Travelers arrived on time and completed all trails.',
      };

      final tour = AssignedTour.fromJson(json);

      expect(tour.attended, isTrue);
      expect(tour.completed, isTrue);
      expect(tour.guideNotes, 'Travelers arrived on time and completed all trails.');
    });

    test('AssignedTour.fromJson defaults attended and completed to false when absent or null', () {
      final json = {
        'bookingId': 'b-42',
        'startDate': '2026-10-15',
        'endDate': '2026-10-18',
        'groupSize': 3,
        'status': 'Confirmed',
        'tourPackageId': 'p-1',
        'tourPackageName': 'Ella Adventure Trek',
        'theme': 'Adventure',
        'locations': ['Ella'],
        'specialRequests': null,
        'guideId': 'g-10',
        'guideName': 'Kamal Guide',
      };

      final tour = AssignedTour.fromJson(json);

      expect(tour.attended, isFalse);
      expect(tour.completed, isFalse);
      expect(tour.guideNotes, isNull);
    });
  });

  group('TourDetailScreen', () {
    testWidgets('2. Tour detail screen displays existing values correctly', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(
        tourPackageName: 'Sigiriya & Dambulla Explorer',
        theme: 'Cultural Heritage',
        status: 'Confirmed',
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        groupSize: 5,
        locations: ['Sigiriya', 'Dambulla'],
        specialRequests: 'Need English audio guide',
        attended: true,
        completed: false,
        guideNotes: 'Initial guide notes from backend',
      );

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Sigiriya & Dambulla Explorer'), findsOneWidget);
      expect(find.text('Cultural Heritage'), findsOneWidget);
      expect(find.text('Confirmed'), findsOneWidget);
      expect(find.text('2026-11-01 to 2026-11-03'), findsOneWidget);
      expect(find.text('5 travelers'), findsOneWidget);
      expect(find.text('Locations: Sigiriya, Dambulla'), findsOneWidget);
      expect(find.text('Special requests: Need English audio guide'), findsOneWidget);

      final attendedSwitch = tester.widget<SwitchListTile>(
        find.widgetWithText(SwitchListTile, 'Attended'),
      );
      expect(attendedSwitch.value, isTrue);

      final completedSwitch = tester.widget<SwitchListTile>(
        find.widgetWithText(SwitchListTile, 'Completed'),
      );
      expect(completedSwitch.value, isFalse);
    });

    testWidgets('3. Toggling attendance changes local state', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(attended: false);

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      final attendedFinder = find.widgetWithText(SwitchListTile, 'Attended');
      expect(tester.widget<SwitchListTile>(attendedFinder).value, isFalse);

      await tester.tap(attendedFinder);
      await tester.pumpAndSettle();

      expect(tester.widget<SwitchListTile>(attendedFinder).value, isTrue);
    });

    testWidgets('4. Toggling completion changes local state', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(completed: false);

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      final completedFinder = find.widgetWithText(SwitchListTile, 'Completed');
      expect(tester.widget<SwitchListTile>(completedFinder).value, isFalse);

      await tester.tap(completedFinder);
      await tester.pumpAndSettle();

      expect(tester.widget<SwitchListTile>(completedFinder).value, isTrue);
    });

    testWidgets('5. Existing guide notes appear in text field', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(guideNotes: 'Group arrived smoothly at hotel');

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Group arrived smoothly at hotel'), findsOneWidget);
    });

    testWidgets('6. Save sends correct PATCH payload', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(
        bookingId: 'booking-999',
        attended: false,
        completed: false,
        guideNotes: 'First note',
      );

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      // Toggle attendance
      await tester.tap(find.widgetWithText(SwitchListTile, 'Attended'));
      // Toggle completion
      await tester.tap(find.widgetWithText(SwitchListTile, 'Completed'));
      // Edit notes
      final notesField = find.widgetWithText(TextField, 'Guide Notes');
      await tester.enterText(notesField, 'Traveler group arrived on time.');
      await tester.pumpAndSettle();

      // Tap Save Updates
      await tester.tap(find.widgetWithText(FilledButton, 'Save Updates'));
      await tester.pumpAndSettle();

      expect(fake.patchCalls.length, 1);
      final call = fake.patchCalls.first;
      expect(call['path'], '/api/bookings/booking-999/guide-notes');
      expect(call['body'], {
        'attended': true,
        'completed': true,
        'notes': 'Traveler group arrived on time.',
      });
    });

    testWidgets('7. Save success shows confirmation', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour();

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(FilledButton, 'Save Updates'));
      await tester.pumpAndSettle();

      expect(find.text('Tour updates saved successfully'), findsOneWidget);
    });

    testWidgets('8. API error shows an error message', (tester) async {
      final fake = FakeApiClient(
        patchError: ApiException(400, 'Unable to update guide notes at this time.'),
      );
      final tour = _sampleTour();

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(FilledButton, 'Save Updates'));
      await tester.pumpAndSettle();

      expect(find.text('Unable to update guide notes at this time.'), findsAtLeastNWidgets(1));
    });
  });
}
