import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/booking.dart';
import '../models/review.dart';
import 'booking_status.dart';

class ReviewScreen extends StatefulWidget {
  const ReviewScreen({
    super.key,
    required this.booking,
    this.apiClient,
  });

  final Booking booking;
  final ApiClient? apiClient;

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  final _commentController = TextEditingController();
  int _rating = 0;
  bool _submitting = false;
  bool _submitted = false;
  String? _submitError;
  String? _ratingError;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submitReview() async {
    if (_rating < 1 || _rating > 5) {
      setState(() {
        _ratingError = 'Please select a rating between 1 and 5 stars.';
      });
      return;
    }

    setState(() {
      _ratingError = null;
      _submitError = null;
      _submitting = true;
    });

    final trimmedComment = _commentController.text.trim();
    final body = <String, dynamic>{
      'rating': _rating,
      'comment': trimmedComment.isEmpty ? null : trimmedComment,
    };

    try {
      final json = await _apiClient.post(
        '/api/bookings/${widget.booking.id}/reviews',
        body,
      );
      if (json.isNotEmpty) {
        Review.fromJson(json);
      }

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Review submitted successfully.')),
      );

      setState(() {
        _submitting = false;
        _submitted = true;
        _submitError = null;
        _ratingError = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = 'Could not submit review. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Review Trip')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    final booking = widget.booking;
    final bookingColor = BookingStatus.color(booking.status);
    final isCompleted = booking.status == BookingStatus.completed;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // A. Booking Summary Card
              Card(
                margin: const EdgeInsets.only(bottom: 16),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              booking.tourPackageName,
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Chip(
                            label: Text(booking.status, style: TextStyle(color: bookingColor, fontSize: 12)),
                            backgroundColor: bookingColor.withValues(alpha: 0.15),
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${booking.packageTier.classType} Class · ${booking.startDate} to ${booking.endDate}',
                        style: TextStyle(color: Colors.grey.shade700, fontSize: 14),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${booking.groupSize} ${booking.groupSize == 1 ? 'traveler' : 'travelers'}',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),

              // B. Non-Completed Guard
              if (!isCompleted)
                Card(
                  color: Colors.amber.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: Colors.amber.shade800),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Reviews can only be submitted for completed bookings.',
                            style: TextStyle(fontSize: 14),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              // Success State Banner
              else if (_submitted)
                Card(
                  color: Colors.green.shade50,
                  child: const Padding(
                    padding: EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(Icons.check_circle_outline, color: Colors.green),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Review submitted successfully.',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.green),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              // C. Review Form
              else
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Rate your experience',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.start,
                          children: [
                            for (int i = 1; i <= 5; i++)
                              IconButton(
                                key: Key('star_$i'),
                                icon: Icon(
                                  i <= _rating ? Icons.star : Icons.star_border,
                                  color: i <= _rating ? Colors.amber.shade700 : Colors.grey,
                                  size: 32,
                                ),
                                tooltip: '$i star${i == 1 ? '' : 's'}',
                                onPressed: _submitting
                                    ? null
                                    : () {
                                        setState(() {
                                          _rating = i;
                                          _ratingError = null;
                                        });
                                      },
                              ),
                            if (_rating > 0) ...[
                              const SizedBox(width: 8),
                              Text(
                                '$_rating / 5',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                            ],
                          ],
                        ),
                        if (_ratingError != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 4, left: 4),
                            child: Text(
                              _ratingError!,
                              style: const TextStyle(color: Colors.red, fontSize: 12),
                            ),
                          ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _commentController,
                          minLines: 3,
                          maxLines: 5,
                          maxLength: 2000,
                          decoration: const InputDecoration(
                            labelText: 'Comments (optional)',
                            alignLabelWithHint: true,
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (_submitError != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              _submitError!,
                              style: const TextStyle(color: Colors.red),
                            ),
                          ),
                        FilledButton(
                          onPressed: _submitting ? null : _submitReview,
                          child: _submitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('Submit Review'),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
