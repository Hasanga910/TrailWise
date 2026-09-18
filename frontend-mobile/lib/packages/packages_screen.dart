import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../bookings/booking_request_screen.dart';
import '../models/package_tier.dart';
import '../models/tour_package.dart';

class PackagesScreen extends StatefulWidget {
  const PackagesScreen({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  State<PackagesScreen> createState() => _PackagesScreenState();
}

class _PackagesScreenState extends State<PackagesScreen> {
  late final ApiClient _apiClient = widget.apiClient ?? context.read<AuthProvider>().apiClient;

  List<TourPackage>? _packages;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
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

  @override
  Widget build(BuildContext context) {
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
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: packages.length,
      itemBuilder: (_, i) => _PackageCard(package: packages[i], onRequestTier: _requestBooking),
    );
  }
}

class _PackageCard extends StatelessWidget {
  const _PackageCard({required this.package, required this.onRequestTier});

  final TourPackage package;
  final void Function(TourPackage package, PackageTier tier) onRequestTier;

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
