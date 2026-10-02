import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../bookings/my_bookings_screen.dart';
import '../drivers/driver_profile_screen.dart';
import '../drivers/driver_tasks_screen.dart';
import '../guides/assigned_tours_screen.dart';
import '../guides/guide_profile_screen.dart';
import '../home/home_screen.dart';
import '../packages/packages_screen.dart';
import '../support/support_tickets_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final isTourGuide = user?.role == 'TourGuide';
    final isDriver = user?.role == 'Driver';

    final tabs = isTourGuide
        ? const <Widget>[
            HomeScreen(),
            AssignedToursScreen(),
            GuideProfileScreen(),
          ]
        : isDriver
            ? const <Widget>[
                HomeScreen(),
                DriverTasksScreen(),
                DriverProfileScreen(),
              ]
            : const <Widget>[
                HomeScreen(),
                PackagesScreen(),
                MyBookingsScreen(),
                SupportTicketsScreen(),
              ];

    final destinations = isTourGuide
        ? const <NavigationDestination>[
            NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard),
              label: 'Dashboard',
            ),
            NavigationDestination(
              icon: Icon(Icons.assignment_outlined),
              selectedIcon: Icon(Icons.assignment),
              label: 'Assigned Tours',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Profile',
            ),
          ]
        : isDriver
            ? const <NavigationDestination>[
                NavigationDestination(
                  icon: Icon(Icons.dashboard_outlined),
                  selectedIcon: Icon(Icons.dashboard),
                  label: 'Dashboard',
                ),
                NavigationDestination(
                  icon: Icon(Icons.directions_car_outlined),
                  selectedIcon: Icon(Icons.directions_car),
                  label: 'Driving Tasks',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  selectedIcon: Icon(Icons.person),
                  label: 'Profile',
                ),
              ]
            : const <NavigationDestination>[
                NavigationDestination(
                  icon: Icon(Icons.dashboard_outlined),
                  selectedIcon: Icon(Icons.dashboard),
                  label: 'Dashboard',
                ),
                NavigationDestination(
                  icon: Icon(Icons.card_travel_outlined),
                  selectedIcon: Icon(Icons.card_travel),
                  label: 'Packages',
                ),
                NavigationDestination(
                  icon: Icon(Icons.event_note_outlined),
                  selectedIcon: Icon(Icons.event_note),
                  label: 'My Bookings',
                ),
                NavigationDestination(
                  icon: Icon(Icons.support_agent_outlined),
                  selectedIcon: Icon(Icons.support_agent),
                  label: 'Support',
                ),
              ];

    final selectedIndex = _selectedIndex >= destinations.length ? 0 : _selectedIndex;

    return Scaffold(
      body: IndexedStack(index: selectedIndex, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        destinations: destinations,
      ),
    );
  }
}
