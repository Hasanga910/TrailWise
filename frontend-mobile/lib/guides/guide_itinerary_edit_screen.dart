import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/itinerary_step.dart';

class _EditableStepRow {
  _EditableStepRow({
    int dayNumber = 1,
    String activity = '',
    String location = '',
    String startTime = '09:00',
  })  : dayController = TextEditingController(text: dayNumber.toString()),
        activityController = TextEditingController(text: activity),
        locationController = TextEditingController(text: location),
        timeController = TextEditingController(text: startTime);

  final TextEditingController dayController;
  final TextEditingController activityController;
  final TextEditingController locationController;
  final TextEditingController timeController;

  void dispose() {
    dayController.dispose();
    activityController.dispose();
    locationController.dispose();
    timeController.dispose();
  }
}

class GuideItineraryEditScreen extends StatefulWidget {
  const GuideItineraryEditScreen({
    super.key,
    required this.bookingId,
    required this.initialSteps,
    this.apiClient,
  });

  final String bookingId;
  final List<ItineraryStep> initialSteps;
  final ApiClient? apiClient;

  @override
  State<GuideItineraryEditScreen> createState() => _GuideItineraryEditScreenState();
}

class _GuideItineraryEditScreenState extends State<GuideItineraryEditScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  final List<_EditableStepRow> _rows = [];
  bool _saving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    if (widget.initialSteps.isNotEmpty) {
      for (final s in widget.initialSteps) {
        _rows.add(_EditableStepRow(
          dayNumber: s.dayNumber,
          activity: s.activity,
          location: s.location,
          startTime: s.formattedStartTime,
        ));
      }
    } else {
      _rows.add(_EditableStepRow(
        dayNumber: 1,
        activity: '',
        location: '',
        startTime: '09:00',
      ));
    }
  }

  @override
  void dispose() {
    for (final row in _rows) {
      row.dispose();
    }
    super.dispose();
  }

  void _addStep() {
    setState(() {
      int nextDay = 1;
      if (_rows.isNotEmpty) {
        final lastDay = int.tryParse(_rows.last.dayController.text.trim()) ?? 1;
        nextDay = lastDay;
      }
      _rows.add(_EditableStepRow(
        dayNumber: nextDay,
        activity: '',
        location: '',
        startTime: '09:00',
      ));
    });
  }

  void _removeStep(int index) {
    setState(() {
      final removed = _rows.removeAt(index);
      removed.dispose();
    });
  }

  String _formatTimeForApi(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return '09:00:00';
    final parts = trimmed.split(':');
    if (parts.length == 2) {
      final hh = parts[0].padLeft(2, '0');
      final mm = parts[1].padLeft(2, '0');
      return '$hh:$mm:00';
    }
    if (parts.length == 3) {
      final hh = parts[0].padLeft(2, '0');
      final mm = parts[1].padLeft(2, '0');
      final ss = parts[2].padLeft(2, '0');
      return '$hh:$mm:$ss';
    }
    return trimmed;
  }

  Future<void> _save() async {
    if (_saving) return;

    if (_rows.isEmpty) {
      setState(() {
        _errorMessage = 'At least one step is required.';
      });
      return;
    }

    final stepsPayload = <Map<String, dynamic>>[];
    for (var i = 0; i < _rows.length; i++) {
      final row = _rows[i];
      final dayNumber = int.tryParse(row.dayController.text.trim());
      if (dayNumber == null || dayNumber <= 0) {
        setState(() {
          _errorMessage = 'Step ${i + 1}: Day number must be greater than 0.';
        });
        return;
      }

      final activity = row.activityController.text.trim();
      if (activity.isEmpty) {
        setState(() {
          _errorMessage = 'Step ${i + 1}: Activity is required.';
        });
        return;
      }

      final location = row.locationController.text.trim();
      if (location.isEmpty) {
        setState(() {
          _errorMessage = 'Step ${i + 1}: Location is required.';
        });
        return;
      }

      final time = _formatTimeForApi(row.timeController.text);

      stepsPayload.add({
        'dayNumber': dayNumber,
        'activity': activity,
        'location': location,
        'startTime': time,
      });
    }

    setState(() {
      _saving = true;
      _errorMessage = null;
    });

    try {
      final savedSteps = await _apiClient.setItinerary(widget.bookingId, stepsPayload);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Itinerary saved successfully'),
          backgroundColor: Colors.green,
        ),
      );

      Navigator.of(context).pop(savedSteps);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _errorMessage = e.message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: Colors.red,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      const msg = 'Failed to save itinerary. Please try again.';
      setState(() {
        _saving = false;
        _errorMessage = msg;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(msg),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.initialSteps.isEmpty ? 'Set Itinerary' : 'Edit Itinerary'),
        actions: [
          IconButton(
            tooltip: 'Add Step',
            icon: const Icon(Icons.add),
            onPressed: _saving ? null : _addStep,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: TextStyle(color: Colors.red.shade800, fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            ...List.generate(_rows.length, (index) {
              final row = _rows[index];
              return Card(
                key: ValueKey('stepCard_$index'),
                margin: const EdgeInsets.only(bottom: 16),
                elevation: 2,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Step ${index + 1}',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          IconButton(
                            key: ValueKey('deleteStep_$index'),
                            icon: const Icon(Icons.delete_outline, color: Colors.red),
                            tooltip: 'Delete Step',
                            onPressed: _saving ? null : () => _removeStep(index),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          SizedBox(
                            width: 90,
                            child: TextField(
                              key: ValueKey('dayNumber_$index'),
                              controller: row.dayController,
                              keyboardType: TextInputType.number,
                              enabled: !_saving,
                              decoration: const InputDecoration(
                                labelText: 'Day',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextField(
                              key: ValueKey('startTime_$index'),
                              controller: row.timeController,
                              enabled: !_saving,
                              decoration: const InputDecoration(
                                labelText: 'Start Time (HH:mm)',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        key: ValueKey('activity_$index'),
                        controller: row.activityController,
                        enabled: !_saving,
                        decoration: const InputDecoration(
                          labelText: 'Activity',
                          hintText: 'e.g. Visit Sigiriya Rock Fortress',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        key: ValueKey('location_$index'),
                        controller: row.locationController,
                        enabled: !_saving,
                        decoration: const InputDecoration(
                          labelText: 'Location',
                          hintText: 'e.g. Sigiriya',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),

            OutlinedButton.icon(
              key: const ValueKey('addStepButton'),
              onPressed: _saving ? null : _addStep,
              icon: const Icon(Icons.add),
              label: const Text('Add Step'),
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton(
                key: const ValueKey('saveItineraryButton'),
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text(
                        'Save Itinerary',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
