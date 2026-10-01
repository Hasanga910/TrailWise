import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../auth/current_user.dart';
import '../bookings/booking_request_screen.dart';
import '../models/package_tier.dart';
import '../models/tour_package.dart';
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
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.lock_outline, size: 56, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'Access Restricted',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Tour packages and booking creation are only available to Travelers.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  icon: const Icon(Icons.arrow_back),
                  label: const Text('Go Back'),
                  onPressed: () => Navigator.of(context).maybePop(),
                ),
              ],
            ),
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
    final packages = _packages!;
    if (packages.isEmpty) {
      return const Center(child: Text('No tour packages yet.'));
    }
    return Column(
      children: [
        Container(
          width: double.infinity,
          color: Colors.teal.shade50,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              Icon(Icons.discount_outlined, size: 16, color: Colors.teal.shade700),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Group discounts are available on all tours.',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Colors.teal.shade900,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: packages.length,
            itemBuilder: (_, i) => _PackageCard(
              package: packages[i],
              onRequestTier: _requestBooking,
              onReviewsTap: _openReviews,
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
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    package.name,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                Chip(label: Text(package.theme)),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              '${package.durationDays} ${package.durationDays == 1 ? 'day' : 'days'} · '
              'up to ${package.maxGroupSize} travelers',
              style: const TextStyle(color: Colors.grey),
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
                      const Icon(Icons.star, size: 16, color: Colors.amber),
                      const SizedBox(width: 4),
                      Text(
                        '★ ${package.averageRating.toStringAsFixed(1)} (${package.reviewCount} ${package.reviewCount == 1 ? 'review' : 'reviews'})',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF2E7D32),
                        ),
                      ),
                    ] else ...[
                      const Text(
                        'No reviews yet',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey,
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
                Text(tier.classType, style: const TextStyle(fontWeight: FontWeight.w600)),
                Row(
                  children: [
                    if (tier.includesFood) ...[
                      const Icon(Icons.restaurant, size: 14, color: Colors.grey),
                      const SizedBox(width: 4),
                    ],
                    if (tier.requiresAC) ...[
                      const Icon(Icons.ac_unit, size: 14, color: Colors.grey),
                      const SizedBox(width: 4),
                    ],
                    Text(
                      '\$${tier.basePricePerPerson.toStringAsFixed(2)}/person',
                      style: const TextStyle(color: Colors.grey),
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
