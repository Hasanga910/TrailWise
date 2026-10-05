import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/driver_assignment.dart';
import '../theme/app_theme.dart';
import '../widgets/widgets.dart';

class DriverTasksScreen extends StatefulWidget {
  const DriverTasksScreen({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  State<DriverTasksScreen> createState() => _DriverTasksScreenState();
}

class _DriverTasksScreenState extends State<DriverTasksScreen>
    with SingleTickerProviderStateMixin {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  late TabController _tabController;
  List<DriverAssignment>? _assignments;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final assignments = await _apiClient.getDriverAssignments();
      if (mounted) {
        setState(() {
          _assignments = assignments;
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
          _error = 'Could not reach the server. Please try again.';
          _loading = false;
        });
      }
    }
  }

  bool _isPast(String endDateStr) {
    try {
      final end = DateTime.parse(endDateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      return end.isBefore(today);
    } catch (_) {
      return false;
    }
  }

  Future<void> _makePhoneCall(BuildContext context, String phoneNumber) async {
    final cleanNumber = phoneNumber.replaceAll(RegExp(r'\s+'), '');
    final uri = Uri.parse('tel:$cleanNumber');
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
      } else {
        await Clipboard.setData(ClipboardData(text: phoneNumber));
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Phone copied: $phoneNumber'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: phoneNumber));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Phone copied: $phoneNumber'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Driving Tasks'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Upcoming & Active'),
            Tab(text: 'Past Tours'),
          ],
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const LoadingView();
    }

    if (_error != null) {
      return ErrorState(message: _error!, onRetry: _load);
    }

    final all = _assignments ?? [];
    final upcoming = all.where((a) => !_isPast(a.endDate)).toList();
    final past = all.where((a) => _isPast(a.endDate)).toList();

    return TabBarView(
      controller: _tabController,
      children: [
        _buildList(upcoming, 'No active driving assignments'),
        _buildList(past, 'No completed driving assignments'),
      ],
    );
  }

  Widget _buildList(List<DriverAssignment> list, String emptyMessage) {
    if (list.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: EmptyState(
          icon: Icons.directions_car_outlined,
          title: emptyMessage,
          message: 'Driving assignments will appear here.',
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: AppSpacing.page,
        itemCount: list.length,
        itemBuilder: (context, index) {
          final item = list[index];
          return _DriverTaskCard(
            assignment: item,
            onCall: item.travelerContact != null && item.travelerContact!.isNotEmpty
                ? () => _makePhoneCall(context, item.travelerContact!)
                : null,
          );
        },
      ),
    );
  }
}

class _DriverTaskCard extends StatefulWidget {
  const _DriverTaskCard({
    required this.assignment,
    this.onCall,
  });

  final DriverAssignment assignment;
  final VoidCallback? onCall;

  @override
  State<_DriverTaskCard> createState() => _DriverTaskCardState();
}

class _DriverTaskCardState extends State<_DriverTaskCard> {
  bool _expanded = false;

