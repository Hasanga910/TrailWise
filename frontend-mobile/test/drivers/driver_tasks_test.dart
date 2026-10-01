import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/drivers/driver_tasks_screen.dart';
import 'package:trailwise_mobile/home/home_screen.dart';
import 'package:trailwise_mobile/models/driver_assignment.dart';
import 'package:trailwise_mobile/navigation/main_shell.dart';

import '../fakes/fake_api_client.dart';

class _MockAuthProvider extends ChangeNotifier implements AuthProvider {
  _MockAuthProvider(this.user, this._apiClient);

  final ApiClient _apiClient;

  @override
  CurrentUser? user;

  @override
  AuthStatus status = AuthStatus.authenticated;

  @override
  ApiClient get apiClient => _apiClient;

  @override
  String? errorMessage;

  @override
  Future<bool> login(String email, String password) async => true;

  @override
  Future<bool> register(String name, String email, String password) async => true;

  @override
  Future<void> restoreSession() async {}

  @override
  void updateUser(CurrentUser updatedUser) {
    user = updatedUser;
    notifyListeners();
  }

  @override
  Future<void> logout() async {}
}

Map<String, dynamic> _sampleDriverAssignmentJson({
  String id = 'assign-1',
  String vehicleId = 'veh-1',
  String vehicleName = 'Toyota HiAce Luxury Van',
  String bookingId = 'booking-12345678',
  String driverId = 'drv-1',
  String driverName = 'Ruwan Jayasinghe',
  String driverContact = '+94771234567',
  String startDate = '2026-10-15',
  String endDate = '2026-10-20',
  String vehicleType = 'Van',
  int capacity = 7,
  bool hasAC = true,
  String registrationNumber = 'WP-CAB-5544',
  String bookingStatus = 'Confirmed',
  String travelerName = 'Alice Wonderland',
  String travelerContact = '+94719876543',
  String packageName = 'Cultural Triangle Expedition',
  String packageTier = 'Luxury',
  List<String> itineraryHighlights = const ['Sigiriya Rock Fortress', 'Dambulla Cave Temple'],
}) => {
      'id': id,
      'vehicleId': vehicleId,
      'vehicleName': vehicleName,
      'bookingId': bookingId,
      'driverId': driverId,
      'driverName': driverName,
      'driverContact': driverContact,
      'startDate': startDate,
      'endDate': endDate,
      'vehicleType': vehicleType,
      'capacity': capacity,
      'hasAC': hasAC,
      'registrationNumber': registrationNumber,
      'bookingStatus': bookingStatus,
      'travelerName': travelerName,
      'travelerContact': travelerContact,
      'packageName': packageName,
      'packageTier': packageTier,
      'itineraryHighlights': itineraryHighlights,
    };

void main() {
  group('DriverAssignment Model', () {
    test('fromJson parses full payload with vehicle specs and traveler contacts', () {
      final json = _sampleDriverAssignmentJson();
      final assignment = DriverAssignment.fromJson(json);

      expect(assignment.id, 'assign-1');
      expect(assignment.vehicleName, 'Toyota HiAce Luxury Van');
      expect(assignment.registrationNumber, 'WP-CAB-5544');
      expect(assignment.vehicleType, 'Van');
      expect(assignment.hasAC, isTrue);
      expect(assignment.capacity, 7);
      expect(assignment.travelerName, 'Alice Wonderland');
      expect(assignment.travelerContact, '+94719876543');
      expect(assignment.bookingStatus, 'Confirmed');
      expect(assignment.packageName, 'Cultural Triangle Expedition');
      expect(assignment.packageTier, 'Luxury');
      expect(assignment.itineraryHighlights, ['Sigiriya Rock Fortress', 'Dambulla Cave Temple']);
    });
  });

  group('DriverTasksScreen Widget Tests', () {
    testWidgets('Renders empty state when driver has no assigned tours', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/drivers/me/assignments': <dynamic>[],
      });

      await tester.pumpWidget(MaterialApp(
        home: DriverTasksScreen(apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('My Driving Tasks'), findsOneWidget);
      expect(find.text('No active driving assignments'), findsOneWidget);
    });

    testWidgets('Renders vehicle registration, AC status, capacity, and traveler details', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/drivers/me/assignments': [
          _sampleDriverAssignmentJson(),
        ],
      });

      await tester.pumpWidget(MaterialApp(
        home: DriverTasksScreen(apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('WP-CAB-5544'), findsOneWidget);
      expect(find.text('Van'), findsOneWidget);
      expect(find.text('❄️ AC'), findsOneWidget);
      expect(find.text('7 Seats'), findsOneWidget);
      expect(find.text('Alice Wonderland'), findsOneWidget);
      expect(find.text('+94719876543'), findsOneWidget);
      expect(find.text('Call'), findsOneWidget);

      // Verify More Info button
      expect(find.text('More Info'), findsOneWidget);
      await tester.tap(find.text('More Info'));
      await tester.pumpAndSettle();

      // Expanded details
      expect(find.text('Less Info'), findsOneWidget);
      expect(find.text('Cultural Triangle Expedition'), findsOneWidget);
      expect(find.text('Luxury'), findsOneWidget);
      expect(find.text('• Sigiriya Rock Fortress'), findsOneWidget);
      expect(find.text('Assigned Guide: '), findsOneWidget);
    });

    testWidgets('Renders error state with retry button on API failure', (tester) async {
      final fake = FakeApiClient(
        getError: ApiException(500, 'Failed to fetch assignments'),
      );

      await tester.pumpWidget(MaterialApp(
        home: DriverTasksScreen(apiClient: fake),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Failed to fetch assignments'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
    });
  });

  group('Driver Navigation & Shell Integration', () {
    testWidgets('MainShell routes Driver role to Dashboard and Driving Tasks navigation destinations', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/drivers/me/assignments': <dynamic>[],
      });
      final driverUser = CurrentUser(
        id: 'driver-usr-1',
        name: 'Sunil Driver',
        email: 'sunil@trailwise.local',
        role: 'Driver',
      );
      final mockAuth = _MockAuthProvider(driverUser, fake);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: mockAuth,
          child: const MaterialApp(home: MainShell()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('Driving Tasks'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);
      expect(find.text('Packages'), findsNothing);
      expect(find.text('My Bookings'), findsNothing);
    });

    testWidgets('HomeScreen displays My Driving Tasks and Driver Profile & Settings action buttons for Driver role', (tester) async {
      final fake = FakeApiClient(getResponses: {
        '/api/drivers/me/assignments': <dynamic>[],
      });
      final driverUser = CurrentUser(
        id: 'driver-usr-1',
        name: 'Sunil Driver',
        email: 'sunil@trailwise.local',
        role: 'Driver',
      );
      final mockAuth = _MockAuthProvider(driverUser, fake);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: mockAuth,
          child: const MaterialApp(home: HomeScreen()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Welcome, Sunil Driver'), findsOneWidget);
      expect(find.text('My Driving Tasks'), findsOneWidget);
      expect(find.text('Driver Profile & Settings'), findsOneWidget);
    });
  });
}
