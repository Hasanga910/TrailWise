import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/booking.dart';
import '../models/paged_result.dart';
import 'booking_status.dart';
import 'itinerary_screen.dart';
import 'payment_status_screen.dart';

class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> {
  late final ApiClient _apiClient = widget.apiClient ?? context.read<AuthProvider>().apiClient;

  static const _pageSize = 10;

  String? _statusFilter;
  DateTime? _from;
  DateTime? _to;
  int _page = 1;

  PagedResult<Booking>? _result;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _formatDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final json = await _apiClient.get('/api/bookings/mine', query: {
        'status': _statusFilter,
        'from': _from == null ? null : _formatDate(_from!),
        'to': _to == null ? null : _formatDate(_to!),
        'page': _page,
        'pageSize': _pageSize,
      });
      setState(() {
        _result = PagedResult<Booking>.fromJson(json as Map<String, dynamic>, Booking.fromJson);
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

  Future<void> _pickFrom() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _from ?? now,
      firstDate: DateTime(now.year - 3),
      lastDate: DateTime(now.year + 3),
    );
    if (picked != null) {
      setState(() {
        _from = picked;
        _page = 1;
      });
      _load();
    }
  }

  Future<void> _pickTo() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _to ?? now,
      firstDate: DateTime(now.year - 3),
      lastDate: DateTime(now.year + 3),
    );
    if (picked != null) {
      setState(() {
        _to = picked;
        _page = 1;
      });
      _load();
    }
  }

  void _openBooking(Booking booking) {
    if (booking.status == BookingStatus.confirmed) {
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => ItineraryScreen(booking: booking)));
    }
  }

  void _openPayment(Booking booking) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => PaymentStatusScreen(
          booking: booking,
          apiClient: _apiClient,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Bookings')),
      body: Column(
        children: [
          _buildFilters(),
          const Divider(height: 1),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Expanded(
            child: DropdownButtonFormField<String?>(
              initialValue: _statusFilter,
              decoration: const InputDecoration(labelText: 'Status'),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('All')),
                ...BookingStatus.all
                    .map((s) => DropdownMenuItem<String?>(value: s, child: Text(s))),
              ],
              onChanged: (value) {
                setState(() {
                  _statusFilter = value;
                  _page = 1;
                });
                _load();
              },
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.date_range),
            tooltip: _from == null ? 'From date' : _formatDate(_from!),
            onPressed: _pickFrom,
          ),
          IconButton(
            icon: const Icon(Icons.date_range_outlined),
            tooltip: _to == null ? 'To date' : _formatDate(_to!),
            onPressed: _pickTo,
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 12),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }
    final result = _result!;
    if (result.items.isEmpty) {
      return const Center(child: Text('No bookings match your filters.'));
    }
    final totalPages = (result.totalCount / result.pageSize).ceil().clamp(1, 1 << 30);
    final isFirstPage = _page <= 1;
    final isLastPage = _page * result.pageSize >= result.totalCount;

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: result.items.length,
            itemBuilder: (_, i) => _BookingCard(
              booking: result.items[i],
              onTap: () => _openBooking(result.items[i]),
              onPaymentTap: () => _openPayment(result.items[i]),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: isFirstPage
                    ? null
                    : () {
                        setState(() => _page--);
                        _load();
                      },
                child: const Text('Previous'),
              ),
              Text('Page $_page of $totalPages'),
              TextButton(
                onPressed: isLastPage
                    ? null
                    : () {
                        setState(() => _page++);
                        _load();
                      },
                child: const Text('Next'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _BookingCard extends StatelessWidget {
  const _BookingCard({
    required this.booking,
    required this.onTap,
    this.onPaymentTap,
  });

  final Booking booking;
  final VoidCallback onTap;
  final VoidCallback? onPaymentTap;

  @override
  Widget build(BuildContext context) {
    final color = BookingStatus.color(booking.status);
    final isConfirmed = booking.status == BookingStatus.confirmed;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Column(
          children: [
            ListTile(
              onTap: onTap,
              title: Text('${booking.tourPackageName} — ${booking.packageTier.classType}'),
              subtitle: Text(
                '${booking.startDate} to ${booking.endDate} · ${booking.groupSize} '
                '${booking.groupSize == 1 ? 'traveler' : 'travelers'} · '
                '\$${booking.budgetPerPerson.toStringAsFixed(2)}/person',
              ),
              trailing: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Chip(
                    label: Text(booking.status, style: TextStyle(color: color, fontSize: 12)),
                    backgroundColor: color.withValues(alpha: 0.15),
                    visualDensity: VisualDensity.compact,
                  ),
                  if (booking.isLargeGroup)
                    const Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text('Large group', style: TextStyle(fontSize: 11, color: Colors.grey)),
                    ),
                ],
              ),
            ),
            if (isConfirmed && onPaymentTap != null)
              Padding(
                padding: const EdgeInsets.only(left: 16, right: 16, bottom: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton.icon(
                      icon: const Icon(Icons.payment, size: 16),
                      label: const Text('Payment'),
                      onPressed: onPaymentTap,
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
