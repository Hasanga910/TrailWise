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
  DateTime? tourStartedAt,
  DateTime? tourEndedAt,
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
      tourStartedAt: tourStartedAt,
      tourEndedAt: tourEndedAt,
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

      // Completed toggle must NOT be present in Tour Management
      expect(find.widgetWithText(SwitchListTile, 'Completed'), findsNothing);
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

    testWidgets('4. Completed toggle is absent and Attended toggle is present', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(completed: false);

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(SwitchListTile, 'Completed'), findsNothing);
      expect(find.widgetWithText(SwitchListTile, 'Attended'), findsOneWidget);
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

    testWidgets('6. Save sends correct PATCH payload with attended and notes (without completed)', (tester) async {
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
      // Edit notes
      final notesField = find.widgetWithText(TextField, 'Guide Notes');
      await tester.enterText(notesField, 'Traveler group arrived on time.');
      await tester.pumpAndSettle();

      // Tap Save Updates
      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Save Updates'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Save Updates'));
      await tester.pumpAndSettle();

      expect(fake.patchCalls.length, 1);
      final call = fake.patchCalls.first;
      expect(call['path'], '/api/bookings/booking-999/guide-notes');
      expect(call['body'], {
        'attended': true,
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

      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Save Updates'));
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

      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Save Updates'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Save Updates'));
      await tester.pumpAndSettle();

      expect(find.text('Unable to update guide notes at this time.'), findsAtLeastNWidgets(1));
    });

    testWidgets('9. Clear Note button is hidden when note is null or empty', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(guideNotes: null);

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Clear Note'), findsNothing);
    });

    testWidgets('10. Clear Note button is visible when note exists', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(guideNotes: 'Some existing note');

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(OutlinedButton, 'Clear Note'), findsOneWidget);
    });

    testWidgets('11. Clear Note confirmation Cancel does not clear note', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(guideNotes: 'Keep this note');

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      // Tap Clear Note to open dialog
      await tester.ensureVisible(find.widgetWithText(OutlinedButton, 'Clear Note'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Clear Note'));
      await tester.pumpAndSettle();

      // Verify dialog is shown
      expect(find.text('Remove this guide note?'), findsOneWidget);

      // Tap Cancel
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();

      // Note text is still in text field and no patch was sent
      expect(find.text('Keep this note'), findsOneWidget);
      expect(fake.patchCalls.isEmpty, isTrue);
    });

    testWidgets('12. Clear Note confirmation Clear sends API request with notes=null and clears note', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(
        bookingId: 'b-clear-1',
        attended: true,
        completed: false,
        guideNotes: 'Remove this note',
      );

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      // Tap Clear Note
      await tester.ensureVisible(find.widgetWithText(OutlinedButton, 'Clear Note'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Clear Note'));
      await tester.pumpAndSettle();

      // Tap Clear in dialog
      await tester.tap(find.widgetWithText(FilledButton, 'Clear'));
      await tester.pumpAndSettle();

      // API called with null notes and preserved attended/completed
      expect(fake.patchCalls.length, 1);
      final call = fake.patchCalls.first;
      expect(call['path'], '/api/bookings/b-clear-1/guide-notes');
      expect(call['body'], {
        'attended': true,
        'notes': null,
      });

      // SnackBar shown and textfield cleared
      expect(find.text('Guide note cleared.'), findsOneWidget);
      expect(find.text('Remove this note'), findsNothing);
      expect(find.widgetWithText(OutlinedButton, 'Clear Note'), findsNothing);
    });

    testWidgets('13. Start Tour is shown initially and End Tour is hidden', (tester) async {
      final fake = FakeApiClient();
      final tour = _sampleTour(tourStartedAt: null, tourEndedAt: null);

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(FilledButton, 'Start Tour'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'End Tour'), findsNothing);
      expect(find.text('Tour Started'), findsNothing);
      expect(find.text('Tour Completed'), findsNothing);
    });

    testWidgets('14. Tapping Start Tour calls API and UI updates to Tour Started', (tester) async {
      final startedTime = DateTime.parse('2026-11-01T08:30:00Z');
      final fake = FakeApiClient(
        postResponses: {
          '/api/bookings/b-start-1/start-tour': {
            'bookingId': 'b-start-1',
            'startDate': '2026-11-01',
            'endDate': '2026-11-03',
            'groupSize': 5,
            'status': 'Confirmed',
            'tourPackageId': 'pkg-1',
            'tourPackageName': 'Sigiriya & Dambulla Explorer',
            'theme': 'Cultural Heritage',
            'locations': ['Sigiriya', 'Dambulla'],
            'specialRequests': null,
            'guideId': 'g-1',
            'guideName': 'Nimal Guide',
            'attended': false,
            'completed': false,
            'guideNotes': null,
            'tourStartedAt': startedTime.toIso8601String(),
            'tourEndedAt': null,
          }
        },
      );

      final tour = _sampleTour(bookingId: 'b-start-1');

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      // Tap Start Tour
      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Start Tour'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Start Tour'));
      await tester.pumpAndSettle();

      expect(fake.postCalls.length, 1);
      expect(fake.postCalls.first['path'], '/api/bookings/b-start-1/start-tour');

      expect(find.text('Tour started successfully.'), findsOneWidget);
      expect(find.text('Tour Started'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'End Tour'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Start Tour'), findsNothing);
    });

    testWidgets('15. Tapping End Tour calls API and UI updates to Tour Completed', (tester) async {
      final startedTime = DateTime.parse('2026-11-01T08:30:00Z');
      final endedTime = DateTime.parse('2026-11-03T17:00:00Z');
      final fake = FakeApiClient(
        postResponses: {
          '/api/bookings/b-end-1/end-tour': {
            'bookingId': 'b-end-1',
            'startDate': '2026-11-01',
            'endDate': '2026-11-03',
            'groupSize': 5,
            'status': 'Confirmed',
            'tourPackageId': 'pkg-1',
            'tourPackageName': 'Sigiriya & Dambulla Explorer',
            'theme': 'Cultural Heritage',
            'locations': ['Sigiriya', 'Dambulla'],
            'specialRequests': null,
            'guideId': 'g-1',
            'guideName': 'Nimal Guide',
            'attended': true,
            'completed': true,
            'guideNotes': null,
            'tourStartedAt': startedTime.toIso8601String(),
            'tourEndedAt': endedTime.toIso8601String(),
          }
        },
      );

      final tour = _sampleTour(
        bookingId: 'b-end-1',
        tourStartedAt: startedTime,
        tourEndedAt: null,
      );

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      // End Tour is visible initially because tour was started
      expect(find.widgetWithText(FilledButton, 'End Tour'), findsOneWidget);

      await tester.ensureVisible(find.widgetWithText(FilledButton, 'End Tour'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'End Tour'));
      await tester.pumpAndSettle();

      expect(fake.postCalls.length, 1);
      expect(fake.postCalls.first['path'], '/api/bookings/b-end-1/end-tour');

      expect(find.text('Tour ended successfully.'), findsOneWidget);
      expect(find.text('Tour Completed'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Start Tour'), findsNothing);
      expect(find.widgetWithText(FilledButton, 'End Tour'), findsNothing);
    });

    testWidgets('16. Lifecycle API error shows error message', (tester) async {
      final fake = FakeApiClient(
        postError: ApiException(400, 'Tour cannot be started at this time.'),
      );
      final tour = _sampleTour(bookingId: 'b-err-1');

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Start Tour'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Start Tour'));
      await tester.pumpAndSettle();

      expect(find.text('Tour cannot be started at this time.'), findsAtLeastNWidgets(1));
    });
  });
}
