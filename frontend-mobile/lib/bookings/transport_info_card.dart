import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/vehicle_assignment.dart';

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
    final theme = Theme.of(context);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.amber.shade200, width: 1),
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
                    color: Colors.amber.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.airport_shuttle_outlined,
                    color: Colors.amber.shade900,
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
                          color: Colors.amber.shade900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Our coordinator is assigning your fleet',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: Colors.amber.shade800,
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
                color: Colors.black87,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAssignedCard(BuildContext context, VehicleAssignment data) {
    final theme = Theme.of(context);
    final typeName = data.vehicleType ?? _inferVehicleType(data.vehicleName);
    final hasAc = data.hasAC ?? true;
    final capacity = data.capacity ?? _inferCapacity(data.vehicleName);

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.teal.shade100, width: 1),
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
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.teal.shade50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        _getVehicleIcon(typeName),
                        color: Colors.teal.shade700,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Assigned Transport',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        Text(
                          'Vehicle & Driver Details',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.teal.shade50,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.teal.shade300, width: 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: Colors.teal.shade600,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Allocated',
                        style: TextStyle(
                          color: Colors.teal.shade800,
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
                color: Colors.teal.shade800,
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
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'ID: ${data.vehicleId.length > 8 ? data.vehicleId.substring(0, 8).toUpperCase() : data.vehicleId}',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: Colors.grey.shade600,
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
                  bgColor: Colors.teal.shade50,
                  textColor: Colors.teal.shade900,
                  borderColor: Colors.teal.shade200,
                ),
                _buildBadge(
                  icon: hasAc ? Icons.ac_unit : Icons.mode_fan_off_outlined,
                  label: hasAc ? 'Air Conditioned (AC)' : 'Non-AC',
                  bgColor: hasAc ? Colors.blue.shade50 : Colors.grey.shade100,
                  textColor: hasAc ? Colors.blue.shade900 : Colors.grey.shade700,
                  borderColor: hasAc ? Colors.blue.shade200 : Colors.grey.shade300,
                ),
                if (capacity != null && capacity > 0)
                  _buildBadge(
                    icon: Icons.airline_seat_recline_normal,
                    label: '$capacity Seats',
                    bgColor: Colors.purple.shade50,
                    textColor: Colors.purple.shade900,
                    borderColor: Colors.purple.shade200,
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
                color: Colors.teal.shade800,
              ),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: Colors.teal.shade100,
                    child: Text(
                      _initials(data.driverName),
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.teal.shade800,
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
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          data.driverContact.isNotEmpty
                              ? data.driverContact
                              : 'No direct phone provided',
                          style: TextStyle(
                            fontSize: 13,
                            color: Colors.grey.shade700,
                          ),
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
                  color: Colors.teal.shade800,
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: Colors.blue.shade100,
                      child: Text(
                        _initials(data.guideName!),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.blue.shade900,
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
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            (data.guideContact != null && data.guideContact!.isNotEmpty)
                                ? data.guideContact!
                                : 'Licensed Tour Guide',
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey.shade700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (data.guideContact != null && data.guideContact!.isNotEmpty)
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
                Text(
                  'Service period: ${data.startDate} to ${data.endDate}',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
                TextButton.icon(
                  onPressed: () => _copyToClipboard(
                    context,
                    'Driver: ${data.driverName} (${data.driverContact}), Vehicle: ${data.vehicleName}',
                    'Transport details',
                  ),
                  icon: const Icon(Icons.copy, size: 14),
                  label: const Text('Share info', style: TextStyle(fontSize: 12)),
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    foregroundColor: Colors.teal.shade700,
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
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontWeight: FontWeight.w600,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  IconData _getVehicleIcon(String type) {
    final lower = type.toLowerCase();
    if (lower.contains('van')) return Icons.airport_shuttle;
    if (lower.contains('coach') || lower.contains('bus')) return Icons.directions_bus;
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
