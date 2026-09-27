import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../bookings/itinerary_management_screen.dart';
import '../bookings/my_bookings_screen.dart';
import '../guides/assigned_tours_screen.dart';
import '../guides/guide_availability_screen.dart';
import '../guides/guide_list_screen.dart';
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
    final role = user?.role;
    final isTourGuide = role == 'TourGuide';
    final isManagerOrAdmin = role == 'OperationsManager' || role == 'Admin';

    final List<Widget> tabs;
    final List<NavigationDestination> destinations;

    if (isTourGuide) {
      tabs = const <Widget>[
        HomeScreen(),
        AssignedToursScreen(),
        GuideAvailabilityScreen(),
      ];
      destinations = const <NavigationDestination>[
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.assignment_outlined),
          selectedIcon: Icon(Icons.assignment),
          label: 'Assigned Tours',
        ),
        NavigationDestination(
          icon: Icon(Icons.calendar_month_outlined),
          selectedIcon: Icon(Icons.calendar_month),
          label: 'Availability',
        ),
      ];
    } else if (isManagerOrAdmin) {
      tabs = const <Widget>[
        HomeScreen(),
        GuideListScreen(),
        GuideAvailabilityScreen(),
        ItineraryManagementScreen(),
      ];
      destinations = const <NavigationDestination>[
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: 'Home',
        ),
        NavigationDestination(
          icon: Icon(Icons.people_outline),
          selectedIcon: Icon(Icons.people),
          label: 'Guides',
        ),
        NavigationDestination(
          icon: Icon(Icons.calendar_month_outlined),
          selectedIcon: Icon(Icons.calendar_month),
          label: 'Availability',
        ),
        NavigationDestination(
          icon: Icon(Icons.map_outlined),
          selectedIcon: Icon(Icons.map),
          label: 'Itineraries',
        ),
      ];
    } else {
      // Traveler & default
      tabs = const <Widget>[
        HomeScreen(),
        PackagesScreen(),
        MyBookingsScreen(),
      ];
      destinations = const <NavigationDestination>[
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
      ];
    }

    final currentIndex = _selectedIndex < tabs.length ? _selectedIndex : 0;

    return Scaffold(
      body: IndexedStack(index: currentIndex, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        destinations: destinations,
      ),
    );
  }
}
