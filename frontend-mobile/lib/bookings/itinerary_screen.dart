import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/booking.dart';
import '../models/vehicle_assignment.dart';
import 'booking_status.dart';
import 'transport_info_card.dart';

class ItineraryScreen extends StatefulWidget {
  const ItineraryScreen({
    super.key,
    required this.booking,
    this.apiClient,
  });

  final Booking booking;
  final ApiClient? apiClient;

  @override
  State<ItineraryScreen> createState() => _ItineraryScreenState();
}

class _ItineraryScreenState extends State<ItineraryScreen> {
  VehicleAssignment? _assignment;
  bool _loadingAssignment = true;

  @override
  void initState() {
    super.initState();
    if (widget.booking.vehicleAssignment != null) {
      _assignment = widget.booking.vehicleAssignment;
      _loadingAssignment = false;
    } else {
      _fetchAssignment();
    }
  }

  Future<void> _fetchAssignment() async {
    setState(() {
      _loadingAssignment = true;
    });

    final client = widget.apiClient ?? context.read<AuthProvider>().apiClient;

    try {
      final res = await client.get('/api/vehicles/assignments/by-booking/${widget.booking.id}');
      if (mounted && res is Map<String, dynamic>) {
        setState(() {
          _assignment = VehicleAssignment.fromJson(res);
          _loadingAssignment = false;
        });
        return;
      }
    } catch (_) {
      // If assignment is not yet created (e.g. 404), fall back to null (Pending state).
    }

    if (mounted) {
      setState(() {
        _assignment = null;
        _loadingAssignment = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = widget.booking;
    final statusColor = BookingStatus.color(booking.status);

    return Scaffold(
      appBar: AppBar(
        title: Text('${booking.tourPackageName} Itinerary'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh transport and schedule',
            onPressed: _fetchAssignment,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchAssignment,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Tour summary card
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                booking.tourPackageName,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Tier: ${booking.packageTier.classType} · ${booking.groupSize} ${booking.groupSize == 1 ? 'traveler' : 'travelers'}',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey.shade700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Chip(
                          label: Text(
                            booking.status,
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          backgroundColor: statusColor.withValues(alpha: 0.12),
                          visualDensity: VisualDensity.compact,
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    const Divider(height: 1),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.date_range, size: 16, color: Colors.teal),
                        const SizedBox(width: 8),
                        Text(
                          '${booking.startDate}  →  ${booking.endDate}',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Person 3 Fleet & Transport Integration Card
            TransportInfoCard(
              assignment: _assignment,
              isLoading: _loadingAssignment,
            ),
            const SizedBox(height: 16),

            // Daily Itinerary / Schedule Placeholder notice
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.map_outlined, size: 40, color: Colors.teal.shade300),
                    const SizedBox(height: 12),
                    const Text(
                      'Detailed Daily Itinerary',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Confirmed itinerary stops and guide milestones will synchronize here as tour dates approach.',
                      style: TextStyle(fontSize: 13, color: Colors.grey.shade600, height: 1.3),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
