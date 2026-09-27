import 'package:flutter/material.dart';

import '../models/booking.dart';

class ItineraryScreen extends StatelessWidget {
  const ItineraryScreen({super.key, required this.booking});

  final Booking booking;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${booking.tourPackageName} Itinerary')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.map_outlined, size: 48, color: Colors.grey),
              const SizedBox(height: 16),
              const Text(
                'Itinerary details coming soon.',
                style: TextStyle(fontSize: 18),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text('Confirmed for ${booking.startDate} to ${booking.endDate}.'),
              // TODO: Wire in real itinerary data once the backend exposes
              // GET /api/bookings/{booking.id}/itinerary (Guide & Itinerary
              // Management component's future work). No such endpoint exists yet.
            ],
          ),
        ),
      ),
    );
  }
}
