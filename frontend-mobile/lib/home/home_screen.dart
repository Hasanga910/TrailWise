import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../drivers/driver_profile_screen.dart';
import '../drivers/driver_tasks_screen.dart';
import '../guides/tour_guide_dashboard.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    if (user == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (user.role == 'TourGuide') {
      return TourGuideDashboard(apiClient: apiClient);
    }

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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Welcome, ${user.name}',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(user.email),
            const SizedBox(height: 4),
            Chip(label: Text(user.role)),
            if (user.role == 'Driver') ...[
              const SizedBox(height: 20),
              FilledButton.icon(
                icon: const Icon(Icons.directions_car),
                label: const Text('My Driving Tasks'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const DriverTasksScreen(),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                icon: const Icon(Icons.person_outline),
                label: const Text('Driver Profile & Settings'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const DriverProfileScreen(),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
