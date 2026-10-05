import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum BadgeTone { brand, success, warning, danger, info, orange, neutral }

class StatusMeta {
  const StatusMeta(this.tone, this.icon, this.label);
  final BadgeTone tone;
  final IconData icon;
  final String label;
}

/// Same status -> tone/label mapping as the web statusMeta.ts.
const Map<String, StatusMeta> statusMeta = {
  'Requested': StatusMeta(BadgeTone.info, Icons.schedule, 'Requested'),
  'PlanProposed': StatusMeta(BadgeTone.info, Icons.auto_awesome, 'Plan Proposed'),
  'PendingApproval': StatusMeta(BadgeTone.warning, Icons.hourglass_empty, 'Pending Approval'),
  'NeedsManualReview': StatusMeta(BadgeTone.orange, Icons.warning_amber_rounded, 'Needs Manual Review'),
  'Confirmed': StatusMeta(BadgeTone.brand, Icons.check_circle_outline, 'Confirmed'),
  'Completed': StatusMeta(BadgeTone.success, Icons.flag_outlined, 'Completed'),
  'Cancelled': StatusMeta(BadgeTone.neutral, Icons.cancel_outlined, 'Cancelled'),
};

/// Readable label for a raw status value ("PendingApproval" -> "Pending Approval").
String statusLabel(String status) {
  final meta = statusMeta[status];
  if (meta != null) return meta.label;
  return status.replaceAllMapped(RegExp(r'(?<=[a-z])(?=[A-Z])'), (_) => ' ');
}

(Color bg, Color fg) badgeColors(AppColors c, BadgeTone tone) {
  switch (tone) {
    case BadgeTone.brand:
      return (c.brandSoft, c.brandFg);
    case BadgeTone.success:
      return (c.successSoft, c.successFg);
    case BadgeTone.warning:
      return (c.warningSoft, c.warningFg);
    case BadgeTone.danger:
      return (c.dangerSoft, c.dangerFg);
    case BadgeTone.info:
      return (c.infoSoft, c.infoFg);
    case BadgeTone.orange:
      return (c.orangeSoft, c.orangeFg);
    case BadgeTone.neutral:
      return (c.neutralSoft, c.neutralFg);
  }
}

/// Generic pill badge.
class AppBadge extends StatelessWidget {
  const AppBadge({super.key, required this.label, this.tone = BadgeTone.neutral, this.icon});

  final String label;
  final BadgeTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = badgeColors(AppColors.of(context), tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(AppRadius.badge)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// Booking status pill with readable labels and the web colours.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status, this.label});

  final String status;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final meta = statusMeta[status];
    return AppBadge(
      label: label ?? statusLabel(status),
      tone: meta?.tone ?? BadgeTone.neutral,
      icon: meta?.icon,
    );
  }
}
