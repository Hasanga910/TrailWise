class PricingBreakdown {
  final double baseCost;
  final double cateringCost;
  final double addOnCost;
  final double subtotal;
  final double discountAmount;
  final double finalTotal;
  final String? discountDescription;
  final double? discountPercentage;

  PricingBreakdown({
    required this.baseCost,
    required this.cateringCost,
    required this.addOnCost,
    required this.subtotal,
    required this.discountAmount,
    required this.finalTotal,
    this.discountDescription,
    this.discountPercentage,
  });

  factory PricingBreakdown.fromJson(Map<String, dynamic> json) {
    return PricingBreakdown(
      baseCost: (json['baseCost'] as num?)?.toDouble() ?? 0.0,
      cateringCost: (json['cateringCost'] as num?)?.toDouble() ?? 0.0,
      addOnCost: (json['addOnCost'] as num?)?.toDouble() ?? 0.0,
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0.0,
      discountAmount: (json['discountAmount'] as num?)?.toDouble() ?? 0.0,
      finalTotal: (json['finalTotal'] as num?)?.toDouble() ?? 0.0,
      discountDescription: json['discountDescription'] as String?,
      discountPercentage: (json['discountPercentage'] as num?)?.toDouble(),
    );
  }
}

class PaymentStatusDto {
  final String bookingId;
  final double totalCost;
  final double totalPaid;
  final double remainingAmount;
  final String status;
  final bool hasPendingVerification;
  final double? minimumAdvance;
  final String? latestRejectedPaymentReason;
  final DateTime? latestRejectedAt;
  final String? latestRejectedPaymentId;
  final DateTime? paymentDueAt;
  final bool isPaymentDeadlineExpired;
  final DateTime? balancePaymentDueAt;
  final bool isBalancePaymentDeadlineExpired;
  final String? bookingStatus;
  final PricingBreakdown? pricingBreakdown;

  PaymentStatusDto({
    required this.bookingId,
    required this.totalCost,
    required this.totalPaid,
    required this.remainingAmount,
    required this.status,
    this.hasPendingVerification = false,
    this.minimumAdvance,
    this.latestRejectedPaymentReason,
    this.latestRejectedAt,
    this.latestRejectedPaymentId,
    this.paymentDueAt,
    this.isPaymentDeadlineExpired = false,
    this.balancePaymentDueAt,
    this.isBalancePaymentDeadlineExpired = false,
    this.bookingStatus,
    this.pricingBreakdown,
  });

  factory PaymentStatusDto.fromJson(Map<String, dynamic> json) => PaymentStatusDto(
        bookingId: json['bookingId'] as String,
        totalCost: (json['totalCost'] as num).toDouble(),
        totalPaid: (json['totalPaid'] as num).toDouble(),
        remainingAmount: (json['remainingAmount'] as num).toDouble(),
        status: json['status'] as String,
        hasPendingVerification: json['hasPendingVerification'] as bool? ?? false,
        minimumAdvance: json['minimumAdvance'] != null
            ? (json['minimumAdvance'] as num).toDouble()
            : null,
        latestRejectedPaymentReason: json['latestRejectedPaymentReason'] as String?,
        latestRejectedAt: json['latestRejectedAt'] != null
            ? DateTime.tryParse(json['latestRejectedAt'].toString())
            : null,
        latestRejectedPaymentId: json['latestRejectedPaymentId'] as String?,
        paymentDueAt: json['paymentDueAt'] != null
            ? DateTime.tryParse(json['paymentDueAt'].toString())
            : null,
        isPaymentDeadlineExpired: json['isPaymentDeadlineExpired'] as bool? ?? false,
        balancePaymentDueAt: json['balancePaymentDueAt'] != null
            ? DateTime.tryParse(json['balancePaymentDueAt'].toString())
            : null,
        isBalancePaymentDeadlineExpired: json['isBalancePaymentDeadlineExpired'] as bool? ?? false,
        bookingStatus: json['bookingStatus'] as String?,
        pricingBreakdown: json['pricingBreakdown'] != null && json['pricingBreakdown'] is Map<String, dynamic>
            ? PricingBreakdown.fromJson(json['pricingBreakdown'] as Map<String, dynamic>)
            : null,
      );
}
