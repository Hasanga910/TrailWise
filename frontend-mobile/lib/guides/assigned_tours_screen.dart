import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../bookings/booking_status.dart';
import '../models/assigned_tour.dart';
import 'tour_detail_screen.dart';

class AssignedToursScreen extends StatefulWidget {
  const AssignedToursScreen({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  State<AssignedToursScreen> createState() => _AssignedToursScreenState();
}

class _AssignedToursScreenState extends State<AssignedToursScreen> {
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
      setState(() {
        _tours = tours;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Could not reach the server. Please try again.';
        _loading = false;
      });
    }
  }

  Future<void> _openTourDetail(AssignedTour tour) async {
    final updated = await Navigator.of(context).push<AssignedTour>(
      MaterialPageRoute(
        builder: (_) => TourDetailScreen(
          tour: tour,
          apiClient: _apiClient,
        ),
      ),
    );

    if (updated != null && mounted) {
      setState(() {
        if (_tours != null) {
          final index = _tours!.indexWhere((t) => t.bookingId == updated.bookingId);
          if (index != -1) {
            _tours![index] = updated;
          }
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Assigned Tours'),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
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
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.red, fontSize: 16),
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
    if (tours.isEmpty) {
      return const Center(
        child: Text(
          'No tours assigned yet',
          style: TextStyle(fontSize: 16, color: Colors.grey),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: tours.length,
        itemBuilder: (context, index) {
          final tour = tours[index];
          return _AssignedTourCard(
            tour: tour,
            onTap: () => _openTourDetail(tour),
          );
        },
      ),
    );
  }
}

class _AssignedTourCard extends StatelessWidget {
  const _AssignedTourCard({
    required this.tour,
    this.onTap,
  });

  final AssignedTour tour;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final statusColor = BookingStatus.color(tour.status);

    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [

            // Top Row: Tour Package Name and Status Chip
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    tour.tourPackageName,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Chip(
                  label: Text(
                    tour.status,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  backgroundColor: statusColor.withValues(alpha: 0.15),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Theme Chip / Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.teal.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                tour.theme,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Colors.teal,
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Date Range
            Row(
              children: [
                const Icon(Icons.date_range, size: 16, color: Colors.grey),
                const SizedBox(width: 6),
                Text(
                  '${tour.startDate} to ${tour.endDate}',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                ),
              ],
            ),
            const SizedBox(height: 6),

            // Group Size
            Row(
              children: [
                const Icon(Icons.people_outline, size: 16, color: Colors.grey),
                const SizedBox(width: 6),
                Text(
                  '${tour.groupSize} ${tour.groupSize == 1 ? 'traveler' : 'travelers'}',
                  style: const TextStyle(fontSize: 14),
                ),
              ],
            ),

            // Locations (if any)
            if (tour.locations.isNotEmpty) ...[
              const SizedBox(height: 6),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.location_on_outlined, size: 16, color: Colors.grey),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Locations: ${tour.locations.join(', ')}',
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                ],
              ),
            ],

            // Special Requests (when non-empty)
            if (tour.specialRequests != null &&
                tour.specialRequests!.trim().isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.notes, size: 16, color: Colors.amber.shade800),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Special requests: ${tour.specialRequests}',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Attendance and Completion Badges
            if (tour.attended || tour.completed) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  if (tour.attended) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.green.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check_circle_outline, size: 14, color: Colors.green),
                          SizedBox(width: 4),
                          Text(
                            'Attended',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.green,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  if (tour.completed) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.blue.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.done_all, size: 14, color: Colors.blue),
                          SizedBox(width: 4),
                          Text(
                            'Completed',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.blue,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ],

            // Guide Notes preview if any
            if (tour.guideNotes != null &&
                tour.guideNotes!.trim().isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.comment_outlined, size: 14, color: Colors.grey),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Notes: ${tour.guideNotes}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13, color: Colors.black87),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

