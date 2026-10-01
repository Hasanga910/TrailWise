import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../drivers/driver_profile_screen.dart';
import '../drivers/driver_tasks_screen.dart';
import '../guides/assigned_tours_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

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
            : Column(
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
                  if (user.role == 'TourGuide') ...[
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      icon: const Icon(Icons.assignment),
                      label: const Text('My Assigned Tours'),
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AssignedToursScreen(),
                        ),
                      ),
                    ),
                  ],
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
