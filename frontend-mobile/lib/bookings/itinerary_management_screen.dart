import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import 'itinerary_screen.dart';

class ItineraryManagementScreen extends StatefulWidget {
  const ItineraryManagementScreen({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  State<ItineraryManagementScreen> createState() =>
      _ItineraryManagementScreenState();
}

class _ItineraryManagementScreenState extends State<ItineraryManagementScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  final _controller = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _openItinerary() {
    if (!_formKey.currentState!.validate()) return;

    final bookingId = _controller.text.trim();
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ItineraryScreen(
          bookingId: bookingId,
          apiClient: _apiClient,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Itinerary Management')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Manage Booking Itinerary',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter a confirmed tour booking ID (UUID) to view, create, or update its daily schedule.',
                style: TextStyle(fontSize: 14, color: Colors.black54),
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: _controller,
                decoration: const InputDecoration(
                  labelText: 'Booking ID (UUID) *',
                  hintText: 'e.g. 11111111-1111-1111-1111-111111111111',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.confirmation_number_outlined),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please enter a booking ID';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                icon: const Icon(Icons.arrow_forward),
                label: const Text('Load Itinerary'),
                onPressed: _openItinerary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
