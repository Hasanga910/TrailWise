import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/guide.dart';
import '../models/guide_availability.dart';

class GuideAvailabilityScreen extends StatefulWidget {
  const GuideAvailabilityScreen({
    super.key,
    this.selectedGuide,
    this.apiClient,
  });

  final Guide? selectedGuide;
  final ApiClient? apiClient;

  @override
  State<GuideAvailabilityScreen> createState() =>
      _GuideAvailabilityScreenState();
}

class _GuideAvailabilityScreenState extends State<GuideAvailabilityScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  List<Guide> _allGuides = [];
  Guide? _currentGuide;
  DateTime _currentMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);

  bool _loadingGuides = true;
  bool _loadingAvailability = false;
  bool _saving = false;
  String? _error;

  // Stored state for current month availability
  Map<String, GuideAvailability> _availabilityMap = {};
  // Track modified dates for save
  final Map<String, bool> _pendingChanges = {};

  @override
  void initState() {
    super.initState();
    _initGuides();
  }

  Future<void> _initGuides() async {
    final user = context.read<AuthProvider>().user;
    final isTourGuide = user?.role == 'TourGuide';

    setState(() {
      _loadingGuides = true;
      _error = null;
    });

    try {
      final guides = await _apiClient.getGuides();
      if (!mounted) return;

      Guide? guideToSelect;
      if (isTourGuide) {
        guideToSelect = guides.cast<Guide?>().firstWhere(
              (g) => g?.userId == user?.id,
              orElse: () => null,
            );
        if (guideToSelect == null) {
          setState(() {
            _loadingGuides = false;
            _error = 'No guide profile found linked to your account.';
          });
          return;
        }
      } else {
        guideToSelect = widget.selectedGuide ?? (guides.isNotEmpty ? guides.first : null);
      }

      setState(() {
        _allGuides = guides;
        _currentGuide = guideToSelect;
        _loadingGuides = false;
      });

      if (_currentGuide != null) {
        _loadAvailability();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingGuides = false;
        _error = 'Failed to load guides.';
      });
    }
  }

  Future<void> _loadAvailability() async {
    if (_currentGuide == null) return;

    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final lastDay = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);

    final fromStr =
        '${firstDay.year}-${firstDay.month.toString().padLeft(2, '0')}-01';
    final toStr =
        '${lastDay.year}-${lastDay.month.toString().padLeft(2, '0')}-${lastDay.day.toString().padLeft(2, '0')}';

    setState(() {
      _loadingAvailability = true;
      _error = null;
      _pendingChanges.clear();
    });

    try {
      final rows = await _apiClient.getGuideAvailability(
        _currentGuide!.id,
        from: fromStr,
        to: toStr,
      );

      if (!mounted) return;
      final map = <String, GuideAvailability>{};
      for (final r in rows) {
        map[r.date] = r;
      }

      setState(() {
        _availabilityMap = map;
        _loadingAvailability = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingAvailability = false;
        _error = 'Failed to load availability.';
      });
    }
  }

  void _toggleDay(String dateKey, bool currentlyAvailable, bool isBooked) {
    if (isBooked) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cannot modify availability for a date with an assigned booking.'),
        ),
      );
      return;
    }

    final newStatus = !currentlyAvailable;
    setState(() {
      _pendingChanges[dateKey] = newStatus;
    });
  }

  Future<void> _saveChanges() async {
    if (_currentGuide == null || _pendingChanges.isEmpty) return;

    setState(() => _saving = true);

    final payload = _pendingChanges.entries.map((e) {
      return {
        'date': e.key,
        'isAvailable': e.value,
      };
    }).toList();

    try {
      await _apiClient.updateGuideAvailability(_currentGuide!.id, payload);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Availability updated successfully'),
          backgroundColor: Colors.green,
        ),
      );
      _loadAvailability();
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
          content: Text('Failed to update availability.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final isTourGuide = user?.role == 'TourGuide';

    return Scaffold(
      appBar: AppBar(
        title: Text(isTourGuide ? 'My Availability' : 'Guide Availability'),
        actions: [
          if (isTourGuide && _pendingChanges.isNotEmpty)
            TextButton(
              onPressed: _saving ? null : _saveChanges,
              child: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Save',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
            ),
        ],
      ),
      body: _buildBody(isTourGuide),
    );
  }

  Widget _buildBody(bool isTourGuide) {
    if (_loadingGuides) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _currentGuide == null) {
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
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        // Guide Selector for Manager/Admin
        if (!isTourGuide && _allGuides.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: Colors.grey.shade100,
            child: Row(
              children: [
                const Text(
                  'Guide: ',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButton<String>(
                    isExpanded: true,
                    value: _currentGuide?.id,
                    items: _allGuides.map((g) {
                      return DropdownMenuItem<String>(
                        value: g.id,
                        child: Text(g.name),
                      );
                    }).toList(),
                    onChanged: (id) {
                      if (id != null) {
                        setState(() {
                          _currentGuide = _allGuides.firstWhere((g) => g.id == id);
                        });
                        _loadAvailability();
                      }
                    },
                  ),
                ),
              ],
            ),
          ),

        // Month Navigation
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left),
                onPressed: () {
                  setState(() {
                    _currentMonth = DateTime(
                      _currentMonth.year,
                      _currentMonth.month - 1,
                      1,
                    );
                  });
                  _loadAvailability();
                },
              ),
              Text(
                '${_monthName(_currentMonth.month)} ${_currentMonth.year}',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.chevron_right),
                onPressed: () {
                  setState(() {
                    _currentMonth = DateTime(
                      _currentMonth.year,
                      _currentMonth.month + 1,
                      1,
                    );
                  });
                  _loadAvailability();
                },
              ),
            ],
          ),
        ),

        // Legend
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _legendItem(Colors.green.shade600, 'Available'),
              _legendItem(Colors.grey.shade400, 'Unavailable'),
              _legendItem(Colors.blue.shade600, 'Booked Tour'),
            ],
          ),
        ),
        const Divider(),

        // Calendar Grid
        Expanded(
          child: _loadingAvailability
              ? const Center(child: CircularProgressIndicator())
              : _buildCalendarGrid(isTourGuide),
        ),

        // Pending changes bar for TourGuide
        if (isTourGuide && _pendingChanges.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.amber.shade50,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${_pendingChanges.length} unsaved date change${_pendingChanges.length == 1 ? '' : 's'}',
                    style: TextStyle(
                      color: Colors.amber.shade900,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                FilledButton(
                  onPressed: _saving ? null : _saveChanges,
                  child: const Text('Save Changes'),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _legendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }

  Widget _buildCalendarGrid(bool isTourGuide) {
    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final daysInMonth =
        DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;
    final startWeekday = firstDay.weekday % 7; // 0 = Sunday

    return GridView.builder(
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        crossAxisSpacing: 6,
        mainAxisSpacing: 6,
      ),
      itemCount: startWeekday + daysInMonth,
      itemBuilder: (context, index) {
        if (index < startWeekday) {
          return const SizedBox.shrink();
        }

        final day = index - startWeekday + 1;
        final dateKey =
            '${_currentMonth.year}-${_currentMonth.month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';

        final existing = _availabilityMap[dateKey];
        final isBooked = existing?.assignedBookingId != null;

        // Effective status
        final isAvailable = _pendingChanges.containsKey(dateKey)
            ? _pendingChanges[dateKey]!
            : (existing?.isAvailable ?? true);

        Color bgColor;
        Color textColor = Colors.white;

        if (isBooked) {
          bgColor = Colors.blue.shade600;
        } else if (isAvailable) {
          bgColor = Colors.green.shade600;
        } else {
          bgColor = Colors.grey.shade400;
        }

        final isModified = _pendingChanges.containsKey(dateKey);

        return InkWell(
          onTap: isTourGuide
              ? () => _toggleDay(dateKey, isAvailable, isBooked)
              : null,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(8),
              border: isModified
                  ? Border.all(color: Colors.amber.shade700, width: 2.5)
                  : null,
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  day.toString(),
                  style: TextStyle(
                    color: textColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                if (isBooked)
                  const Text(
                    'Tour',
                    style: TextStyle(color: Colors.white, fontSize: 9),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _monthName(int month) {
    const names = [
      '',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    return names[month];
  }
}
