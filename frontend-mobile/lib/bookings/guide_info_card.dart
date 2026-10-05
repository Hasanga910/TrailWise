import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/booking.dart';
import '../theme/app_theme.dart';

/// A card displaying assigned Tour Guide details or a pending state notice
/// for traveler booking and itinerary screens.
class GuideInfoCard extends StatelessWidget {
  const GuideInfoCard({
    super.key,
    required this.guide,
    this.isLoading = false,
  });

  /// The assigned Tour Guide details, or null if a guide is not yet assigned.
  final AssignedGuide? guide;

  /// Whether guide assignment information is actively loading.
  final bool isLoading;

  void _copyToClipboard(BuildContext context, String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copied to clipboard'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Card(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: const Padding(
          padding: EdgeInsets.symmetric(vertical: 24, horizontal: 20),
          child: Center(
            child: SizedBox(
              height: 24,
              width: 24,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ),
        ),
      );
    }

    if (guide == null) {
      return _buildPendingCard(context);
    }

    return _buildAssignedCard(context, guide!);
  }

  Widget _buildPendingCard(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: colors.border, width: 1),
      ),
      color: Colors.amber.shade50.withValues(alpha: 0.5),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: colors.warningSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.person_search_outlined,
                color: colors.warningFg,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Assigned Tour Guide',
                    style: theme.textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                      color: colors.warningFg,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Tour Guide not assigned yet',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: colors.fg,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAssignedCard(BuildContext context, AssignedGuide guide) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: colors.brandSoft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.tour_outlined,
                    color: colors.brandText,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Assigned Tour Guide',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: colors.successSoft,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: colors.border),
                  ),
                  child: Text(
                    'Assigned',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: colors.successFg,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 12),

            // Guide Name & Contact
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Name',
                        style: TextStyle(fontSize: 11, color: colors.fgMuted),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        guide.name,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: colors.fg,
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: guide.contactInfo != null && guide.contactInfo!.trim().isNotEmpty
                      ? InkWell(
                          onTap: () => _copyToClipboard(context, guide.contactInfo!, 'Contact number'),
                          borderRadius: BorderRadius.circular(8),
                          child: Padding(
                            padding: EdgeInsets.all(2),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      'Contact',
                                      style: TextStyle(fontSize: 11, color: colors.fgMuted),
                                    ),
                                    SizedBox(width: 4),
                                    Icon(Icons.copy, size: 10, color: colors.fgMuted),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  guide.contactInfo!,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: colors.brandText,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Contact',
                              style: TextStyle(fontSize: 11, color: colors.fgMuted),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Not provided',
                              style: TextStyle(
                                fontSize: 13,
                                color: colors.fgMuted,
                              ),
                            ),
                          ],
                        ),
                ),
              ],
            ),

            // Languages
            if (guide.languages.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                'Languages',
                style: TextStyle(fontSize: 11, color: colors.fgMuted),
              ),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: guide.languages
                    .map(
                      (lang) => Chip(
                        label: Text(lang, style: const TextStyle(fontSize: 11)),
                        backgroundColor: colors.infoSoft,
                        side: BorderSide(color: colors.infoSoft),
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                      ),
                    )
                    .toList(),
              ),
            ],

            // Specializations
            if (guide.specializations.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                'Specializations',
                style: TextStyle(fontSize: 11, color: colors.fgMuted),
              ),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: guide.specializations
                    .map(
                      (spec) => Chip(
                        label: Text(spec, style: const TextStyle(fontSize: 11)),
                        backgroundColor: colors.neutralSoft,
                        side: BorderSide(color: colors.neutralSoft),
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                      ),
                    )
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
