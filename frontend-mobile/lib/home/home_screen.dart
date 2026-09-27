import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../bookings/itinerary_management_screen.dart';
import '../guides/assigned_tours_screen.dart';
import '../guides/guide_availability_screen.dart';
import '../guides/guide_list_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final role = user?.role;
    final isTourGuide = role == 'TourGuide';
    final isManagerOrAdmin = role == 'OperationsManager' || role == 'Admin';

    return Scaffold(
      appBar: AppBar(
        title: const Text('TrailWise'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
            tooltip: 'Log out',
          ),
        ],
      ),
      body: Center(
        child: user == null
            ? const CircularProgressIndicator()
            : SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Welcome, ${user.name}',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(user.email, style: const TextStyle(color: Colors.black54)),
                    const SizedBox(height: 4),
                    Chip(label: Text(user.role)),

                    if (isTourGuide) ...[
                      const SizedBox(height: 24),
                      SizedBox(
                        width: 240,
                        child: FilledButton.icon(
                          icon: const Icon(Icons.assignment),
                          label: const Text('My Assigned Tours'),
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const AssignedToursScreen(),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: 240,
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.calendar_month),
                          label: const Text('My Availability'),
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const GuideAvailabilityScreen(),
                            ),
                          ),
                        ),
                      ),
                    ],

                    if (isManagerOrAdmin) ...[
                      const SizedBox(height: 24),
                      SizedBox(
                        width: 240,
                        child: FilledButton.icon(
                          icon: const Icon(Icons.people),
                          label: const Text('Manage Guides'),
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const GuideListScreen(),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: 240,
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.calendar_month),
                          label: const Text('Guide Availability'),
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const GuideAvailabilityScreen(),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: 240,
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.map),
                          label: const Text('Manage Itineraries'),
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const ItineraryManagementScreen(),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
      ),
    );
  }
}
