import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../auth/current_user.dart';
import '../models/active_discount.dart';
import '../models/package_tier.dart';
import '../models/tour_package.dart';

class BookingRequestScreen extends StatefulWidget {
  const BookingRequestScreen({
    super.key,
    required this.package,
    required this.tier,
    this.apiClient,
    this.currentUser,
  });

  final TourPackage package;
  final PackageTier tier;
  final ApiClient? apiClient;
  final CurrentUser? currentUser;

  @override
  State<BookingRequestScreen> createState() => _BookingRequestScreenState();
}

class _BookingRequestScreenState extends State<BookingRequestScreen> {
  late final ApiClient _apiClient = widget.apiClient ?? context.read<AuthProvider>().apiClient;

  final _groupSizeController = TextEditingController(text: '1');
  final _budgetController = TextEditingController();
  final _specialRequestsController = TextEditingController();

  List<ActiveDiscount> _activeDiscounts = [];
  bool _loadingDiscounts = true;

  @override
  void initState() {
    super.initState();
    _loadActiveDiscounts();
  }

  Future<void> _loadActiveDiscounts() async {
    try {
      final res = await _apiClient.get('/api/discounts/active');
      if (res is List && mounted) {
        setState(() {
          _activeDiscounts = res
              .map((e) => ActiveDiscount.fromJson(e as Map<String, dynamic>))
              .toList();
        });
      }
    } catch (_) {
      // ignore
    } finally {
      if (mounted) {
        setState(() {
          _loadingDiscounts = false;
        });
      }
    }
  }

  DateTime? _startDate;
  DateTime? _endDate;
  Map<String, String> _fieldErrors = {};
  String? _submitError;
  bool _submitting = false;

  @override
  void dispose() {
    _groupSizeController.dispose();
    _budgetController.dispose();
    _specialRequestsController.dispose();
    super.dispose();
  }

  String _formatDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  Future<void> _pickStartDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate ?? now,
      firstDate: now,
      lastDate: DateTime(now.year + 3),
    );
    if (picked != null) {
      setState(() {
        _startDate = picked;
        _fieldErrors.remove('startDate');
        if (_endDate != null && _endDate!.isBefore(picked)) {
          _endDate = null;
        }
      });
    }
  }

  Future<void> _pickEndDate() async {
    final now = DateTime.now();
    final firstDate = _startDate ?? now;
    final picked = await showDatePicker(
      context: context,
      initialDate: _endDate ?? firstDate,
      firstDate: firstDate,
      lastDate: DateTime(now.year + 3),
    );
    if (picked != null) {
      setState(() {
        _endDate = picked;
        _fieldErrors.remove('endDate');
      });
    }
  }

  Future<void> _submit() async {
    final errors = <String, String>{};
    final groupSize = int.tryParse(_groupSizeController.text);
    final budget = double.tryParse(_budgetController.text);

    if (groupSize == null || groupSize < 1) {
      errors['groupSize'] = 'Enter a valid group size';
    }
    if (_startDate == null) {
      errors['startDate'] = 'Start date is required';
    }
    if (_endDate == null) {
      errors['endDate'] = 'End date is required';
    }
    if (budget == null || budget <= 0) {
      errors['budgetPerPerson'] = 'Enter a valid budget';
    }

    if (errors.isNotEmpty) {
      setState(() => _fieldErrors = errors);
      return;
    }

    setState(() {
      _fieldErrors = {};
      _submitError = null;
      _submitting = true;
    });

    try {
      final specialRequests = _specialRequestsController.text.trim();
      await _apiClient.post('/api/bookings', {
        'packageTierId': widget.tier.id,
        'groupSize': groupSize,
        'startDate': _formatDate(_startDate!),
        'endDate': _formatDate(_endDate!),
        'budgetPerPerson': budget,
        'specialRequests': specialRequests.isEmpty ? null : specialRequests,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Booking request submitted.')));
      Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() {
        _submitting = false;
        if (e.fieldErrors.isNotEmpty) {
          _fieldErrors = {for (final fe in e.fieldErrors) fe.field: fe.message};
        } else {
          _submitError = e.message;
        }
      });
    } catch (_) {
      setState(() {
        _submitting = false;
        _submitError = 'Could not reach the server. Please try again.';
      });
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
        appBar: AppBar(title: const Text('Request a Booking')),
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
                  'Only travelers can request tour bookings.',
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
      appBar: AppBar(title: const Text('Request a Booking')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  widget.package.name,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                Text(
                  '${widget.tier.classType} · \$${widget.tier.basePricePerPerson.toStringAsFixed(2)}/person',
                  style: const TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 24),
                InkWell(
                  onTap: _pickStartDate,
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'Start date',
                      errorText: _fieldErrors['startDate'],
                    ),
                    child: Text(_startDate == null ? 'Select date' : _formatDate(_startDate!)),
                  ),
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: _pickEndDate,
                  child: InputDecorator(
                    decoration: InputDecoration(
                      labelText: 'End date',
                      errorText: _fieldErrors['endDate'],
                    ),
                    child: Text(_endDate == null ? 'Select date' : _formatDate(_endDate!)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _groupSizeController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: 'Group size',
                    errorText: _fieldErrors['groupSize'],
                  ),
                ),
                const SizedBox(height: 8),
                _buildAvailableDiscountsSection(),
                const SizedBox(height: 12),
                TextField(
                  controller: _budgetController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: 'Budget per person',
                    errorText: _fieldErrors['budgetPerPerson'],
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _specialRequestsController,
                  maxLines: 3,
                  maxLength: 1000,
                  decoration: const InputDecoration(
                    labelText: 'Special requests (optional)',
                    helperText: 'This note is processed by an AI service to help plan your trip. '
                        'Avoid including sensitive personal or payment details.',
                    helperMaxLines: 3,
                  ),
                ),
                const SizedBox(height: 16),
                if (_submitError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_submitError!, style: const TextStyle(color: Colors.red)),
                  ),
                FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Submit request'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAvailableDiscountsSection() {
    if (_loadingDiscounts) {
      return const SizedBox(
        height: 24,
        child: Center(child: SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))),
      );
    }

    if (_activeDiscounts.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.teal.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.teal.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_offer, size: 16, color: Colors.teal.shade700),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Available Group Discounts',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: Colors.teal.shade900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ..._activeDiscounts.map((discount) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.teal.shade100,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    '${discount.percentageOff.toStringAsFixed(0)}% off',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: Colors.teal.shade900,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Groups of ${discount.minGroupSize} or more',
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                      ),
                      Text(
                        discount.formattedValidity,
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )),
          const SizedBox(height: 4),
          Text(
            'Eligible discounts are applied automatically during pricing.',
            style: TextStyle(
              fontSize: 11,
              fontStyle: FontStyle.italic,
              color: Colors.grey.shade700,
            ),
          ),
        ],
      ),
    );
  }
}
