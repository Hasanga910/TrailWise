import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../config/bank_transfer_config.dart';
import '../models/booking.dart';
import '../models/payment_status.dart';
import 'booking_status.dart';

class SelectedSlipFile {
  final String name;
  final int size;
  final List<int> bytes;
  final String extension;

  const SelectedSlipFile({
    required this.name,
    required this.size,
    required this.bytes,
    required this.extension,
  });

  String get formattedSize {
    if (size < 1024) return '$size B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)} KB';
    return '${(size / (1024 * 1024)).toStringAsFixed(2)} MB';
  }

  String get fileTypeDisplay {
    final ext = extension.toLowerCase().replaceAll('.', '');
    switch (ext) {
      case 'pdf':
        return 'PDF Document';
      case 'png':
        return 'PNG Image';
      case 'jpg':
      case 'jpeg':
        return 'JPEG Image';
      case 'webp':
        return 'WEBP Image';
      default:
        return ext.isEmpty ? 'File' : '${ext.toUpperCase()} File';
    }
  }
}

typedef SlipPicker = Future<SelectedSlipFile?> Function();

Future<SelectedSlipFile?> defaultSlipPicker() async {
  final file = await FilePicker.pickFile(
    type: FileType.custom,
    allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  );
  if (file == null) return null;
  final bytes = await file.xFile.readAsBytes();
  return SelectedSlipFile(
    name: file.name,
    size: bytes.length,
    bytes: bytes,
    extension: file.extension ?? '',
  );
}

class PaymentStatusScreen extends StatefulWidget {
  const PaymentStatusScreen({
    super.key,
    required this.booking,
    this.apiClient,
    this.slipPicker = defaultSlipPicker,
    this.nowProvider,
  });

  final Booking booking;
  final ApiClient? apiClient;
  final SlipPicker slipPicker;
  final DateTime Function()? nowProvider;

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
  SelectedSlipFile? _selectedSlip;
  bool _submitting = false;
  String? _submitError;
  String? _amountError;
  String? _slipError;
  Timer? _countdownTimer;

  DateTime _currentNow() => widget.nowProvider?.call() ?? DateTime.now();

  @override
  void initState() {
    super.initState();
    _loadPaymentStatus();
  }

