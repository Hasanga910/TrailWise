import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/drivers/driver_profile_screen.dart';
import 'package:trailwise_mobile/drivers/driver_tasks_screen.dart';
import 'package:trailwise_mobile/support/create_support_ticket_screen.dart';
import 'package:trailwise_mobile/support/support_ticket_detail_screen.dart';
import 'package:trailwise_mobile/support/support_tickets_screen.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';
import 'package:trailwise_mobile/theme/theme_provider.dart';

import '../fakes/fake_api_client.dart';

Map<String, dynamic> _assignment(
  String id, {
  String start = '2030-10-15',
  String end = '2030-10-20',
}) => {
  'id': id,
  'vehicleId': 'veh-1',
  'vehicleName': 'Toyota HiAce Luxury High Roof Van (7 seats, air conditioned)',
  'bookingId': 'booking-12345678',
  'driverId': 'drv-1',
  'driverName': 'Ruwan Jayasinghe Bandaranayake',
  'driverContact': '+94771234567',
  'startDate': start,
  'endDate': end,
  'vehicleType': 'Van',
  'capacity': 7,
  'hasAC': true,
  'registrationNumber': 'WP-CAB-5544',
  'bookingStatus': 'Confirmed',
  'travelerName': 'Alice Wonderland-Featherstonehaugh',
  'travelerContact': '+94719876543',
  'packageName': 'Cultural Triangle Expedition With Extra Long Name',
  'packageTier': 'Luxury Deluxe',
  'itineraryHighlights': [
    'Sigiriya Rock Fortress',
    'Dambulla Cave Temple',
    'Minneriya National Park',
  ],
};

Map<String, dynamic> _ticket() => {
  'id': 'ticket-1',
  'category': 'Payment Confirmation',
  'priority': 'High',
  'status': 'WaitingForCustomer',
  'subject':
      'Payment confirmation missing for the extraordinarily long package name',
  'bookingId': 'book-1',
  'packageName': 'Cultural Triangle Expedition With Extra Long Name',
  'assignedToId': null,
  'createdAt': '2030-09-29T10:00:00Z',
  'updatedAt': '2030-09-29T10:05:00Z',
};

Map<String, dynamic> _ticketDetail({String status = 'InProgress'}) => {
  ..._ticket(),
  'status': status,
  'description': 'I uploaded the bank slip yesterday but have received no confirmation of any kind.',
  'travelerId': 't',
  'travelerDisplayName': 'John Traveler',
  'assignedToName': 'Support Agent Alex',
  'resolvedAt': null,
  'closedAt': null,
  'messages': [
    {
      'id': 'm1',
      'senderId': 't',
      'senderDisplayName': 'John Traveler',
      'isStaff': false,
      'message': 'Here is another message from the traveler with a long body that needs to wrap.',
      'createdAt': '2030-09-29T10:05:00Z',
    },
    {
      'id': 'm2',
      'senderId': 's',
      'senderDisplayName': 'Support Agent Alex',
      'isStaff': true,
      'message':
          'We have sent a fresh confirmation to your email address on file.',
      'createdAt': '2030-09-29T10:10:00Z',
    },
  ],
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

    testWidgets('DriverTasksScreen fits 360 dp, plus empty/error ($tag)', (
      tester,
    ) async {
      _phone(tester);
      final api = FakeApiClient(
        getResponses: {
          '/api/drivers/me/assignments': [_assignment('a1')],
        },
      );
      await tester.pumpWidget(_app(DriverTasksScreen(apiClient: api), dark));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('More Info'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        _app(
          DriverTasksScreen(
            apiClient: FakeApiClient(
              getResponses: {'/api/drivers/me/assignments': []},
            ),
          ),
          dark,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('No active driving assignments'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        _app(
          DriverTasksScreen(
            apiClient: FakeApiClient(getError: ApiException(500, 'Tasks down')),
          ),
          dark,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Tasks down'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets(
      'DriverProfileScreen renders, fits 360 dp and has a theme toggle ($tag)',
      (tester) async {
        _phone(tester);
        await tester.pumpWidget(
          _app(DriverProfileScreen(apiClient: FakeApiClient()), dark),
        );
        await tester.pumpAndSettle();
        expect(find.text('Driver Profile & Settings'), findsOneWidget);
        expect(find.byKey(const Key('theme_toggle')), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.drag(
          find.byType(Scrollable).first,
          const Offset(0, -4000),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('Support list fits 360 dp, plus empty/error ($tag)', (
      tester,
    ) async {
      _phone(tester);
      final page = {
        'items': [_ticket()],
        'totalCount': 1,
        'page': 1,
        'pageSize': 10,
      };
      await tester.pumpWidget(
        _app(
          SupportTicketsScreen(
            apiClient: FakeApiClient(
              getResponses: {'/api/support/tickets/mine': page},
            ),
          ),
          dark,
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        _app(
          SupportTicketsScreen(
            apiClient: FakeApiClient(
              getResponses: {
                '/api/support/tickets/mine': {
                  'items': [],
                  'totalCount': 0,
                  'page': 1,
                  'pageSize': 10,
                },
              },
            ),
          ),
          dark,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('No support tickets yet'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        _app(
          SupportTicketsScreen(
            apiClient: FakeApiClient(
              getError: ApiException(500, 'Tickets down'),
            ),
          ),
          dark,
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Tickets down'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('Support detail and create fit 360 dp ($tag)', (tester) async {
      _phone(tester);
      for (final status in ['InProgress', 'Closed']) {
        await tester.pumpWidget(
          _app(
            SupportTicketDetailScreen(
              ticketId: 'ticket-1',
              apiClient: FakeApiClient(
                getResponses: {
                  '/api/support/tickets/ticket-1': _ticketDetail(
                    status: status,
                  ),
                },
              ),
            ),
            dark,
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      }

      await tester.pumpWidget(
        _app(
          CreateSupportTicketScreen(
            apiClient: FakeApiClient(
              getResponses: {
                '/api/bookings/mine': {
                  'items': [],
                  'totalCount': 0,
                  'page': 1,
                  'pageSize': 50,
                },
              },
            ),
          ),
          dark,
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  }
}
