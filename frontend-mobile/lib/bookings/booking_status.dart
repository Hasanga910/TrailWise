import 'package:flutter/material.dart';

import '../widgets/status_badge.dart';

class BookingStatus {
  static const requested = 'Requested';
  static const planProposed = 'PlanProposed';
  static const pendingApproval = 'PendingApproval';
  static const confirmed = 'Confirmed';
  static const completed = 'Completed';
  static const cancelled = 'Cancelled';
  static const needsManualReview = 'NeedsManualReview';
  static const pending = 'Pending';

  static const List<String> all = [
    requested,
    planProposed,
    pendingApproval,
    confirmed,
    completed,
    cancelled,
    needsManualReview,
  ];

  static const List<String> filterOptions = [
    cancelled,
    completed,
    confirmed,
    pending,
  ];

  /// Accent colour per status, taken from the same tones as the web
  /// StatusBadge (light-theme foreground colours).
  static Color color(String status) {
    switch (status) {
      case requested:
      case planProposed:
        return const Color(0xFF2563EB);
      case pendingApproval:
        return const Color(0xFFB45309);
      case confirmed:
        return const Color(0xFF0F6E63);
      case completed:
        return const Color(0xFF15803D);
      case cancelled:
        return const Color(0xFF475569);
      case needsManualReview:
        return const Color(0xFF9A3412);
      default:
        return const Color(0xFF475569);
    }
  }

  /// Readable label, e.g. "PendingApproval" -> "Pending Approval".
  static String label(String status) => statusLabel(status);
}