  IconData _vehicleIcon(String? type) {
    switch (type?.toLowerCase()) {
      case 'coach':
        return Icons.directions_bus;
      case 'suv':
        return Icons.directions_car;
      default:
        return Icons.airport_shuttle;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    final assignment = widget.assignment;
    final vehicleType = assignment.vehicleType ?? 'Transport';
    final hasAc = assignment.hasAC ?? true;
    final regNo = assignment.registrationNumber ?? 'Unassigned Reg';

    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top row: Vehicle info & booking status
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: colors.brandSoft,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          _vehicleIcon(assignment.vehicleType),
                          color: colors.brandText,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              regNo,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Booking #${assignment.bookingId.length > 8 ? assignment.bookingId.substring(0, 8) : assignment.bookingId}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colors.fgMuted,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (assignment.bookingStatus != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: colors.infoSoft,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: colors.border),
                    ),
                    child: Text(
                      assignment.bookingStatus!,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: colors.info,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 14),

            // Vehicle Specs chips: Type, AC status, Capacity
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                Chip(
                  label: Text(vehicleType),
                  avatar: Icon(_vehicleIcon(assignment.vehicleType), size: 16),
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                Chip(
                  label: Text(hasAc ? '❄️ AC' : 'Non-AC'),
                  backgroundColor: hasAc ? colors.infoSoft : colors.surfaceSunken,
                  visualDensity: VisualDensity.compact,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                if (assignment.capacity != null)
                  Chip(
                    label: Text('${assignment.capacity} Seats'),
                    avatar: const Icon(Icons.people_outline, size: 16),
                    visualDensity: VisualDensity.compact,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
              ],
            ),
            const SizedBox(height: 14),

            // Tour Dates
            Row(
              children: [
                Icon(Icons.calendar_month, size: 18, color: colors.brandText),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '${assignment.startDate}  →  ${assignment.endDate}',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Lead Passenger Row
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: colors.surfaceSunken,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: colors.border),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: colors.brandSoft,
                    child: Text(
                      (assignment.travelerName?.isNotEmpty ?? false)
                          ? assignment.travelerName![0].toUpperCase()
                          : 'T',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: colors.brandText,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          assignment.travelerName ?? 'Lead Traveler',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          assignment.travelerContact ?? 'No phone provided',
                          style: TextStyle(
                            fontSize: 12,
                            color: colors.fgMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (widget.onCall != null)
                    FilledButton.tonalIcon(
                      icon: const Icon(Icons.call, size: 18),
                      label: const Text('Call'),
                      onPressed: widget.onCall,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            // Expandable Detailed Information (When "More Info" is clicked)
            if (_expanded) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: colors.surfaceSunken,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Tour Package Header
                    Row(
                      children: [
                        Icon(Icons.tour_outlined, size: 18, color: colors.brandText),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            assignment.packageName ?? 'Expedition Tour Package',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: colors.brandText,
                            ),
                          ),
                        ),
                        if (assignment.packageTier != null && assignment.packageTier!.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: colors.brandSoft,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              assignment.packageTier!,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: colors.brandText,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const Divider(height: 20),

                    // Vehicle Specs Details
                    _buildDetailRow(
                      icon: Icons.directions_car_filled_outlined,
                      label: 'Assigned Vehicle',
                      value: '$regNo (${assignment.vehicleType ?? 'Standard'} • ${hasAc ? 'AC' : 'Non-AC'})',
                    ),
                    const SizedBox(height: 8),

                    // Assigned Guide Details
                    _buildDetailRow(
                      icon: Icons.person_pin_outlined,
                      label: 'Assigned Guide',
                      value: assignment.guideName != null
                          ? '${assignment.guideName} (${assignment.guideContact ?? 'No Contact'})'
                          : 'Independent Driver Tour (No Guide Assigned)',
                    ),
                    const SizedBox(height: 8),

                    // Group Size & Language Preference
                    if (assignment.groupSize != null) ...[
                      _buildDetailRow(
                        icon: Icons.groups_outlined,
                        label: 'Party / Group Size',
                        value: '${assignment.groupSize} Passengers',
                      ),
                      const SizedBox(height: 8),
                    ],

                    if (assignment.languagePreference != null && assignment.languagePreference!.isNotEmpty) ...[
                      _buildDetailRow(
                        icon: Icons.translate_outlined,
                        label: 'Language',
                        value: assignment.languagePreference!,
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Special Requests / Notes
                    if (assignment.specialRequests != null && assignment.specialRequests!.isNotEmpty) ...[
                      _buildDetailRow(
                        icon: Icons.speaker_notes_outlined,
                        label: 'Special Requests',
                        value: assignment.specialRequests!,
                      ),
                      const SizedBox(height: 8),
                    ],

                    // Itinerary Highlights
                    if (assignment.itineraryHighlights != null && assignment.itineraryHighlights!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Itinerary Highlights:',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: colors.fg,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: assignment.itineraryHighlights!.map((highlight) {
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: colors.border),
                            ),
                            child: Text(
                              '• $highlight',
                              style: TextStyle(fontSize: 11, color: colors.fg),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],

            // Toggle Button: More Info / Less Info
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () {
                  setState(() {
                    _expanded = !_expanded;
                  });
                },
                icon: Icon(
                  _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                  size: 18,
                ),
                label: Text(_expanded ? 'Less Info' : 'More Info'),
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  foregroundColor: colors.brandText,
                  textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    final colors = AppColors.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: colors.fgMuted),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: colors.fgMuted,
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: colors.fg,
            ),
          ),
        ),
      ],
    );
  }
}
