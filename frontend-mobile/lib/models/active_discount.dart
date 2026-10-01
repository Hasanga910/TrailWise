class ActiveDiscount {
  final String id;
  final String description;
  final double percentageOff;
  final int minGroupSize;
  final DateTime? validFrom;
  final DateTime? validUntil;

  ActiveDiscount({
    required this.id,
    required this.description,
    required this.percentageOff,
    required this.minGroupSize,
    this.validFrom,
    this.validUntil,
  });

  factory ActiveDiscount.fromJson(Map<String, dynamic> json) {
    return ActiveDiscount(
      id: json['id'] as String,
      description: json['description'] as String,
      percentageOff: (json['percentageOff'] as num).toDouble(),
      minGroupSize: json['minGroupSize'] as int,
      validFrom: json['validFrom'] != null
          ? DateTime.tryParse(json['validFrom'].toString())
          : null,
      validUntil: json['validUntil'] != null
          ? DateTime.tryParse(json['validUntil'].toString())
          : null,
    );
  }

  String get formattedValidity {
    if (validFrom == null && validUntil == null) {
      return 'Always available';
    }
    if (validFrom != null && validUntil == null) {
      return 'Available from ${_formatDate(validFrom!)}';
    }
    if (validFrom == null && validUntil != null) {
      return 'Valid until ${_formatDate(validUntil!)}';
    }
    return '${_formatDate(validFrom!)} - ${_formatDate(validUntil!)}';
  }

  static String _formatDate(DateTime dt) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }
}
