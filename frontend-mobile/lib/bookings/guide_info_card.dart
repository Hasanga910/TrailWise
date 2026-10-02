import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/booking.dart';

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
    final theme = Theme.of(context);

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.amber.shade200, width: 1),
      ),
      color: Colors.amber.shade50.withValues(alpha: 0.5),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.amber.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.person_search_outlined,
                color: Colors.amber.shade900,
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
                      color: Colors.amber.shade900,
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'Tour Guide not assigned yet',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
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
                    color: Colors.teal.shade50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.tour_outlined,
                    color: Colors.teal,
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
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.green.shade200),
                  ),
                  child: Text(
                    'Assigned',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.green.shade800,
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
                      const Text(
                        'Name',
                        style: TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        guide.name,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
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
                            padding: const EdgeInsets.all(2),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Row(
                                  children: [
                                    Text(
                                      'Contact',
                                      style: TextStyle(fontSize: 11, color: Colors.grey),
                                    ),
                                    SizedBox(width: 4),
                                    Icon(Icons.copy, size: 10, color: Colors.grey),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  guide.contactInfo!,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.teal,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      : const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Contact',
                              style: TextStyle(fontSize: 11, color: Colors.grey),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Not provided',
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.grey,
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
              const Text(
                'Languages',
                style: TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: guide.languages
                    .map(
                      (lang) => Chip(
                        label: Text(lang, style: const TextStyle(fontSize: 11)),
                        backgroundColor: Colors.blue.shade50,
                        side: BorderSide(color: Colors.blue.shade100),
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
              const Text(
                'Specializations',
                style: TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: guide.specializations
                    .map(
                      (spec) => Chip(
                        label: Text(spec, style: const TextStyle(fontSize: 11)),
                        backgroundColor: Colors.purple.shade50,
                        side: BorderSide(color: Colors.purple.shade100),
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
