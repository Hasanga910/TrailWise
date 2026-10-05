import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth/auth_provider.dart';
import '../drivers/driver_profile_screen.dart';
import '../drivers/driver_tasks_screen.dart';
import '../guides/assigned_tours_screen.dart';
import '../theme/app_theme.dart';
import '../theme/theme_toggle_button.dart';
import '../widgets/widgets.dart';

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
          const ThemeToggleButton(),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
            tooltip: 'Log out',
          ),
        ],
      ),
      body: user == null
          ? const LoadingView()
          : ListView(
              padding: AppSpacing.page,
              children: [
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome, ${user.name}',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(user.email, style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: AppSpacing.md),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Chip(label: Text(user.role)),
                      ),
                    ],
                  ),
                ),
                if (user.role == 'TourGuide') ...[
                  const SizedBox(height: AppSpacing.lg),
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
                  const SizedBox(height: AppSpacing.lg),
                  FilledButton.icon(
                    icon: const Icon(Icons.directions_car),
                    label: const Text('My Driving Tasks'),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const DriverTasksScreen(),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
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
    );
  }
}
