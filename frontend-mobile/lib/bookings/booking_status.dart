import 'package:flutter/material.dart';

class BookingStatus {
  static const requested = 'Requested';
  static const planProposed = 'PlanProposed';
  static const pendingApproval = 'PendingApproval';
  static const confirmed = 'Confirmed';
  static const completed = 'Completed';
  static const cancelled = 'Cancelled';
  static const needsManualReview = 'NeedsManualReview';

  static const List<String> all = [
    requested,
    planProposed,
    pendingApproval,
    confirmed,
    completed,
    cancelled,
    needsManualReview,
  ];

  static Color color(String status) {
    switch (status) {
      case requested:
        return Colors.grey;
      case planProposed:
        return Colors.deepPurple;
      case pendingApproval:
        return Colors.orange;
      case confirmed:
        return Colors.teal;
      case completed:
        return Colors.green;
      case cancelled:
        return Colors.red;
      case needsManualReview:
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}
