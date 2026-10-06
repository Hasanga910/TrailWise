import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/bookings/guide_info_card.dart';
import 'package:trailwise_mobile/bookings/transport_info_card.dart';
import 'package:trailwise_mobile/models/booking.dart';
import 'package:trailwise_mobile/models/vehicle_assignment.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';

Widget _app(Widget child, bool dark) => MaterialApp(
      theme: dark ? AppTheme.dark : AppTheme.light,
      home: Scaffold(body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: child)),
    );

void main() {
  for (final dark in [false, true]) {
    final tag = dark ? 'dark' : 'light';

    testWidgets('Guide and transport cards fit 360 dp with long data ($tag)', (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      final guide = AssignedGuide(
        id: 'g',
        name: 'Janindu Wickramasinghe-Perera Fernando',
        contactInfo: '+94 77 564 5000',
        languages: const ['Sinhala', 'English', 'German', 'French', 'Japanese'],
        specializations: const ['Cultural Heritage', 'Wildlife Safari', 'Hill Country Trekking'],
      );
      final assignment = VehicleAssignment.fromJson({
        'id': 'a',
        'vehicleId': 'veh-99999999-1111',
        'vehicleName': 'Toyota KDH Commuter High Roof (8 seats, air conditioned)',
        'bookingId': 'b',
        'driverId': 'd',
        'driverName': 'Sunil Perera Bandaranayake',
        'driverContact': '+94771234567',
        'startDate': '2030-11-01',
        'endDate': '2030-11-05',
        'createdAt': '2030-10-20T10:00:00Z',
        'updatedAt': '2030-10-20T10:00:00Z',
        'vehicleType': 'Van',
        'capacity': 8,
        'hasAC': true,
      });

      await tester.pumpWidget(_app(
        Column(children: [
          GuideInfoCard(guide: guide),
          const GuideInfoCard(guide: null),
          const GuideInfoCard(guide: null, isLoading: true),
          TransportInfoCard(assignment: assignment),
          const TransportInfoCard(assignment: null),
        ]),
        dark,
      ));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  }
}
