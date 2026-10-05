import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../auth/current_user.dart';
import '../models/booking.dart';
import '../models/paged_result.dart';
import 'booking_status.dart';
import 'itinerary_screen.dart';
import 'payment_status_screen.dart';
import 'review_screen.dart';
import '../support/create_support_ticket_screen.dart';
import '../theme/app_theme.dart';
import '../widgets/widgets.dart';

class MyBookingsScreen extends StatefulWidget {
  const MyBookingsScreen({super.key, this.apiClient, this.currentUser});

  final ApiClient? apiClient;
  final CurrentUser? currentUser;

  @override
  State<MyBookingsScreen> createState() => _MyBookingsScreenState();
}

class _MyBookingsScreenState extends State<MyBookingsScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  CurrentUser? _getUser() {
    if (widget.currentUser != null) return widget.currentUser;
    try {
      return context.read<AuthProvider>().user;
    } catch (_) {
      return null;
    }
  }

  static const _pageSize = 10;

  static const _cancellableStatuses = [
    BookingStatus.requested,
    BookingStatus.planProposed,
    BookingStatus.pendingApproval,
    BookingStatus.needsManualReview,
    BookingStatus.confirmed,
  ];

  static const sortOptions = [
    'Latest to Oldest',
    'Oldest to Latest',
    'Trip Date: Soonest',
    'Trip Date: Latest',
    'Status',
  ];

  String? _statusFilter;
  String _sortOption = 'Latest to Oldest';
  DateTime? _from;
  DateTime? _to;
  int _page = 1;

  PagedResult<Booking>? _result;
  bool _loading = true;
  bool _isFetching = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _formatDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _load() async {
    if (_isFetching) return;
    _isFetching = true;

    final user = _getUser();
    if (user != null && user.role == 'TourGuide') {
      if (mounted) setState(() => _loading = false);
      _isFetching = false;
      return;
    }

    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final sortParams = _getSortParams();
      final json = await _apiClient.get(
        '/api/bookings/mine',
        query: {
          'status': _statusFilter,
          'from': _from == null ? null : _formatDate(_from!),
          'to': _to == null ? null : _formatDate(_to!),
          'sortBy': sortParams.$1,
          'sortDirection': sortParams.$2,
          'page': _page,
          'pageSize': _pageSize,
        },
      );
      if (!mounted) return;
      setState(() {
        _result = PagedResult<Booking>.fromJson(
          json as Map<String, dynamic>,
          Booking.fromJson,
        );
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
        _error = 'Could not reach the server. Please try again.';
        _loading = false;
      });
    } finally {
      _isFetching = false;
    }
  }

  (String, String) _getSortParams() {
    switch (_sortOption) {
      case 'Oldest to Latest':
        return ('createdAt', 'asc');
      case 'Trip Date: Soonest':
        return ('startDate', 'asc');
      case 'Trip Date: Latest':
        return ('startDate', 'desc');
      case 'Status':
        return ('status', 'asc');
      case 'Latest to Oldest':
      default:
        return ('createdAt', 'desc');
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
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            ItineraryScreen(booking: booking, apiClient: _apiClient),
      ),
    );
  }

  Future<void> _openPayment(Booking booking) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            PaymentStatusScreen(booking: booking, apiClient: _apiClient),
      ),
    );

    if (mounted) {
      await _load();
    }
  }

  Future<void> _openReview(Booking booking) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ReviewScreen(booking: booking, apiClient: _apiClient),
      ),
    );
    if (mounted) {
      _load();
    }
  }

  Future<void> _openSupport(Booking booking) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CreateSupportTicketScreen(
          apiClient: _apiClient,
          preselectedBookingId: booking.id,
        ),
      ),
    );
  }

  bool _isUpcoming(Booking booking) {
    final today = _formatDate(DateTime.now());
    return booking.startDate.compareTo(today) >= 0;
  }

  bool _isCancellable(Booking booking) =>
      _cancellableStatuses.contains(booking.status) &&
      _isUpcoming(booking) &&
      booking.tourStartedAt == null &&
      booking.tourEndedAt == null;

  Future<void> _cancelBooking(Booking booking) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel booking'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Are you sure you want to cancel this booking?'),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(labelText: 'Reason (optional)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Back'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Confirm cancellation'),
          ),
        ],
      ),
    );

    if (confirmed != true) {
      return;
    }

    try {
      await _apiClient.patch('/api/bookings/${booking.id}/cancel', {
        'reason': reasonController.text.trim().isEmpty
            ? null
            : reasonController.text.trim(),
      });
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not reach the server. Please try again.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    CurrentUser? user = widget.currentUser;
    if (user == null) {
      try {
        user = context.watch<AuthProvider>().user;
      } catch (_) {
        user = null;
      }
    }

    if (user != null && user.role == 'TourGuide') {
      return Scaffold(
        appBar: AppBar(title: const Text('My Bookings')),
        body: EmptyState(
          icon: Icons.lock_outline,
          title: 'Access Restricted',
          message: 'Personal bookings are only available to Travelers. Please use Assigned Tours to view your tours.',
          action: FilledButton.icon(
            icon: const Icon(Icons.arrow_back),
            label: const Text('Go Back'),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Bookings'),
        actions: [
          IconButton(
            key: const Key('my_bookings_refresh_button'),
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
          ),
        ],
      ),
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
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String?>(
                  key: const Key('status_filter_dropdown'),
                  isExpanded: true,
                  initialValue: _statusFilter,
                  decoration: const InputDecoration(
                    labelText: 'Status',
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    isDense: true,
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text('All'),
                    ),
                    ...BookingStatus.filterOptions.map(
                      (s) =>
                          DropdownMenuItem<String?>(value: s, child: Text(s)),
                    ),
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
              Expanded(
                child: DropdownButtonFormField<String>(
                  key: const Key('sort_filter_dropdown'),
                  isExpanded: true,
                  initialValue: _sortOption,
                  decoration: const InputDecoration(
                    labelText: 'Sort',
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    isDense: true,
                  ),
                  items: sortOptions
                      .map(
                        (opt) => DropdownMenuItem(
                          value: opt,
                          child: Text(opt, overflow: TextOverflow.ellipsis),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value != null && value != _sortOption) {
                      setState(() {
                        _sortOption = value;
                        _page = 1;
                      });
                      _load();
                    }
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AppSpacing.sm,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.date_range, size: 20),
                    tooltip: _from == null ? 'From date' : _formatDate(_from!),
                    visualDensity: VisualDensity.compact,
                    onPressed: _pickFrom,
                  ),
                  Text(
                    _from == null
                        ? 'From: Any'
                        : 'From: ${_formatDate(_from!)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: const Icon(Icons.date_range_outlined, size: 20),
                    tooltip: _to == null ? 'To date' : _formatDate(_to!),
                    visualDensity: VisualDensity.compact,
                    onPressed: _pickTo,
                  ),
                  Text(
                    _to == null ? 'To: Any' : 'To: ${_formatDate(_to!)}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              if (_from != null || _to != null)
                IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  tooltip: 'Clear dates',
                  visualDensity: VisualDensity.compact,
                  onPressed: () {
                    setState(() {
                      _from = null;
                      _to = null;
                      _page = 1;
                    });
                    _load();
                  },
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const SkeletonList(count: 3, height: 140);
    }
    if (_error != null) {
      return ErrorState(message: _error!, onRetry: _load);
    }
    final result = _result!;
    if (result.items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: const EmptyState(
          icon: Icons.event_note_outlined,
          title: 'No bookings match your filters.',
          message: 'Try changing the filters or request a new booking from Packages.',
        ),
      );
    }
    final totalPages = (result.totalCount / result.pageSize).ceil().clamp(
      1,
      1 << 30,
    );
    final isFirstPage = _page <= 1;
    final isLastPage = _page * result.pageSize >= result.totalCount;
    final items = result.items;

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: AppSpacing.page,
              itemCount: items.length,
              itemBuilder: (_, i) => _BookingCard(
                booking: items[i],
                onTap: () => _openBooking(items[i]),
                onPaymentTap: () => _openPayment(items[i]),
                onReviewTap: () => _openReview(items[i]),
                onCancelTap: _isCancellable(items[i])
                    ? () => _cancelBooking(items[i])
                    : null,
                onSupportTap: () => _openSupport(items[i]),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.sm,
          ),
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
              Flexible(
                child: Text(
                  'Page $_page of $totalPages',
                  overflow: TextOverflow.ellipsis,
                ),
              ),
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
    this.onReviewTap,
    this.onCancelTap,
    this.onSupportTap,
  });

  final Booking booking;
  final VoidCallback onTap;
  final VoidCallback? onPaymentTap;
  final VoidCallback? onReviewTap;
  final VoidCallback? onCancelTap;
  final VoidCallback? onSupportTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isConfirmed = booking.status == BookingStatus.confirmed;
    final isCompleted = booking.status == BookingStatus.completed;

    final shouldShowPayment =
        isConfirmed ||
        (isCompleted &&
            (!booking.isFullyPaid ||
                booking.hasPendingPayment ||
                (booking.remainingAmount != null &&
                    booking.remainingAmount! > 0)));

    final paymentLabel = booking.hasPendingPayment
        ? 'Payment Status'
        : (booking.isFullyPaid ? 'Payment Status' : 'Payment');

    final shouldShowReview = isCompleted && booking.isFullyPaid;

    final text = Theme.of(context).textTheme;
    final guide = booking.assignedGuide;
    final travelers =
        '${booking.groupSize} ${booking.groupSize == 1 ? 'traveler' : 'travelers'}';

    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${booking.tourPackageName} — ${booking.packageTier.classType}',
                    style: text.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.xs,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      StatusBadge(status: booking.status),
                      if (booking.isLargeGroup)
                        Text(
                          'Large group',
                          style: TextStyle(fontSize: 11, color: colors.fgMuted),
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  IconLine(
                    icon: Icons.calendar_today_outlined,
                    label: '${booking.startDate} to ${booking.endDate}',
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Wrap(
                    spacing: AppSpacing.lg,
                    runSpacing: AppSpacing.xs,
                    children: [
                      IconLine(icon: Icons.groups_outlined, label: travelers),
                      IconLine(
                        icon: Icons.payments_outlined,
                        label:
                            '\$${booking.budgetPerPerson.toStringAsFixed(2)}/person',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Divider(height: 1, color: colors.border),
          if (booking.status != BookingStatus.cancelled)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.md,
                AppSpacing.lg,
                0,
              ),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: colors.surfaceSunken,
                  borderRadius: BorderRadius.circular(AppRadius.input),
                  border: Border.all(color: colors.border),
                ),
                child: Row(
                  children: [
                    Icon(
                      guide != null
                          ? Icons.person_pin_circle
                          : Icons.person_search,
                      size: 16,
                      color: guide != null ? colors.brandText : colors.warning,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        guide != null
                            ? 'Tour Guide: ${guide.name}'
                            : 'Tour Guide not assigned yet',
                        style: TextStyle(
                          fontSize: 12,
                          color: guide != null
                              ? colors.brandText
                              : colors.warning,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: SizedBox(
              width: double.infinity,
              child: Wrap(
                alignment: WrapAlignment.end,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (onSupportTap != null)
                    TextButton.icon(
                      icon: const Icon(Icons.help_outline, size: 16),
                      label: const Text('Get Support'),
                      onPressed: onSupportTap,
                    ),
                  if (shouldShowPayment && onPaymentTap != null)
                    OutlinedButton.icon(
                      icon: const Icon(Icons.payment, size: 16),
                      label: Text(paymentLabel),
                      onPressed: onPaymentTap,
                    ),
                  if (shouldShowReview) ...[
                    if (booking.hasReview)
                      OutlinedButton.icon(
                        icon: const Icon(Icons.check_circle_outline, size: 16),
                        label: const Text('Reviewed'),
                        onPressed: null,
                      )
                    else if (onReviewTap != null)
                      OutlinedButton.icon(
                        icon: const Icon(Icons.rate_review_outlined, size: 16),
                        label: const Text('Review'),
                        onPressed: onReviewTap,
                      ),
                  ],
                  if (onCancelTap != null)
                    OutlinedButton.icon(
                      icon: const Icon(Icons.cancel_outlined, size: 16),
                      label: const Text('Cancel Booking'),
                      onPressed: onCancelTap,
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
