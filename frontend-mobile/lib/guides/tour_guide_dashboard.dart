import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../bookings/booking_status.dart';
import '../models/assigned_tour.dart';
import 'assigned_tours_screen.dart';
import 'guide_availability_screen.dart';
import 'guide_profile_screen.dart';
import 'tour_detail_screen.dart';

class TourGuideDashboard extends StatefulWidget {
  const TourGuideDashboard({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  State<TourGuideDashboard> createState() => _TourGuideDashboardState();
}

class _TourGuideDashboardState extends State<TourGuideDashboard> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  List<AssignedTour>? _tours;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final tours = await _apiClient.getAssignedTours();
      if (mounted) {
        setState(() {
          _tours = tours;
          _loading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not load assigned tours. Please try again.';
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;
    final guideName = user?.name ?? 'Guide';

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.terrain_rounded, color: Colors.teal.shade700),
            const SizedBox(width: 8),
            const Text(
              'TrailWise',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
            tooltip: 'Log out',
          ),
        ],
      ),
      body: _buildBody(guideName),
    );
  }

  Widget _buildBody(String guideName) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
              const SizedBox(height: 16),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Colors.red),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _load,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final tours = _tours ?? [];
    final upcomingTours = tours.where((t) => t.tourEndedAt == null).toList();
    final activeTour = tours.cast<AssignedTour?>().firstWhere(
          (t) => t?.tourStartedAt != null && t?.tourEndedAt == null,
          orElse: () => null,
        );
    final nextTour = upcomingTours.isNotEmpty ? upcomingTours.first : null;

    final upcomingCount = upcomingTours.length;
    final upcomingText =
        '$upcomingCount upcoming assigned tour${upcomingCount == 1 ? '' : 's'}';

    return RefreshIndicator(
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 2. Welcome Section
            Text(
              'Welcome back, $guideName',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              upcomingText,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade600,
              ),
            ),
            const SizedBox(height: 16),

            // 3. Quick Summary Cards
            Row(
              children: [
                Expanded(
                  child: _SummaryCard(
                    title: 'Upcoming Tours',
                    value: '$upcomingCount',
                    icon: Icons.tour_outlined,
                    color: Colors.teal,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _SummaryCard(
                    title: 'Availability',
                    value: 'Manage',
                    icon: Icons.calendar_month_outlined,
                    color: Colors.blueGrey,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => GuideAvailabilityScreen(apiClient: _apiClient),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _SummaryCard(
                    title: 'Active Tour',
                    value: activeTour != null
                        ? activeTour.tourPackageName
                        : 'None',
                    icon: Icons.play_circle_outline,
                    color: activeTour != null ? Colors.deepOrange : Colors.grey,
                    onTap: activeTour != null
                        ? () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => TourDetailScreen(
                                  tour: activeTour,
                                  apiClient: _apiClient,
                                ),
                              ),
                            )
                        : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // 5. Upcoming Tour Preview Section
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Next Tour',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                if (nextTour != null)
                  TextButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => AssignedToursScreen(apiClient: _apiClient),
                      ),
                    ),
                    child: const Text('View All'),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (nextTour != null)
              _NextTourCard(
                tour: nextTour,
                onTap: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => TourDetailScreen(
                        tour: nextTour,
                        apiClient: _apiClient,
                      ),
                    ),
                  );
                  if (mounted) _load();
                },
              )
            else
              _EmptyTourCard(),
            const SizedBox(height: 24),

            // 4. Quick Actions Section
            const Text(
              'Quick Actions',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 12),
            _ActionCard(
              key: const Key('action_assigned_tours'),
              icon: Icons.assignment_outlined,
              title: 'My Assigned Tours',
              description: 'View upcoming and active tours',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => AssignedToursScreen(apiClient: _apiClient),
                ),
              ),
            ),
            const SizedBox(height: 10),
            _ActionCard(
              key: const Key('action_guide_availability'),
              icon: Icons.calendar_month_outlined,
              title: 'Guide Availability',
              description: 'Manage the days you are available',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => GuideAvailabilityScreen(apiClient: _apiClient),
                ),
              ),
            ),
            const SizedBox(height: 10),
            _ActionCard(
              key: const Key('action_profile'),
              icon: Icons.person_outline,
              title: 'Profile',
              description: 'Update guide details and preferences',
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => GuideProfileScreen(apiClient: _apiClient),
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
    this.onTap,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final cardContent = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: 8),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: cardContent,
      );
    }
    return cardContent;
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      color: Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.teal.shade50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: Colors.teal.shade700, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey.shade400, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

class _NextTourCard extends StatelessWidget {
  const _NextTourCard({
    required this.tour,
    required this.onTap,
  });

  final AssignedTour tour;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final statusColor = BookingStatus.color(tour.status);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.teal.shade200),
      ),
      color: Colors.teal.shade50.withValues(alpha: 0.35),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      tour.tourPackageName,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      tour.status,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Icon(Icons.calendar_today_outlined,
                      size: 14, color: Colors.grey.shade600),
                  const SizedBox(width: 6),
                  Text(
                    '${tour.startDate} — ${tour.endDate}',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade700,
                    ),
                  ),
                  const Spacer(),
                  Icon(Icons.group_outlined,
                      size: 14, color: Colors.grey.shade600),
                  const SizedBox(width: 4),
                  Text(
                    '${tour.groupSize} guests',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyTourCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Icon(Icons.event_available_outlined,
              size: 36, color: Colors.grey.shade400),
          const SizedBox(height: 8),
          const Text(
            'No upcoming tours',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'You currently have no upcoming assigned tours.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }
}
