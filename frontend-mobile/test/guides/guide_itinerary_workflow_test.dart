import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/guides/guide_itinerary_edit_screen.dart';
import 'package:trailwise_mobile/guides/tour_detail_screen.dart';
import 'package:trailwise_mobile/models/assigned_tour.dart';
import 'package:trailwise_mobile/models/itinerary_step.dart';

import '../fakes/fake_api_client.dart';

AssignedTour _sampleTour({
  String bookingId = 'b-123',
  String tourPackageName = 'Highland Adventure',
  String theme = 'Nature',
  String startDate = '2026-11-01',
  String endDate = '2026-11-03',
  int groupSize = 4,
  String status = 'Confirmed',
  List<String> locations = const ['Ella', 'Kandy'],
  bool attended = false,
  bool completed = false,
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
      guideId: 'guide-1',
      guideName: 'Guide Test',
      attended: attended,
      completed: completed,
      tourStartedAt: tourStartedAt,
      tourEndedAt: tourEndedAt,
    );

void main() {
  group('Mobile Tour Guide Itinerary Workflow', () {
    testWidgets('1. Before completion + no itinerary: Set Itinerary visible', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final fake = FakeApiClient(getResponses: {
        '/api/bookings/b-123/itinerary': <Map<String, dynamic>>[],
      });
      final tour = _sampleTour(completed: false, tourEndedAt: null);

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Itinerary'), findsOneWidget);
      expect(find.text('No itinerary has been set for this trip yet.'), findsOneWidget);
      expect(find.text('Set Itinerary'), findsOneWidget);
      expect(find.text('Edit Itinerary'), findsNothing);
    });

    testWidgets('2. Before completion + itinerary exists: Edit Itinerary visible', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());
      final fake = FakeApiClient(getResponses: {
        '/api/bookings/b-123/itinerary': [
          {
            'id': 'step-1',
            'bookingId': 'b-123',
            'dayNumber': 1,
            'activity': 'Visit Sigiriya Rock',
            'location': 'Sigiriya',
            'startTime': '08:30:00',
          }
        ],
      });
      final tour = _sampleTour(completed: false, tourEndedAt: null);

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Itinerary'), findsOneWidget);
      expect(find.text('Edit Itinerary'), findsOneWidget);
      expect(find.text('Set Itinerary'), findsNothing);
      expect(find.text('Day 1'), findsOneWidget);
      expect(find.textContaining('Visit Sigiriya Rock'), findsOneWidget);
    });

    testWidgets('3. Mobile can add itinerary step', (tester) async {
      final fake = FakeApiClient();
      await tester.pumpWidget(MaterialApp(
        home: GuideItineraryEditScreen(
          bookingId: 'b-123',
          initialSteps: const [],
          apiClient: fake,
        ),
      ));
      await tester.pumpAndSettle();

      // Starts with 1 step
      expect(find.byKey(const ValueKey('stepCard_0')), findsOneWidget);
      expect(find.byKey(const ValueKey('stepCard_1')), findsNothing);

      // Tap add step
      await tester.tap(find.byKey(const ValueKey('addStepButton')));
      await tester.pumpAndSettle();

      // Now 2 steps exist
      expect(find.byKey(const ValueKey('stepCard_0')), findsOneWidget);
      expect(find.byKey(const ValueKey('stepCard_1')), findsOneWidget);
    });

    testWidgets('4. Mobile can edit itinerary step', (tester) async {
      final fake = FakeApiClient();
      final initialSteps = [
        ItineraryStep(
          id: 'step-1',
          bookingId: 'b-123',
          dayNumber: 1,
          activity: 'Old Activity',
          location: 'Old Location',
          startTime: '09:00:00',
        ),
      ];

      await tester.pumpWidget(MaterialApp(
        home: GuideItineraryEditScreen(
          bookingId: 'b-123',
          initialSteps: initialSteps,
          apiClient: fake,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Old Activity'), findsOneWidget);
      expect(find.text('Old Location'), findsOneWidget);

      await tester.enterText(find.byKey(const ValueKey('activity_0')), 'Updated Sunrise Trek');
      await tester.enterText(find.byKey(const ValueKey('location_0')), 'Ella Peak');
      await tester.pumpAndSettle();

      expect(find.text('Updated Sunrise Trek'), findsOneWidget);
      expect(find.text('Ella Peak'), findsOneWidget);
    });

    testWidgets('5. Mobile can delete itinerary step', (tester) async {
      final fake = FakeApiClient();
      final initialSteps = [
        ItineraryStep(
          id: 'step-1',
          bookingId: 'b-123',
          dayNumber: 1,
          activity: 'Step 1 To Delete',
          location: 'Loc 1',
          startTime: '08:00:00',
        ),
        ItineraryStep(
          id: 'step-2',
          bookingId: 'b-123',
          dayNumber: 2,
          activity: 'Step 2 To Keep',
          location: 'Loc 2',
          startTime: '10:00:00',
        ),
      ];

      await tester.pumpWidget(MaterialApp(
        home: GuideItineraryEditScreen(
          bookingId: 'b-123',
          initialSteps: initialSteps,
          apiClient: fake,
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Step 1 To Delete'), findsOneWidget);
      expect(find.text('Step 2 To Keep'), findsOneWidget);

      // Delete step 0
      await tester.tap(find.byKey(const ValueKey('deleteStep_0')));
      await tester.pumpAndSettle();

      expect(find.text('Step 1 To Delete'), findsNothing);
      expect(find.text('Step 2 To Keep'), findsOneWidget);
    });

    testWidgets('6. Save updates itinerary immediately', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final fake = FakeApiClient(
        getResponses: {
          '/api/bookings/b-123/itinerary': <Map<String, dynamic>>[],
        },
      );
      final tour = _sampleTour(completed: false, tourEndedAt: null);

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: tour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Set Itinerary'), findsOneWidget);

      // Tap Set Itinerary to open the editor
      await tester.tap(find.text('Set Itinerary'));
      await tester.pumpAndSettle();

      expect(find.text('Set Itinerary'), findsOneWidget); // AppBar title
      expect(find.byKey(const ValueKey('saveItineraryButton')), findsOneWidget);

      // Fill in details
      await tester.enterText(find.byKey(const ValueKey('activity_0')), 'Sigiriya Rock Fortress');
      await tester.enterText(find.byKey(const ValueKey('location_0')), 'Sigiriya');
      await tester.pumpAndSettle();

      // Save
      await tester.tap(find.byKey(const ValueKey('saveItineraryButton')));
      await tester.pumpAndSettle();

      // Should be back on TourDetailScreen
      expect(find.text('Tour Details'), findsOneWidget);
      expect(find.textContaining('Sigiriya Rock Fortress'), findsOneWidget);
      expect(find.text('Edit Itinerary'), findsOneWidget);
      expect(find.text('Set Itinerary'), findsNothing);
    });

    testWidgets('7. Completed tour: itinerary visible, Set Itinerary absent, Edit Itinerary absent, no mutation controls', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final fake = FakeApiClient(getResponses: {
        '/api/bookings/b-123/itinerary': [
          {
            'id': 'step-1',
            'bookingId': 'b-123',
            'dayNumber': 1,
            'activity': 'Temple of the Tooth',
            'location': 'Kandy',
            'startTime': '09:00:00',
          }
        ],
      });
      final completedTour = _sampleTour(
        completed: true,
        tourStartedAt: DateTime(2026, 11, 1, 9, 0),
        tourEndedAt: DateTime(2026, 11, 3, 17, 0),
      );

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: completedTour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Tour completed — itinerary is read-only.'), findsOneWidget);
      expect(find.textContaining('Temple of the Tooth'), findsOneWidget);
      expect(find.text('Set Itinerary'), findsNothing);
      expect(find.text('Edit Itinerary'), findsNothing);
      expect(find.byKey(const ValueKey('addStepButton')), findsNothing);
      expect(find.byKey(const ValueKey('saveItineraryButton')), findsNothing);
    });

    testWidgets('8. After End Tour: lifecycle becomes Completed, itinerary automatically switches to read-only', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      final fake = FakeApiClient(
        getResponses: {
          '/api/bookings/b-123/itinerary': [
            {
              'id': 'step-1',
              'bookingId': 'b-123',
              'dayNumber': 1,
              'activity': 'Whale Watching Safari',
              'location': 'Mirissa',
              'startTime': '06:30:00',
            }
          ],
        },
        postResponses: {
          '/api/bookings/b-123/end-tour': {
            'bookingId': 'b-123',
            'startDate': '2026-11-01',
            'endDate': '2026-11-03',
            'groupSize': 4,
            'status': 'Confirmed',
            'tourPackageId': 'pkg-1',
            'tourPackageName': 'Highland Adventure',
            'theme': 'Nature',
            'locations': ['Ella', 'Kandy'],
            'guideId': 'guide-1',
            'guideName': 'Guide Test',
            'attended': true,
            'completed': true,
            'tourStartedAt': '2026-11-01T09:00:00.000Z',
            'tourEndedAt': '2026-11-03T18:00:00.000Z',
          },
        },
      );

      final inProgressTour = _sampleTour(
        completed: false,
        tourStartedAt: DateTime(2026, 11, 1, 9, 0),
        tourEndedAt: null,
      );

      await tester.pumpWidget(MaterialApp(
        home: TourDetailScreen(tour: inProgressTour, apiClient: fake),
      ));
      await tester.pumpAndSettle();

      // Before end tour: Edit Itinerary is present
      expect(find.text('Edit Itinerary'), findsOneWidget);
      expect(find.textContaining('Whale Watching Safari'), findsOneWidget);
      expect(find.text('Tour completed — itinerary is read-only.'), findsNothing);
      expect(find.text('End Tour'), findsOneWidget);

      // Tap End Tour
      await tester.tap(find.text('End Tour'));
      await tester.pumpAndSettle();

      // After end tour: lifecycle is Completed, itinerary switches to read-only immediately
      expect(find.text('Tour Completed'), findsOneWidget);
      expect(find.text('Tour completed — itinerary is read-only.'), findsOneWidget);
      expect(find.text('Edit Itinerary'), findsNothing);
      expect(find.text('Set Itinerary'), findsNothing);
      expect(find.textContaining('Whale Watching Safari'), findsOneWidget);
    });
  });
}
