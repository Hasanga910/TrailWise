import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/booking.dart';
import '../models/payment_status.dart';
import 'booking_status.dart';

class PaymentStatusScreen extends StatefulWidget {
  const PaymentStatusScreen({
    super.key,
    required this.booking,
    this.apiClient,
  });

  final Booking booking;
  final ApiClient? apiClient;

  @override
  State<PaymentStatusScreen> createState() => _PaymentStatusScreenState();
}

class _PaymentStatusScreenState extends State<PaymentStatusScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  PaymentStatusDto? _paymentStatus;
  bool _loading = true;
  String? _error;

  final _amountController = TextEditingController();
  String _selectedMethod = 'Card';
  bool _submitting = false;
  String? _submitError;
  String? _amountError;

  @override
  void initState() {
    super.initState();
    _loadPaymentStatus();
  }

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _loadPaymentStatus() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final json = await _apiClient.get('/api/bookings/${widget.booking.id}/payment-status');
      final status = PaymentStatusDto.fromJson(json as Map<String, dynamic>);
      setState(() {
        _paymentStatus = status;
        _loading = false;
        if (status.remainingAmount > 0) {
          _amountController.text = status.remainingAmount.toStringAsFixed(2);
        }
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'Could not load payment status. Please try again.';
        _loading = false;
      });
    }
  }

  Future<void> _submitPayment() async {
    final text = _amountController.text.trim();
    final amount = double.tryParse(text);

    if (amount == null || amount <= 0) {
      setState(() {
        _amountError = 'Enter a valid amount greater than 0';
      });
      return;
    }

    setState(() {
      _amountError = null;
      _submitError = null;
      _submitting = true;
    });

    try {
      await _apiClient.post('/api/payments', {
        'bookingId': widget.booking.id,
        'amount': amount,
        'method': _selectedMethod,
      });

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment recorded successfully.')),
      );

      setState(() {
        _submitting = false;
        _submitError = null;
      });

      await _loadPaymentStatus();
    } on ApiException catch (e) {
      setState(() {
        _submitting = false;
        _submitError = e.message;
      });
    } catch (_) {
      setState(() {
        _submitting = false;
        _submitError = 'Could not record payment. Please try again.';
      });
    }
  }

  Color _paymentStatusColor(String status) {
    switch (status) {
      case 'Pending':
        return Colors.orange;
      case 'DepositPaid':
        return Colors.teal;
      case 'FullyPaid':
        return Colors.green;
      case 'Refunded':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Payment Status')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
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
              Text(_error!, style: const TextStyle(color: Colors.red), textAlign: TextAlign.center),
              const SizedBox(height: 12),
              FilledButton(onPressed: _loadPaymentStatus, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final payment = _paymentStatus!;
    final booking = widget.booking;
    final bookingColor = BookingStatus.color(booking.status);
    final paymentColor = _paymentStatusColor(payment.status);

    final progress = payment.totalCost > 0
        ? (payment.totalPaid / payment.totalCost).clamp(0.0, 1.0)
        : 0.0;

    final isConfirmed = booking.status == BookingStatus.confirmed;
    final isFullyPaid = payment.status == 'FullyPaid' || payment.remainingAmount <= 0;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 480),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // A. Booking Summary Card
              Card(
                margin: const EdgeInsets.only(bottom: 16),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              booking.tourPackageName,
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                          ),
                          Chip(
                            label: Text(booking.status, style: TextStyle(color: bookingColor, fontSize: 12)),
                            backgroundColor: bookingColor.withValues(alpha: 0.15),
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${booking.packageTier.classType} Class · ${booking.startDate} to ${booking.endDate}',
                        style: TextStyle(color: Colors.grey.shade700, fontSize: 14),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${booking.groupSize} ${booking.groupSize == 1 ? 'traveler' : 'travelers'}',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),

              // B. Payment Summary Card
              Card(
                margin: const EdgeInsets.only(bottom: 16),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Expanded(
                            child: Text(
                              'Financial Summary',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Chip(
                            label: Text(payment.status, style: TextStyle(color: paymentColor, fontSize: 12)),
                            backgroundColor: paymentColor.withValues(alpha: 0.15),
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Expanded(child: Text('Total Cost:')),
                          Text(
                            '\$${payment.totalCost.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Expanded(child: Text('Total Paid:')),
                          Text(
                            '\$${payment.totalPaid.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Expanded(child: Text('Remaining Amount:')),
                          Text(
                            '\$${isFullyPaid ? '0.00' : payment.remainingAmount.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: isFullyPaid ? Colors.grey : Colors.orange.shade800,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: progress,
                          minHeight: 8,
                          color: Colors.teal,
                          backgroundColor: Colors.grey.shade200,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          '${(progress * 100).toStringAsFixed(0)}% paid',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // C. Conditional State: Non-Confirmed vs FullyPaid vs Payment Form
              if (!isConfirmed)
                Card(
                  color: Colors.amber.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: Colors.amber.shade800),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Payments can only be made for confirmed bookings.',
                            style: TextStyle(fontSize: 14),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else if (isFullyPaid)
                Card(
                  color: Colors.green.shade50,
                  child: const Padding(
                    padding: EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(Icons.check_circle_outline, color: Colors.green),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Booking is fully paid.',
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.green),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                // Payment Form
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Make a Payment',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _amountController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: InputDecoration(
                            labelText: 'Amount',
                            prefixText: '\$ ',
                            errorText: _amountError,
                          ),
                        ),
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String>(
                          initialValue: _selectedMethod,
                          decoration: const InputDecoration(labelText: 'Payment Method'),
                          items: const [
                            DropdownMenuItem(value: 'Card', child: Text('Card')),
                            DropdownMenuItem(value: 'BankTransfer', child: Text('Bank Transfer')),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() => _selectedMethod = val);
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        if (_submitError != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Text(
                              _submitError!,
                              style: const TextStyle(color: Colors.red),
                            ),
                          ),
                        FilledButton(
                          onPressed: _submitting ? null : _submitPayment,
                          child: _submitting
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('Submit Payment'),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
