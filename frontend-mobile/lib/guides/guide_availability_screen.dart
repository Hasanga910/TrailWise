import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/guide_availability.dart';

const List<String> _monthNames = [
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
  'December',
];

const List<String> _weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

class GuideAvailabilityScreen extends StatefulWidget {
  const GuideAvailabilityScreen({
    super.key,
    this.apiClient,
    this.guideId,
    this.initialDate,
  });

  final ApiClient? apiClient;
  final String? guideId;
  final DateTime? initialDate;

  @override
  State<GuideAvailabilityScreen> createState() => _GuideAvailabilityScreenState();
}

class _GuideAvailabilityScreenState extends State<GuideAvailabilityScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  String? _guideId;
  late DateTime _displayedMonth;

  bool _loading = true;
  bool _fetchingMonth = false;
  String? _error;
  String? _togglingDate;

  final Map<String, GuideAvailability> _availabilityMap = {};

  @override
  void initState() {
    super.initState();
    final start = widget.initialDate ?? DateTime.now();
    _displayedMonth = DateTime(start.year, start.month, 1);
    _guideId = widget.guideId;
    _initAndLoad();
  }

  Future<void> _initAndLoad() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      if (_guideId == null) {
        final profile = await _apiClient.getGuideProfile();
        _guideId = profile.id;
      }
      await _fetchAvailabilityForMonth(_displayedMonth);
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not load availability. Please try again.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _fetchAvailabilityForMonth(DateTime month) async {
    if (_guideId == null) return;

    final daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final from = _formatDate(month.year, month.month, 1);
    final to = _formatDate(month.year, month.month, daysInMonth);

    try {
      final list = await _apiClient.getGuideAvailability(_guideId!, from: from, to: to);
      if (mounted) {
        setState(() {
          _availabilityMap.clear();
          for (final item in list) {
            _availabilityMap[item.date] = item;
          }
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not load availability. Please try again.';
        });
      }
    }
  }

  String _formatDate(int year, int month, int day) {
    final y = year.toString().padLeft(4, '0');
    final m = month.toString().padLeft(2, '0');
    final d = day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  void _prevMonth() {
    setState(() {
      _displayedMonth = DateTime(_displayedMonth.year, _displayedMonth.month - 1, 1);
      _fetchingMonth = true;
    });
    _fetchAvailabilityForMonth(_displayedMonth).then((_) {
      if (mounted) setState(() => _fetchingMonth = false);
    });
  }

  void _nextMonth() {
    setState(() {
      _displayedMonth = DateTime(_displayedMonth.year, _displayedMonth.month + 1, 1);
      _fetchingMonth = true;
    });
    _fetchAvailabilityForMonth(_displayedMonth).then((_) {
      if (mounted) setState(() => _fetchingMonth = false);
    });
  }

  String _getDayStatus(String dateStr) {
    final record = _availabilityMap[dateStr];
    if (record?.assignedBookingId != null && record!.assignedBookingId!.isNotEmpty) {
      return 'booked';
    }
    if (record != null && !record.isAvailable) {
      return 'unavailable';
    }
    return 'available';
  }

  Future<void> _toggleDay(String dateStr) async {
    final status = _getDayStatus(dateStr);
    if (status == 'booked') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Date $dateStr is booked and cannot be changed.'),
          backgroundColor: Colors.blueGrey.shade800,
          duration: const Duration(seconds: 2),
        ),
      );
      return;
    }

    if (_togglingDate != null || _guideId == null) return;

    final newIsAvailable = status != 'available';

    setState(() {
      _togglingDate = dateStr;
    });

    try {
      final updatedList = await _apiClient.updateGuideAvailability(
        _guideId!,
        [
          {'date': dateStr, 'isAvailable': newIsAvailable},
        ],
      );

      if (mounted) {
        setState(() {
          if (updatedList.isNotEmpty) {
            for (final u in updatedList) {
              _availabilityMap[u.date] = u;
            }
          } else {
            final old = _availabilityMap[dateStr];
            _availabilityMap[dateStr] = GuideAvailability(
              id: old?.id ?? 'temp-$dateStr',
              guideId: _guideId!,
              date: dateStr,
              isAvailable: newIsAvailable,
              assignedBookingId: null,
            );
          }
          _togglingDate = null;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Date $dateStr marked as ${newIsAvailable ? "Available" : "Unavailable"}.',
            ),
            backgroundColor: newIsAvailable ? Colors.teal : Colors.blueGrey,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _togglingDate = null);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _togglingDate = null);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to update availability. Please try again.'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Guide Availability'),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _guideId == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Colors.red.shade400),
              const SizedBox(height: 16),
              Text(
                _error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Colors.red),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _initAndLoad,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final year = _displayedMonth.year;
    final month = _displayedMonth.month;
    final daysInMonth = DateTime(year, month + 1, 0).day;
    final firstDayWeekday = DateTime(year, month, 1).weekday % 7; // Sunday = 0

    return RefreshIndicator(
      onRefresh: () => _fetchAvailabilityForMonth(_displayedMonth),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Month Header & Navigation Card
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Text(
                          '${_monthNames[month - 1]} $year',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        if (_fetchingMonth) ...[
                          const SizedBox(width: 8),
                          const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        ],
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          key: const Key('prev_month_button'),
                          icon: const Icon(Icons.chevron_left),
                          tooltip: 'Previous month',
                          onPressed: _prevMonth,
                        ),
                        IconButton(
                          key: const Key('next_month_button'),
                          icon: const Icon(Icons.chevron_right),
                          tooltip: 'Next month',
                          onPressed: _nextMonth,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Legend Card
            Card(
              elevation: 0,
              color: Colors.grey.shade50,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildLegendItem(
                      label: 'Available',
                      color: Colors.teal,
                      badgeBg: Colors.teal.shade50,
                    ),
                    _buildLegendItem(
                      label: 'Unavailable',
                      color: Colors.blueGrey,
                      badgeBg: Colors.grey.shade200,
                    ),
                    _buildLegendItem(
                      label: 'Booked',
                      color: Colors.blue.shade700,
                      badgeBg: Colors.blue.shade50,
                      icon: Icons.lock,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Error display if month fetch failed
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, size: 20, color: Colors.red.shade700),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setState(() => _error = null);
                        _fetchAvailabilityForMonth(_displayedMonth);
                      },
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Calendar Card
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    // Weekday Row
                    Row(
                      children: _weekdayNames
                          .map(
                            (day) => Expanded(
                              child: Center(
                                child: Text(
                                  day,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.blueGrey.shade600,
                                  ),
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                    const Divider(height: 16),

                    // Days Grid
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: firstDayWeekday + daysInMonth,
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 7,
                        childAspectRatio: 0.82,
                        crossAxisSpacing: 4,
                        mainAxisSpacing: 4,
                      ),
                      itemBuilder: (context, index) {
                        if (index < firstDayWeekday) {
                          return const SizedBox.shrink();
                        }

                        final dayNum = index - firstDayWeekday + 1;
                        final dateStr = _formatDate(year, month, dayNum);
                        final status = _getDayStatus(dateStr);
                        final isToggling = _togglingDate == dateStr;

                        return _buildDayCell(
                          dateStr: dateStr,
                          dayNum: dayNum,
                          status: status,
                          isToggling: isToggling,
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Informational Footer
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '* Days without explicit records are treated as Available by default.',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '* Tap an Available or Unavailable date to toggle. Booked dates are locked to prevent scheduling conflicts.',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendItem({
    required String label,
    required Color color,
    required Color badgeBg,
    IconData? icon,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
          child: icon != null
              ? Icon(icon, size: 8, color: Colors.white)
              : null,
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Colors.blueGrey.shade800,
          ),
        ),
      ],
    );
  }

  Widget _buildDayCell({
    required String dateStr,
    required int dayNum,
    required String status,
    required bool isToggling,
  }) {
    final isBooked = status == 'booked';
    final isAvailable = status == 'available';
    final isUnavailable = status == 'unavailable';

    final Color bgColor;
    final Color borderColor;
    final Color textColor;
    final String statusLabel;

    if (isBooked) {
      bgColor = Colors.blue.shade50;
      borderColor = Colors.blue.shade200;
      textColor = Colors.blue.shade900;
      statusLabel = 'Booked';
    } else if (isUnavailable) {
      bgColor = Colors.grey.shade100;
      borderColor = Colors.grey.shade300;
      textColor = Colors.grey.shade700;
      statusLabel = 'Unavailable';
    } else {
      bgColor = Colors.teal.shade50.withValues(alpha: 0.5);
      borderColor = Colors.teal.shade200;
      textColor = Colors.teal.shade900;
      statusLabel = 'Available';
    }

    return InkWell(
      key: Key('day_$dateStr'),
      onTap: isBooked ? () => _toggleDay(dateStr) : () => _toggleDay(dateStr),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: borderColor,
            width: 1,
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 2),
                  child: Text(
                    '$dayNum',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: textColor,
                    ),
                  ),
                ),
                if (isBooked)
                  Icon(Icons.lock, size: 10, color: Colors.blue.shade800)
                else if (isToggling)
                  const SizedBox(
                    width: 8,
                    height: 8,
                    child: CircularProgressIndicator(strokeWidth: 1.5),
                  ),
              ],
            ),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                decoration: BoxDecoration(
                  color: isBooked
                      ? Colors.blue.shade100
                      : isAvailable
                          ? Colors.teal.shade100
                          : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 8,
                    fontWeight: FontWeight.w700,
                    color: textColor,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
