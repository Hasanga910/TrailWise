import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/booking.dart';
import '../models/itinerary_step.dart';
import '../models/vehicle_assignment.dart';
import 'booking_status.dart';
import 'guide_info_card.dart';
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
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  late Booking _booking = widget.booking;
  VehicleAssignment? _assignment;
  bool _loadingAssignment = true;

  bool _loadingSteps = true;
  String? _stepsErrorMessage;
  List<ItineraryStep> _steps = [];

  @override
  void initState() {
    super.initState();
    _booking = widget.booking;
    if (_booking.vehicleAssignment != null) {
      _assignment = _booking.vehicleAssignment;
      _loadingAssignment = false;
    } else {
      _fetchAssignment();
    }
    _loadSteps();
  }

  Future<void> _refreshAll() async {
    await Future.wait([
      _fetchBooking(),
      _fetchAssignment(),
      _loadSteps(),
    ]);
  }

  Future<void> _fetchBooking() async {
    try {
      final res = await _apiClient.get('/api/bookings/${_booking.id}');
      if (mounted && res is Map<String, dynamic>) {
        setState(() {
          _booking = Booking.fromJson(res);
        });
      }
    } catch (_) {
      // ignore
    }
  }

  Future<void> _fetchAssignment() async {
    setState(() {
      _loadingAssignment = true;
    });

    try {
      final res = await _apiClient.get('/api/vehicles/assignments/by-booking/${widget.booking.id}');
      if (mounted && res is Map<String, dynamic>) {
        setState(() {
          _assignment = VehicleAssignment.fromJson(res);
          _loadingAssignment = false;
        });
        return;
      }
    } catch (_) {
      // 404 or unassigned yet
    }

    if (mounted) {
      setState(() {
        _assignment = null;
        _loadingAssignment = false;
      });
    }
  }

  Future<void> _loadSteps() async {
    setState(() {
      _loadingSteps = true;
      _stepsErrorMessage = null;
    });

    try {
      final steps = await _apiClient.getItinerary(widget.booking.id);
      if (!mounted) return;
      setState(() {
        _steps = steps;
        _loadingSteps = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingSteps = false;
        _stepsErrorMessage = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingSteps = false;
        _stepsErrorMessage = 'Failed to load itinerary. Please try again.';
      });
    }
  }

  Map<int, List<ItineraryStep>> get _stepsByDay {
    final grouped = <int, List<ItineraryStep>>{};
    for (final step in _steps) {
      grouped.putIfAbsent(step.dayNumber, () => []).add(step);
    }
    for (final steps in grouped.values) {
      steps.sort((a, b) => a.startTime.compareTo(b.startTime));
    }
    return grouped;
  }

  @override
  Widget build(BuildContext context) {
    final booking = _booking;
    final statusColor = BookingStatus.color(booking.status);

    return Scaffold(
      appBar: AppBar(
        title: Text('${booking.tourPackageName} Itinerary'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh transport and schedule',
            onPressed: _refreshAll,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refreshAll,
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

            // Assigned Tour Guide Card
            if (booking.status != BookingStatus.cancelled) ...[
              GuideInfoCard(guide: booking.assignedGuide),
              const SizedBox(height: 16),
            ],

            // Person 3 Fleet & Transport Integration Card
            TransportInfoCard(
              assignment: _assignment,
              isLoading: _loadingAssignment,
            ),
            const SizedBox(height: 20),

            // Daily Itinerary Section
            const Text(
              'TOUR SCHEDULE & STOPS',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
                color: Colors.teal,
              ),
            ),
            const SizedBox(height: 8),

            _buildStepsSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildStepsSection() {
    if (_loadingSteps) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_stepsErrorMessage != null) {
      return Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Icon(Icons.error_outline, size: 36, color: Colors.red.shade400),
              const SizedBox(height: 10),
              Text(
                _stepsErrorMessage!,
                style: const TextStyle(fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              FilledButton.tonal(
                onPressed: _loadSteps,
                child: const Text('Retry schedule'),
              ),
            ],
          ),
        ),
      );
    }

    if (_steps.isEmpty) {
      return Card(
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
                'Itinerary Details',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                'No schedule steps have been created for this tour yet. Detailed milestones will appear here as tour dates approach.',
                style: TextStyle(fontSize: 13, color: Colors.grey.shade600, height: 1.3),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final grouped = _stepsByDay;
    final days = grouped.keys.toList()..sort();

    return Column(
      children: [
        for (final day in days) ...[
          Card(
            margin: const EdgeInsets.only(bottom: 16),
            elevation: 1.5,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Day $day',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  for (final step in grouped[day]!) ...[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 56,
                          child: Text(
                            step.formattedStartTime,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                step.activity,
                                style: const TextStyle(fontWeight: FontWeight.w500),
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  const Icon(Icons.location_on_outlined,
                                      size: 14, color: Colors.grey),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      step.location,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        color: Colors.grey,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (step != grouped[day]!.last) const Divider(height: 20),
                  ],
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}
