import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/booking.dart';
import '../models/itinerary_step.dart';

class ItineraryScreen extends StatefulWidget {
  const ItineraryScreen({
    super.key,
    this.booking,
    this.bookingId,
    this.title,
    this.apiClient,
  }) : assert(booking != null || bookingId != null, 'Either booking or bookingId must be provided.');

  final Booking? booking;
  final String? bookingId;
  final String? title;
  final ApiClient? apiClient;

  @override
  State<ItineraryScreen> createState() => _ItineraryScreenState();
}

class _ItineraryScreenState extends State<ItineraryScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  late final String _bookingId = widget.booking?.id ?? widget.bookingId!;
  late final String _displayTitle = widget.title ??
      (widget.booking != null ? '${widget.booking!.tourPackageName} Itinerary' : 'Tour Itinerary');

  List<ItineraryStep> _steps = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadItinerary();
  }

  Future<void> _loadItinerary() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final steps = await _apiClient.getItinerary(_bookingId);
      if (!mounted) return;
      setState(() {
        _steps = steps..sort((a, b) {
          if (a.dayNumber != b.dayNumber) {
            return a.dayNumber.compareTo(b.dayNumber);
          }
          return a.startTime.compareTo(b.startTime);
        });
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load itinerary.';
        _loading = false;
      });
    }
  }

  Future<void> _saveItinerary() async {
    setState(() => _saving = true);

    final payload = _steps.map((s) {
      final timeStr = s.startTime.length == 5 ? '${s.startTime}:00' : s.startTime;
      return {
        'dayNumber': s.dayNumber,
        'activity': s.activity,
        'location': s.location,
        'startTime': timeStr,
      };
    }).toList();

    try {
      final saved = await _apiClient.setItinerary(_bookingId, payload);
      if (!mounted) return;
      setState(() {
        _steps = saved..sort((a, b) {
          if (a.dayNumber != b.dayNumber) {
            return a.dayNumber.compareTo(b.dayNumber);
          }
          return a.startTime.compareTo(b.startTime);
        });
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Itinerary saved successfully'),
          backgroundColor: Colors.green,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to save itinerary.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showAddStepDialog() {
    int dayNumber = 1;
    String startTime = '09:00';
    String activity = '';
    String location = '';
    String? dialogError;

    showDialog<void>(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Add Itinerary Step'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (dialogError != null) ...[
                      Text(
                        dialogError!,
                        style: const TextStyle(color: Colors.red, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                    ],
                    TextFormField(
                      initialValue: '1',
                      decoration: const InputDecoration(labelText: 'Day Number *'),
                      keyboardType: TextInputType.number,
                      onChanged: (val) {
                        dayNumber = int.tryParse(val) ?? 1;
                      },
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      initialValue: '09:00',
                      decoration: const InputDecoration(
                        labelText: 'Start Time (HH:mm) *',
                        hintText: 'e.g. 09:00',
                      ),
                      onChanged: (val) {
                        startTime = val.trim();
                      },
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      decoration: const InputDecoration(
                        labelText: 'Activity *',
                        hintText: 'e.g. Temple of the Tooth Visit',
                      ),
                      maxLength: 300,
                      onChanged: (val) {
                        activity = val.trim();
                      },
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      decoration: const InputDecoration(
                        labelText: 'Location *',
                        hintText: 'e.g. Kandy',
                      ),
                      maxLength: 300,
                      onChanged: (val) {
                        location = val.trim();
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogCtx).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    if (dayNumber <= 0) {
                      setDialogState(() => dialogError = 'Day number must be greater than 0.');
                      return;
                    }
                    if (activity.isEmpty) {
                      setDialogState(() => dialogError = 'Activity is required.');
                      return;
                    }
                    if (location.isEmpty) {
                      setDialogState(() => dialogError = 'Location is required.');
                      return;
                    }
                    final exists = _steps.any(
                      (s) => s.dayNumber == dayNumber && s.startTime == startTime,
                    );
                    if (exists) {
                      setDialogState(() => dialogError = 'Duplicate step scheduled for Day $dayNumber at $startTime.');
                      return;
                    }

                    setState(() {
                      _steps.add(ItineraryStep(
                        bookingId: _bookingId,
                        dayNumber: dayNumber,
                        activity: activity,
                        location: location,
                        startTime: startTime,
                      ));
                      _steps.sort((a, b) {
                        if (a.dayNumber != b.dayNumber) {
                          return a.dayNumber.compareTo(b.dayNumber);
                        }
                        return a.startTime.compareTo(b.startTime);
                      });
                    });
                    Navigator.of(dialogCtx).pop();
                  },
                  child: const Text('Add Step'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _removeStep(int index) {
    setState(() {
      _steps.removeAt(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final canEdit = user?.role == 'OperationsManager' ||
        user?.role == 'Admin' ||
        user?.role == 'TourGuide';

    return Scaffold(
      appBar: AppBar(
        title: Text(_displayTitle),
        actions: [
          if (canEdit && !_loading)
            TextButton(
              onPressed: _saving ? null : _saveItinerary,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text(
                      'Save',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
            ),
        ],
      ),
      floatingActionButton: canEdit && !_loading && _error == null
          ? FloatingActionButton(
              onPressed: _showAddStepDialog,
              tooltip: 'Add Step',
              child: const Icon(Icons.add),
            )
          : null,
      body: _buildBody(canEdit),
    );
  }

  Widget _buildBody(bool canEdit) {
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
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loadItinerary,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_steps.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.map_outlined, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              const Text(
                'No itinerary steps scheduled yet.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16),
              ),
              if (canEdit) ...[
                const SizedBox(height: 8),
                const Text(
                  'Tap "+" to add the first itinerary step.',
                  style: TextStyle(fontSize: 14, color: Colors.black54),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
      itemCount: _steps.length,
      separatorBuilder: (_, _) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final step = _steps[index];
        return Card(
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: Colors.teal.shade50,
              child: Text(
                'D${step.dayNumber}',
                style: TextStyle(
                  color: Colors.teal.shade800,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ),
            title: Text(
              step.activity,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 2),
                Text('📍 ${step.location}', style: const TextStyle(fontSize: 13)),
                Text(
                  '🕒 ${step.startTime}',
                  style: const TextStyle(fontSize: 12, color: Colors.black54),
                ),
              ],
            ),
            trailing: canEdit
                ? IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    onPressed: () => _removeStep(index),
                    tooltip: 'Remove Step',
                  )
                : null,
          ),
        );
      },
    );
  }
}
