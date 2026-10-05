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
  const HomeScreen({super.key, this.onSelectTab});

  /// Switches the bottom-nav tab (provided by MainShell). Traveler quick
  /// actions are inert without it.
  final ValueChanged<int>? onSelectTab;

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            LogoMark(height: 26),
            SizedBox(width: AppSpacing.sm),
            Text('TrailWise'),
          ],
        ),
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
              children: [
                BrandBanner(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.xl,
                    AppSpacing.xl,
                    AppSpacing.xl,
                    AppSpacing.xxl,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Discover Sri Lanka, your way.',
                        style: text.labelMedium?.copyWith(color: Brand.accent400),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Welcome, ${user.name}',
                        style: text.displaySmall?.copyWith(color: Colors.white),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        user.email,
                        style: text.bodyMedium?.copyWith(color: Colors.white70),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(AppRadius.badge),
                        ),
                        child: Text(
                          user.role,
                          style: text.labelMedium?.copyWith(color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: AppSpacing.page,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SectionHeader(title: 'Quick actions'),
                      if (user.role == 'TourGuide')
                        QuickActionCard(
                          icon: Icons.assignment_outlined,
                          title: 'My Assigned Tours',
                          description: 'See the tours assigned to you.',
                          onTap: () => _push(context, const AssignedToursScreen()),
                        )
                      else if (user.role == 'Driver') ...[
                        QuickActionCard(
                          icon: Icons.directions_car_outlined,
                          title: 'My Driving Tasks',
                          description: 'Upcoming and past transport assignments.',
                          onTap: () => _push(context, const DriverTasksScreen()),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        QuickActionCard(
                          icon: Icons.person_outline,
                          title: 'Driver Profile & Settings',
                          description: 'Update your details and password.',
                          onTap: () => _push(context, const DriverProfileScreen()),
                        ),
                      ] else ...[
                        QuickActionCard(
                          icon: Icons.card_travel_outlined,
                          title: 'Browse Packages',
                          description: 'Explore tour packages and their pricing tiers.',
                          onTap: onSelectTab == null ? null : () => onSelectTab!(1),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        QuickActionCard(
                          icon: Icons.event_note_outlined,
                          title: 'Track your bookings',
                          description: 'Follow the status of your booking requests.',
                          onTap: onSelectTab == null ? null : () => onSelectTab!(2),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        QuickActionCard(
                          icon: Icons.support_agent_outlined,
                          title: 'Get help',
                          description: 'Create or follow a support ticket.',
                          onTap: onSelectTab == null ? null : () => onSelectTab!(3),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