  @override
  void didUpdateWidget(PaymentStatusScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.booking.id != widget.booking.id ||
        oldWidget.booking.status != widget.booking.status) {
      _syncCountdownTimer();
    }
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _countdownTimer = null;
    _amountController.dispose();
    super.dispose();
  }

  String get _effectiveBookingStatus =>
      _paymentStatus?.bookingStatus ?? widget.booking.status;

  bool get _shouldShowAdvanceCountdown {
    final payment = _paymentStatus;
    if (payment == null) return false;
    if (_effectiveBookingStatus != BookingStatus.confirmed) return false;
    if (payment.paymentDueAt == null) return false;
    if (payment.isPaymentDeadlineExpired) return false;
    if (payment.status == 'DepositPaid' || payment.status == 'FullyPaid') return false;
    if (payment.hasPendingVerification || payment.status == 'Pending') return false;
    if (payment.totalPaid > 0) return false;

    final now = _currentNow().toUtc();
    final dueAt = payment.paymentDueAt!.toUtc();
    return dueAt.isAfter(now);
  }

  bool get _shouldShowBalanceCountdown {
    final payment = _paymentStatus;
    if (payment == null) return false;
    if (_effectiveBookingStatus != BookingStatus.completed) return false;
    if (payment.remainingAmount <= 0) return false;
    if (payment.status == 'FullyPaid') return false;
    if (payment.hasPendingVerification || payment.status == 'Pending') return false;
    if (payment.balancePaymentDueAt == null) return false;
    if (payment.isBalancePaymentDeadlineExpired) return false;

    final now = _currentNow().toUtc();
    final dueAt = payment.balancePaymentDueAt!.toUtc();
    return dueAt.isAfter(now);
  }

  bool get _shouldRunCountdownTimer => _shouldShowAdvanceCountdown || _shouldShowBalanceCountdown;

  void _syncCountdownTimer() {
    _countdownTimer?.cancel();
    _countdownTimer = null;

    if (!mounted || !_shouldRunCountdownTimer) {
      return;
    }

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      if (!_shouldRunCountdownTimer) {
        timer.cancel();
        _countdownTimer = null;
        if (mounted) {
          setState(() {});
          _loadPaymentStatus();
        }
        return;
      }

      setState(() {});
    });
  }

  Future<void> _loadPaymentStatus() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final json = await _apiClient.get('/api/bookings/${widget.booking.id}/payment-status');
      final status = PaymentStatusDto.fromJson(json as Map<String, dynamic>);
      if (!mounted) return;
      setState(() {
        _paymentStatus = status;
        _loading = false;
        if (status.remainingAmount > 0) {
          if (status.totalPaid == 0 && _effectiveBookingStatus == BookingStatus.confirmed) {
            final minAdvance = status.minimumAdvance ?? (status.totalCost * 0.5);
            _amountController.text = minAdvance.toStringAsFixed(2);
          } else {
            _amountController.text = status.remainingAmount.toStringAsFixed(2);
          }
        }
      });
      _syncCountdownTimer();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
      _syncCountdownTimer();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load payment status. Please try again.';
        _loading = false;
      });
      _syncCountdownTimer();
    }
  }

  Future<void> _pickSlip() async {
    try {
      final slip = await widget.slipPicker();
      if (slip != null) {
        setState(() {
          _selectedSlip = slip;
          _slipError = null;
        });
      }
    } catch (e) {
      setState(() {
        _slipError = 'Could not select file. Please try again.';
      });
    }
  }

  void _removeSlip() {
    setState(() {
      _selectedSlip = null;
      _slipError = null;
    });
  }

  Future<void> _submitPayment() async {
    if (_paymentStatus == null) return;

    final text = _amountController.text.trim();
    final amount = double.tryParse(text);

    setState(() {
      _amountError = null;
      _slipError = null;
      _submitError = null;
    });

    if (amount == null || amount <= 0) {
      setState(() {
        _amountError = 'Enter a valid amount greater than 0';
      });
      return;
    }

    final minAdvance = _paymentStatus!.minimumAdvance ?? (_paymentStatus!.totalCost * 0.5);

    if (_paymentStatus!.totalPaid == 0 && _effectiveBookingStatus == BookingStatus.confirmed) {
      if (amount < minAdvance) {
        setState(() {
          _amountError = 'Initial payment must be at least \$${minAdvance.toStringAsFixed(2)}.';
        });
        return;
      }
      if (amount > _paymentStatus!.totalCost) {
        setState(() {
          _amountError = 'Payment cannot exceed the total tour cost of \$${_paymentStatus!.totalCost.toStringAsFixed(2)}.';
        });
        return;
      }
    } else {
      if (amount > _paymentStatus!.remainingAmount) {
        setState(() {
          _amountError = 'Payment cannot exceed the remaining balance of \$${_paymentStatus!.remainingAmount.toStringAsFixed(2)}.';
        });
        return;
      }
    }

    if (_selectedSlip == null) {
      setState(() {
        _slipError = 'Please select a bank slip.';
      });
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      await _apiClient.postMultipart(
        '/api/bookings/${widget.booking.id}/payments/bank-transfer',
        fields: {
          'amount': amount.toStringAsFixed(2),
        },
        fileBytes: _selectedSlip!.bytes,
        filename: _selectedSlip!.name,
        fileFieldName: 'bankSlip',
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bank transfer submitted for verification.')),
      );

      setState(() {
        _submitting = false;
        _submitError = null;
        _selectedSlip = null;
      });

      await _loadPaymentStatus();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = 'Could not record payment. Please try again.';
      });
    }
  }

  Color _paymentStatusColor(String status, bool hasPendingVerification) {
    if (hasPendingVerification || status == 'Pending') {
      return Colors.orange;
    }
    switch (status) {
      case 'DepositPaid':
        return Colors.teal;
      case 'FullyPaid':
        return Colors.green;
      case 'Refunded':
        return Colors.red;
      case 'Failed':
        return Colors.redAccent;
      case 'Unpaid':
      default:
        return Colors.grey;
    }
  }

  String _paymentStatusLabel(String status, bool hasPendingVerification) {
    if (hasPendingVerification || status == 'Pending') {
      return 'Pending Verification';
    }
    switch (status) {
      case 'DepositPaid':
        return 'Deposit Paid';
      case 'FullyPaid':
        return 'Fully Paid';
      case 'Refunded':
        return 'Refunded';
      case 'Failed':
        return 'Failed';
      case 'Unpaid':
        return 'Unpaid';
      default:
        return status;
    }
  }

  String _formatDateTime(DateTime dt) {
    final date = '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
    final time = '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    return '$date $time';
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
    final bookingColor = BookingStatus.color(_effectiveBookingStatus);
    final statusColor = _paymentStatusColor(payment.status, payment.hasPendingVerification);
    final statusLabel = _paymentStatusLabel(payment.status, payment.hasPendingVerification);

    final progress = payment.totalCost > 0
        ? (payment.totalPaid / payment.totalCost).clamp(0.0, 1.0)
        : 0.0;

    final isConfirmed = _effectiveBookingStatus == BookingStatus.confirmed;
    final isCompleted = _effectiveBookingStatus == BookingStatus.completed;
    final isPayableLifecycle = isConfirmed || isCompleted;
    final isBookingCancelled = _effectiveBookingStatus == BookingStatus.cancelled;
    final isPendingVerification = payment.hasPendingVerification || payment.status == 'Pending';
    final isFullyPaid = !isPendingVerification && (payment.status == 'FullyPaid' || payment.remainingAmount <= 0);
    final minAdvance = payment.minimumAdvance ?? (payment.totalCost * 0.5);

    final isDeadlinePast = isConfirmed &&
        payment.paymentDueAt != null &&
        payment.totalPaid == 0 &&
        !isPendingVerification &&
        !payment.paymentDueAt!.toUtc().isAfter(_currentNow().toUtc());
    final isDeadlineExpired = isConfirmed && (payment.isPaymentDeadlineExpired || isDeadlinePast);
    final isExpiredOrCancelled = isBookingCancelled || isDeadlineExpired;

    final isBalanceDeadlinePast = isCompleted &&
        payment.balancePaymentDueAt != null &&
        payment.remainingAmount > 0 &&
        !isPendingVerification &&
        !payment.balancePaymentDueAt!.toUtc().isAfter(_currentNow().toUtc());
    final isBalanceDeadlineExpired = isCompleted && (payment.isBalancePaymentDeadlineExpired || isBalanceDeadlinePast);

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
                            label: Text(_effectiveBookingStatus, style: TextStyle(color: bookingColor, fontSize: 12)),
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

              // Cost Breakdown Card
              _buildCostBreakdownCard(payment.pricingBreakdown, payment.totalCost),

              // B. Payment Financial Summary Card
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
                          Flexible(
                            child: Chip(
                              label: Text(statusLabel, style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis),
                              backgroundColor: statusColor.withValues(alpha: 0.15),
                              visualDensity: VisualDensity.compact,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Expanded(child: Text('Total Tour Cost:')),
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
                          const Expanded(child: Text('Total Verified Paid:')),
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
                          const Expanded(child: Text('Remaining Balance:')),
                          Text(
                            '\$${isFullyPaid ? '0.00' : payment.remainingAmount.toStringAsFixed(2)}',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: isFullyPaid ? Colors.grey : Colors.orange.shade800,
                            ),
                          ),
                        ],
                      ),
                      if (payment.totalPaid == 0) ...[
                        const SizedBox(height: 8),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Expanded(child: Text('Minimum Advance:')),
                            Text(
                              '\$${minAdvance.toStringAsFixed(2)}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.blue.shade800,
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Payment Status:'),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              statusLabel,
                              textAlign: TextAlign.end,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontWeight: FontWeight.bold, color: statusColor),
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

              // C. Bank Account Information Section
              Card(
                margin: const EdgeInsets.only(bottom: 16),
                color: Colors.grey.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.account_balance, color: Colors.teal.shade700, size: 20),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Bank Transfer Details',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 20),
                      _buildBankDetailRow('Bank Name', BankTransferConfig.bankName),
                      const SizedBox(height: 6),
                      _buildBankDetailRow('Account Name', BankTransferConfig.accountName),
                      const SizedBox(height: 6),
                      _buildBankDetailRow('Account Number', BankTransferConfig.accountNumber),
                      const SizedBox(height: 6),
                      _buildBankDetailRow('Branch', BankTransferConfig.branch),
                      const SizedBox(height: 10),
                      Text(
                        'Please transfer the payment to the bank account above and upload the transfer receipt below for verification.',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontStyle: FontStyle.italic),
                      ),
                    ],
                  ),
                ),
              ),

              // D. Conditional States: Non-Confirmed vs Pending Verification vs FullyPaid vs Payment Form
              if (isExpiredOrCancelled)
                Card(
                  key: const Key('payment_deadline_expired_card'),
                  color: Colors.red.shade50,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.red.shade200),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.cancel_outlined, color: Colors.red.shade700, size: 24),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Payment deadline expired',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red.shade900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Your booking was cancelled because the advance payment was not submitted within 1 hour.',
                          style: TextStyle(fontSize: 14, color: Colors.red.shade800),
                        ),
                      ],
                    ),
                  ),
                )
              else if (isBalanceDeadlineExpired)
                Card(
                  key: const Key('completed_balance_deadline_expired_card'),
                  color: Colors.red.shade50,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.red.shade200),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.cancel_outlined, color: Colors.red.shade700, size: 24),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Final payment deadline expired',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red.shade900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Please contact TrailWise Support for assistance with the remaining balance.',
                          style: TextStyle(fontSize: 14, color: Colors.red.shade800),
                        ),
                      ],
                    ),
                  ),
                )
              else if (!isPayableLifecycle)
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
                            'Payments can only be made for confirmed or completed bookings.',
                            style: TextStyle(fontSize: 14),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else if (isPendingVerification)
                Card(
                  color: Colors.orange.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.hourglass_top, color: Colors.orange.shade800, size: 24),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Text(
                                'Payment verification pending',
                                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.orange),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          'Payment submitted before the deadline and awaiting verification.',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Your bank transfer slip has been submitted and is waiting for staff review.',
                          style: TextStyle(fontSize: 14),
                        ),
                        const SizedBox(height: 16),
                        OutlinedButton.icon(
                          onPressed: _loadPaymentStatus,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Refresh Status'),
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
                        Icon(Icons.check_circle_outline, color: Colors.green, size: 28),
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
              else ...[
                // Advance payment deadline countdown card (for unpaid initial payment with active deadline)
                if (_shouldShowAdvanceCountdown) ...[
                  () {
                    final remaining = payment.paymentDueAt!.toUtc().difference(_currentNow().toUtc());
                    final remainingSeconds = remaining.inSeconds > 0 ? remaining.inSeconds : 0;
                    final hours = (remainingSeconds ~/ 3600).toString().padLeft(2, '0');
                    final minutes = ((remainingSeconds % 3600) ~/ 60).toString().padLeft(2, '0');
                    final seconds = (remainingSeconds % 60).toString().padLeft(2, '0');
                    final countdownStr = '$hours:$minutes:$seconds';
                    final isUnder15Minutes = remainingSeconds < 15 * 60;

                    return Card(
                      key: const Key('advance_payment_deadline_card'),
                      margin: const EdgeInsets.only(bottom: 16),
                      color: isUnder15Minutes ? Colors.amber.shade50 : Colors.blue.shade50,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: isUnder15Minutes ? Colors.amber.shade400 : Colors.blue.shade200,
                          width: isUnder15Minutes ? 1.5 : 1,
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  isUnder15Minutes ? Icons.warning_amber_rounded : Icons.timer_outlined,
                                  color: isUnder15Minutes ? Colors.amber.shade900 : Colors.blue.shade800,
                                  size: 22,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Advance payment deadline',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: isUnder15Minutes ? Colors.amber.shade900 : Colors.blue.shade900,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Advance payment due in',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: isUnder15Minutes ? Colors.amber.shade900 : Colors.blue.shade900,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: isUnder15Minutes ? Colors.amber.shade100 : Colors.blue.shade100,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Advance payment due in $countdownStr',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      fontFamily: 'monospace',
                                      color: isUnder15Minutes ? Colors.amber.shade900 : Colors.blue.shade900,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Time remaining: $countdownStr',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isUnder15Minutes ? Colors.amber.shade900 : Colors.blue.shade900,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Submit your advance bank transfer before:\n${_formatDateTime(payment.paymentDueAt!.toLocal())}',
                              style: TextStyle(
                                fontSize: 13,
                                color: isUnder15Minutes ? Colors.amber.shade900 : Colors.blue.shade900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }(),
                ],
                if (_shouldShowBalanceCountdown) ...[
                  () {
                    final remaining = payment.balancePaymentDueAt!.toUtc().difference(_currentNow().toUtc());
                    final remainingSeconds = remaining.inSeconds > 0 ? remaining.inSeconds : 0;
                    final hours = (remainingSeconds ~/ 3600).toString().padLeft(2, '0');
                    final minutes = ((remainingSeconds % 3600) ~/ 60).toString().padLeft(2, '0');
                    final seconds = (remainingSeconds % 60).toString().padLeft(2, '0');
                    final countdownStr = '$hours:$minutes:$seconds';
                    final isUnder4Hours = remainingSeconds < 4 * 3600;

                    return Card(
                      key: const Key('balance_payment_deadline_card'),
                      margin: const EdgeInsets.only(bottom: 16),
                      color: isUnder4Hours ? Colors.amber.shade50 : Colors.blue.shade50,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: isUnder4Hours ? Colors.amber.shade400 : Colors.blue.shade200,
                          width: isUnder4Hours ? 1.5 : 1,
                        ),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  isUnder4Hours ? Icons.warning_amber_rounded : Icons.timer_outlined,
                                  color: isUnder4Hours ? Colors.amber.shade900 : Colors.blue.shade800,
                                  size: 22,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Final balance payment deadline',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: isUnder4Hours ? Colors.amber.shade900 : Colors.blue.shade900,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Final balance due in',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: isUnder4Hours ? Colors.amber.shade900 : Colors.blue.shade900,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: isUnder4Hours ? Colors.amber.shade100 : Colors.blue.shade100,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Final balance due in $countdownStr',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      fontFamily: 'monospace',
                                      color: isUnder4Hours ? Colors.amber.shade900 : Colors.blue.shade900,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Remaining balance due in $countdownStr',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: isUnder4Hours ? Colors.amber.shade900 : Colors.blue.shade900,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Submit your remaining balance before:\n${_formatDateTime(payment.balancePaymentDueAt!.toLocal())}',
                              style: TextStyle(
                                fontSize: 13,
                                color: isUnder4Hours ? Colors.amber.shade900 : Colors.blue.shade900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }(),
                ],
                if (payment.latestRejectedPaymentReason != null &&
                    !isPendingVerification &&
                    !isFullyPaid)
                  Card(
                    margin: const EdgeInsets.only(bottom: 16),
                    color: Colors.red.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.error_outline, color: Colors.red.shade700, size: 22),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Previous payment was rejected',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.red.shade900,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Reason: ${payment.latestRejectedPaymentReason}',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.red.shade800,
                            ),
                          ),
                          if (payment.latestRejectedAt != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Rejected on: ${_formatDateTime(payment.latestRejectedAt!)}',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade700,
                              ),
                            ),
                          ],
                          const SizedBox(height: 8),
                          Text(
                            'Please correct the issue and submit a new bank transfer slip.',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade800,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

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
                        const SizedBox(height: 12),

                        // Guidance Card for Deposit vs First Payment
                        if (payment.status == 'DepositPaid' || isCompleted)
                          Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.teal.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.teal.shade200),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.check_circle, color: Colors.teal.shade700, size: 20),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        isCompleted ? 'Balance payment' : 'Advance payment verified',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.teal),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        isCompleted
                                            ? 'The tour has completed. Please submit the remaining balance.'
                                            : 'Advance payment verified. You can now pay the remaining balance.',
                                        style: const TextStyle(fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.blue.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.blue.shade200),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.info, color: Colors.blue.shade700, size: 20),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'First Payment Rule',
                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.blue),
                                      ),
                                      const SizedBox(height: 2),
                                      const Text(
                                        'Your first payment must be at least 50% of the total tour cost.',
                                        style: TextStyle(fontSize: 12),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Minimum advance: \$${minAdvance.toStringAsFixed(2)}',
                                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),

                        // Method indicator: Bank Transfer ONLY
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.grey.shade300),
                          ),
                          child: const Row(
                            children: [
                              Icon(Icons.account_balance, size: 20, color: Colors.teal),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Payment Method: Bank Transfer',
                                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Amount field
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

                        // Bank Slip Picker
                        const Text(
                          'Bank Slip',
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                        ),
                        const SizedBox(height: 8),
                        if (_selectedSlip == null)
                          OutlinedButton.icon(
                            onPressed: _pickSlip,
                            icon: const Icon(Icons.upload_file),
                            label: const Text('Choose Bank Slip'),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.teal.shade300),
                              borderRadius: BorderRadius.circular(8),
                              color: Colors.teal.shade50.withValues(alpha: 0.3),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.receipt_long, color: Colors.teal),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            _selectedSlip!.name,
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            '${_selectedSlip!.fileTypeDisplay} · ${_selectedSlip!.formattedSize}',
                                            style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 4,
                                  children: [
                                    TextButton.icon(
                                      onPressed: _pickSlip,
                                      icon: const Icon(Icons.edit, size: 16),
                                      label: const Text('Change File'),
                                    ),
                                    TextButton.icon(
                                      key: const Key('remove_bank_slip_button'),
                                      onPressed: _removeSlip,
                                      icon: const Icon(Icons.delete_outline, size: 16),
                                      label: const Text('Remove'),
                                      style: TextButton.styleFrom(
                                        foregroundColor: Colors.red.shade700,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        if (_slipError != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Text(
                              _slipError!,
                              style: const TextStyle(color: Colors.red, fontSize: 12),
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            'Allowed formats: JPG, JPEG, PNG, WEBP, PDF (max 5MB)',
                            style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                          ),
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
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCostBreakdownCard(PricingBreakdown? breakdown, double totalCost) {
    if (breakdown == null) {
      return const SizedBox.shrink();
    }

    final hasDiscount = breakdown.discountAmount > 0;
    final discountLabel = hasDiscount
        ? (breakdown.discountPercentage != null && breakdown.discountPercentage! > 0
            ? 'Group Discount (${breakdown.discountPercentage!.toStringAsFixed(0)}%):'
            : 'Group Discount:')
        : 'Group Discount:';
    final discountFormatted = hasDiscount
        ? '-\$${breakdown.discountAmount.toStringAsFixed(2)}'
        : '\$0.00';

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Cost Breakdown',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            _buildBreakdownRow('Base Cost:', '\$${breakdown.baseCost.toStringAsFixed(2)}'),
            const SizedBox(height: 8),
            _buildBreakdownRow('Catering:', '\$${breakdown.cateringCost.toStringAsFixed(2)}'),
            const SizedBox(height: 8),
            _buildBreakdownRow('Add-ons:', '\$${breakdown.addOnCost.toStringAsFixed(2)}'),
            const Divider(height: 24),
            _buildBreakdownRow('Subtotal:', '\$${breakdown.subtotal.toStringAsFixed(2)}', isBold: true),
            const SizedBox(height: 8),
            _buildBreakdownRow(
              discountLabel,
              discountFormatted,
              valueColor: hasDiscount ? Colors.green.shade700 : null,
              isBold: hasDiscount,
            ),
            if (hasDiscount && breakdown.discountDescription != null && breakdown.discountDescription!.isNotEmpty) ...[
              const SizedBox(height: 2),
              Text(
                breakdown.discountDescription!,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontStyle: FontStyle.italic),
              ),
            ] else if (!hasDiscount) ...[
              const SizedBox(height: 2),
              Text(
                'No discount applied',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontStyle: FontStyle.italic),
              ),
            ],
            const Divider(height: 24),
            _buildBreakdownRow(
              'Final Total:',
              '\$${breakdown.finalTotal.toStringAsFixed(2)}',
              isBold: true,
              fontSize: 16,
              valueColor: Colors.teal.shade800,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBreakdownRow(
    String label,
    String value, {
    bool isBold = false,
    double fontSize = 14,
    Color? valueColor,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              fontSize: fontSize,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            color: valueColor,
          ),
        ),
      ],
    );
  }

  Widget _buildBankDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          ),
        ),
      ],
    );
  }
}
