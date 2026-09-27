class PaymentStatusDto {
  final String bookingId;
  final double totalCost;
  final double totalPaid;
  final double remainingAmount;
  final String status;

  PaymentStatusDto({
    required this.bookingId,
    required this.totalCost,
    required this.totalPaid,
    required this.remainingAmount,
    required this.status,
  });

  factory PaymentStatusDto.fromJson(Map<String, dynamic> json) => PaymentStatusDto(
        bookingId: json['bookingId'] as String,
        totalCost: (json['totalCost'] as num).toDouble(),
        totalPaid: (json['totalPaid'] as num).toDouble(),
        remainingAmount: (json['remainingAmount'] as num).toDouble(),
        status: json['status'] as String,
      );
}
