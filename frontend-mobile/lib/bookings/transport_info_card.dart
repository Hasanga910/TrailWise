import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/vehicle_assignment.dart';
import '../theme/app_theme.dart';

/// A reusable widget displaying vehicle and driver details or a pending state
/// notice for traveler itinerary and booking screens.
class TransportInfoCard extends StatelessWidget {
  const TransportInfoCard({
    super.key,
    required this.assignment,
    this.isLoading = false,
  });

  /// The vehicle assignment details, or null if transport allocation is still pending.
  final VehicleAssignment? assignment;

  /// Whether assignment information is actively loading.
  final bool isLoading;

  void _copyToClipboard(BuildContext context, String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Card(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: const Padding(
          padding: EdgeInsets.symmetric(vertical: 28, horizontal: 20),
          child: Center(
            child: SizedBox(
              height: 28,
              width: 28,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ),
        ),
      );
    }

    if (assignment == null) {
      return _buildPendingCard(context);
    }

    return _buildAssignedCard(context, assignment!);
  }

  Widget _buildPendingCard(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.border, width: 1),
      ),
      color: Colors.amber.shade50.withValues(alpha: 0.5),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: colors.warningSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.airport_shuttle_outlined,
                    color: colors.warningFg,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Transport Allocation Pending',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: colors.warningFg,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Our coordinator is assigning your fleet',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colors.warningFg,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              'Your dedicated vehicle and verified driver will appear here once allocated. Check back soon or refresh for live status updates.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colors.fg,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAssignedCard(BuildContext context, VehicleAssignment data) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    final typeName = data.vehicleType ?? _inferVehicleType(data.vehicleName);
    final hasAc = data.hasAC ?? true;
    final capacity = data.capacity ?? _inferCapacity(data.vehicleName);

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.brandSoft, width: 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section Header
            Row(
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
                          _getVehicleIcon(typeName),
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
                              'Assigned Transport',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: colors.fg,
                              ),
                            ),
                            Text(
                              'Vehicle & Driver Details',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: colors.fgMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: colors.brandSoft,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: colors.border, width: 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: colors.brandText,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Allocated',
                        style: TextStyle(
                          color: colors.brandText,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            const Divider(height: 1),
            const SizedBox(height: 16),

            // Vehicle Details
            Text(
              'VEHICLE SPECIFICATIONS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: colors.brandText,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        data.vehicleName,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: colors.fg,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'ID: ${data.vehicleId.length > 8 ? data.vehicleId.substring(0, 8).toUpperCase() : data.vehicleId}',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: colors.fgMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Badges row: Type badge, AC status, capacity
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildBadge(
                  icon: _getVehicleIcon(typeName),
                  label: typeName,
                  bgColor: colors.brandSoft,
                  textColor: colors.brandText,
                  borderColor: colors.border,
                ),
                _buildBadge(
                  icon: hasAc ? Icons.ac_unit : Icons.mode_fan_off_outlined,
                  label: hasAc ? 'Air Conditioned (AC)' : 'Non-AC',
                  bgColor: hasAc ? colors.infoSoft : colors.surfaceSunken,
                  textColor: hasAc ? colors.infoFg : colors.fgMuted,
                  borderColor: hasAc ? colors.border : colors.border,
                ),
                if (capacity != null && capacity > 0)
                  _buildBadge(
                    icon: Icons.airline_seat_recline_normal,
                    label: '$capacity Seats',
                    bgColor: colors.neutralSoft,
                    textColor: colors.neutralFg,
                    borderColor: colors.border,
                  ),
              ],
            ),
            const SizedBox(height: 20),
            const Divider(height: 1),
            const SizedBox(height: 16),

            // Driver Details
            Text(
              'ASSIGNED DRIVER',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: colors.brandText,
              ),
            ),
            const SizedBox(height: 10),
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
                    radius: 22,
                    backgroundColor: colors.brandSoft,
                    child: Text(
                      _initials(data.driverName),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: colors.brandText,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          data.driverName,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: colors.fg,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          data.driverContact.isNotEmpty
                              ? data.driverContact
                              : 'No direct phone provided',
                          style: TextStyle(fontSize: 13, color: colors.fgMuted),
                        ),
                      ],
                    ),
                  ),
                  if (data.driverContact.isNotEmpty)
                    IconButton.filledTonal(
                      icon: const Icon(Icons.phone, size: 20),
                      tooltip: 'Copy driver phone number',
                      onPressed: () => _copyToClipboard(
                        context,
                        data.driverContact,
                        'Driver phone number',
                      ),
                    ),
                ],
              ),
            ),
            if (data.guideName != null && data.guideName!.isNotEmpty) ...[
              const SizedBox(height: 18),
              const Divider(height: 1),
              const SizedBox(height: 16),
              Text(
                'ASSIGNED TOUR GUIDE',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: colors.brandText,
                ),
              ),
              const SizedBox(height: 10),
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
                      radius: 22,
                      backgroundColor: colors.infoSoft,
                      child: Text(
                        _initials(data.guideName!),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: colors.infoFg,
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            data.guideName!,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: colors.fg,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            (data.guideContact != null &&
                                    data.guideContact!.isNotEmpty)
                                ? data.guideContact!
                                : 'Licensed Tour Guide',
                            style: TextStyle(
                              fontSize: 13,
                              color: colors.fgMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (data.guideContact != null &&
                        data.guideContact!.isNotEmpty)
                      IconButton.filledTonal(
                        icon: const Icon(Icons.phone, size: 20),
                        tooltip: 'Copy guide contact',
                        onPressed: () => _copyToClipboard(
                          context,
                          data.guideContact!,
                          'Guide contact',
                        ),
                      ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'Service period: ${data.startDate} to ${data.endDate}',
                    style: TextStyle(fontSize: 12, color: colors.fgMuted),
                  ),
                ),
                TextButton.icon(
                  onPressed: () => _copyToClipboard(
                    context,
                    'Driver: ${data.driverName} (${data.driverContact}), Vehicle: ${data.vehicleName}',
                    'Transport details',
                  ),
                  icon: const Icon(Icons.copy, size: 14),
                  label: const Text(
                    'Share info',
                    style: TextStyle(fontSize: 12),
                  ),
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    foregroundColor: colors.brandText,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBadge({
    required IconData icon,
    required String label,
    required Color bgColor,
    required Color textColor,
    required Color borderColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: textColor),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: TextStyle(
                color: textColor,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  IconData _getVehicleIcon(String type) {
    final lower = type.toLowerCase();
    if (lower.contains('van')) return Icons.airport_shuttle;
    if (lower.contains('coach') || lower.contains('bus')) {
      return Icons.directions_bus;
    }
    if (lower.contains('suv')) return Icons.directions_car_filled;
    return Icons.directions_car;
  }

  String _inferVehicleType(String vehicleName) {
    final lower = vehicleName.toLowerCase();
    if (lower.contains('van')) return 'Van';
    if (lower.contains('coach') || lower.contains('bus')) return 'Coach';
    if (lower.contains('suv')) return 'SUV';
    return 'Vehicle';
  }

  int? _inferCapacity(String vehicleName) {
    final match = RegExp(r'\((\d+)\s*seats?\)').firstMatch(vehicleName);
    if (match != null) {
      return int.tryParse(match.group(1)!);
    }
    return null;
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts[0].isEmpty) return 'D';
    if (parts.length == 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }
}
