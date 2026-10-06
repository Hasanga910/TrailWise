import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/guides/assigned_tours_screen.dart';
import 'package:trailwise_mobile/guides/guide_itinerary_edit_screen.dart';
import 'package:trailwise_mobile/guides/guide_profile_screen.dart';
import 'package:trailwise_mobile/guides/tour_detail_screen.dart';
import 'package:trailwise_mobile/models/assigned_tour.dart';
import 'package:trailwise_mobile/models/itinerary_step.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';
import 'package:trailwise_mobile/theme/theme_provider.dart';

import '../fakes/fake_api_client.dart';

AssignedTour _tour({String status = 'NeedsManualReview', bool started = false, bool ended = false}) =>
    AssignedTour(
      bookingId: 'b-1',
      startDate: '2030-11-01',
      endDate: '2030-11-03',
      groupSize: 25,
      status: status,
      tourPackageId: 'pkg-1',
      tourPackageName: 'The Extraordinarily Long Sigiriya & Dambulla Cultural Explorer Experience',
      theme: 'Cultural Heritage and Adventure',
      locations: const ['Sigiriya Rock Fortress', 'Dambulla Cave Temple', 'Minneriya National Park'],
      specialRequests: 'Need an English audio guide and wheelchair accessible transport for two travelers',
      guideId: 'g',
      guideName: 'Guide',
      attended: true,
      completed: ended,
      guideNotes: 'Travelers were on time and enjoyed the trails a lot, a very long note to wrap.',
      tourStartedAt: started ? DateTime(2030, 11, 1, 8) : null,
      tourEndedAt: ended ? DateTime(2030, 11, 3, 18) : null,
    );

Map<String, dynamic> _tourJson(AssignedTour t) => {
      'bookingId': t.bookingId,
      'startDate': t.startDate,
      'endDate': t.endDate,
      'groupSize': t.groupSize,
      'status': t.status,
      'tourPackageId': t.tourPackageId,
      'tourPackageName': t.tourPackageName,
      'theme': t.theme,
      'locations': t.locations,
      'specialRequests': t.specialRequests,
      'guideId': t.guideId,
      'guideName': t.guideName,
      'attended': t.attended,
      'completed': t.completed,
      'guideNotes': t.guideNotes,
    };

void _phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(360, 640);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = 1.3;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
}

Widget _app(Widget home, bool dark) => MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: MaterialApp(theme: dark ? AppTheme.dark : AppTheme.light, home: home),
    );

void main() {
  for (final dark in [false, true]) {
    final tag = dark ? 'dark' : 'light';

    testWidgets('AssignedToursScreen fits 360 dp, plus empty/error ($tag)', (tester) async {
      _phone(tester);
      final api = FakeApiClient(getResponses: {
        '/api/guides/me/assigned-tours': [
          _tourJson(_tour()),
          _tourJson(_tour(status: 'Completed', ended: true)),
        ],
      });
      await tester.pumpWidget(_app(AssignedToursScreen(apiClient: api), dark));
      await tester.pumpAndSettle();
      expect(find.text('Needs Manual Review'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_app(
          AssignedToursScreen(
              apiClient: FakeApiClient(getResponses: {'/api/guides/me/assigned-tours': []})),
          dark));
      await tester.pumpAndSettle();
      expect(find.text('No tours assigned yet'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_app(
          AssignedToursScreen(apiClient: FakeApiClient(getError: ApiException(500, 'Tours down'))),
          dark));
      await tester.pumpAndSettle();
      expect(find.text('Tours down'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('TourDetailScreen fits 360 dp, started and ended ($tag)', (tester) async {
      _phone(tester);
      for (final t in [_tour(started: true), _tour(status: 'Completed', started: true, ended: true)]) {
        final api = FakeApiClient(getResponses: {'/api/bookings/b-1/itinerary': []});
        await tester.pumpWidget(_app(TourDetailScreen(tour: t, apiClient: api), dark));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        final scrollable = find.byType(Scrollable).first;
        await tester.drag(scrollable, const Offset(0, -3000));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      }
    });

    testWidgets('GuideItineraryEditScreen fits 360 dp ($tag)', (tester) async {
      _phone(tester);
      await tester.pumpWidget(_app(
          GuideItineraryEditScreen(
            bookingId: 'b-1',
            initialSteps: [
              ItineraryStep(
                id: 's1',
                bookingId: 'b-1',
                dayNumber: 1,
                activity: 'Climb Sigiriya Rock Fortress at sunrise with the guide',
                location: 'Sigiriya Rock Fortress, Central Province',
                startTime: '06:30:00',
              ),
            ],
            apiClient: FakeApiClient(),
          ),
          dark));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('GuideProfileScreen fits 360 dp and has a theme toggle ($tag)', (tester) async {
      _phone(tester);
      final api = FakeApiClient(getResponses: {
        '/api/guides/me': {
          'id': 'g',
          'userId': 'u',
          'name': 'Kasun Perera With A Very Long Name Indeed',
          'email': 'kasun.perera.with.a.long.address@trailwise.local',
          'contactInfo': '+94771234567',
          'languages': ['English', 'Sinhala', 'German', 'French'],
          'specializations': ['Wildlife', 'Hiking', 'Cultural Heritage'],
        },
      });
      await tester.pumpWidget(_app(GuideProfileScreen(apiClient: api), dark));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('theme_toggle')), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.drag(find.byType(Scrollable).first, const Offset(0, -4000));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(_app(
          GuideProfileScreen(apiClient: FakeApiClient(getError: ApiException(500, 'Profile down'))),
          dark));
      await tester.pumpAndSettle();
      expect(find.text('Profile down'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  }
}
