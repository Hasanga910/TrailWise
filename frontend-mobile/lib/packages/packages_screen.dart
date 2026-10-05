import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../auth/current_user.dart';
import '../bookings/booking_request_screen.dart';
import '../models/package_tier.dart';
import '../models/tour_package.dart';
import '../theme/app_theme.dart';
import '../widgets/widgets.dart';
import 'package_reviews_sheet.dart';

class PackagesScreen extends StatefulWidget {
  const PackagesScreen({super.key, this.apiClient, this.currentUser});

  final ApiClient? apiClient;
  final CurrentUser? currentUser;

  @override
  State<PackagesScreen> createState() => _PackagesScreenState();
}

class _PackagesScreenState extends State<PackagesScreen> {
  late final ApiClient _apiClient = widget.apiClient ?? context.read<AuthProvider>().apiClient;

  List<TourPackage>? _packages;
  String? _error;
  bool _loading = true;

  CurrentUser? _getUser() {
    if (widget.currentUser != null) return widget.currentUser;
    try {
      return context.read<AuthProvider>().user;
    } catch (_) {
      return null;
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final user = _getUser();
    if (user != null && user.role == 'TourGuide') {
      setState(() => _loading = false);
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await _apiClient.get('/api/packages');
      final packages = (response as List)
          .map((p) => TourPackage.fromJson(p as Map<String, dynamic>))
          .toList();
      setState(() {
        _packages = packages;
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

  void _requestBooking(TourPackage package, PackageTier tier) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => BookingRequestScreen(package: package, tier: tier)),
    );
  }

  void _openReviews(TourPackage package) {
    showPackageReviewsBottomSheet(
      context: context,
      packageId: package.id,
      packageName: package.name,
      apiClient: _apiClient,
    );
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
        appBar: AppBar(title: const Text('Tour Packages')),
        body: EmptyState(
          icon: Icons.lock_outline,
          title: 'Access Restricted',
          message: 'Tour packages and booking creation are only available to Travelers.',
          action: FilledButton.icon(
            icon: const Icon(Icons.arrow_back),
            label: const Text('Go Back'),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Tour Packages')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const SkeletonList(count: 3, height: 200);
    }
    if (_error != null) {
      return ErrorState(message: _error!, onRetry: _load);
    }
    final packages = _packages!;
    if (packages.isEmpty) {
      return const EmptyState(
        icon: Icons.card_travel_outlined,
        title: 'No tour packages yet.',
        message: 'New tours will show up here.',
      );
    }
    final colors = AppColors.of(context);
    return Column(
      children: [
        Container(
          width: double.infinity,
          color: colors.brandSoft,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
          child: Row(
            children: [
              Icon(Icons.discount_outlined, size: 16, color: colors.brandText),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Group discounts are available on all tours.',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: colors.brandFg,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView.builder(
              padding: AppSpacing.page,
              itemCount: packages.length,
              itemBuilder: (_, i) => _PackageCard(
                package: packages[i],
                onRequestTier: _requestBooking,
                onReviewsTap: _openReviews,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PackageCard extends StatelessWidget {
  const _PackageCard({
    required this.package,
    required this.onRequestTier,
    required this.onReviewsTap,
  });

  final TourPackage package;
  final void Function(TourPackage package, PackageTier tier) onRequestTier;
  final void Function(TourPackage package) onReviewsTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final text = Theme.of(context).textTheme;
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.lg),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    package.name,
                    style: text.titleLarge,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Flexible(child: Chip(label: Text(package.theme, overflow: TextOverflow.ellipsis))),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${package.durationDays} ${package.durationDays == 1 ? 'day' : 'days'} · '
              'up to ${package.maxGroupSize} travelers',
              style: text.bodySmall,
            ),
            const SizedBox(height: 6),
            InkWell(
              onTap: () => onReviewsTap(package),
              borderRadius: BorderRadius.circular(4),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (package.reviewCount > 0) ...[
                      const Icon(Icons.star, size: 16, color: Brand.accent500),
                      const SizedBox(width: 4),
                      Flexible(child: Text(
                        '★ ${package.averageRating.toStringAsFixed(1)} (${package.reviewCount} ${package.reviewCount == 1 ? 'review' : 'reviews'})',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colors.success,
                        ),
                      )),
                    ] else ...[
                      Text(
                        'No reviews yet',
                        style: TextStyle(
                          fontSize: 13,
                          color: colors.fgMuted,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (package.locations.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: package.locations
                    .map((l) => Chip(
                          label: Text(l.name, style: const TextStyle(fontSize: 12)),
                          visualDensity: VisualDensity.compact,
                        ))
                    .toList(),
              ),
            ],
            const SizedBox(height: 12),
            const Divider(height: 1),
            ...package.tiers.map((tier) => _TierRow(
                  tier: tier,
                  onRequest: () => onRequestTier(package, tier),
                )),
          ],
        ),
      ),
    );
  }
}

class _TierRow extends StatelessWidget {
  const _TierRow({required this.tier, required this.onRequest});

  final PackageTier tier;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tier.classType,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                Row(
                  children: [
                    if (tier.includesFood) ...[
                      Icon(Icons.restaurant, size: 14, color: AppColors.of(context).fgMuted),
                      const SizedBox(width: 4),
                    ],
                    if (tier.requiresAC) ...[
                      Icon(Icons.ac_unit, size: 14, color: AppColors.of(context).fgMuted),
                      const SizedBox(width: 4),
                    ],
                    Flexible(
                      child: Text(
                        '\$${tier.basePricePerPerson.toStringAsFixed(2)}/person',
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          TextButton(onPressed: onRequest, child: const Text('Request')),
        ],
      ),
    );
  }
}
