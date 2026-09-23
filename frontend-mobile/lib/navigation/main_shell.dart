import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../bookings/my_bookings_screen.dart';
import '../guides/assigned_tours_screen.dart';
import '../home/home_screen.dart';
import '../packages/packages_screen.dart';

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

    final tabs = <Widget>[
      const HomeScreen(),
      const PackagesScreen(),
      if (isTourGuide) const AssignedToursScreen() else const MyBookingsScreen(),
    ];

    final destinations = <NavigationDestination>[
      const NavigationDestination(
        icon: Icon(Icons.dashboard_outlined),
        selectedIcon: Icon(Icons.dashboard),
        label: 'Dashboard',
      ),
      const NavigationDestination(
        icon: Icon(Icons.card_travel_outlined),
        selectedIcon: Icon(Icons.card_travel),
        label: 'Packages',
      ),
      NavigationDestination(
        icon: Icon(isTourGuide ? Icons.assignment_outlined : Icons.event_note_outlined),
        selectedIcon: Icon(isTourGuide ? Icons.assignment : Icons.event_note),
        label: isTourGuide ? 'Assigned Tours' : 'My Bookings',
      ),
    ];

    return Scaffold(
      body: IndexedStack(index: _selectedIndex, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        destinations: destinations,
      ),
    );
  }
}
