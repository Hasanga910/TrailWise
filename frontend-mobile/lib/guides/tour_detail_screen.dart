import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/assigned_tour.dart';
import '../models/itinerary_step.dart';
import 'guide_itinerary_edit_screen.dart';
import '../theme/app_theme.dart';
import '../widgets/widgets.dart';

class TourDetailScreen extends StatefulWidget {
  const TourDetailScreen({
    super.key,
    required this.tour,
    this.apiClient,
  });

  final AssignedTour tour;
  final ApiClient? apiClient;

  @override
  State<TourDetailScreen> createState() => _TourDetailScreenState();
}

class _TourDetailScreenState extends State<TourDetailScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  late AssignedTour _tour;
  late bool _attended;
  late final TextEditingController _notesController;

  bool _saving = false;
  bool _lifecycleLoading = false;
  String? _errorMessage;

  bool _loadingItinerary = true;
  String? _itineraryErrorMessage;
  List<ItineraryStep> _itinerarySteps = [];

  @override
  void initState() {
    super.initState();
    _tour = widget.tour;
    _attended = widget.tour.attended;
    _notesController = TextEditingController(text: widget.tour.guideNotes ?? '');
    _loadItinerary();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  String _formatDateTime(DateTime dt) {
    final local = dt.toLocal();
    final y = local.year;
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    final hh = local.hour.toString().padLeft(2, '0');
    final mm = local.minute.toString().padLeft(2, '0');
    return '$y-$m-$d $hh:$mm';
  }

  Future<void> _save() async {
    final colors = AppColors.of(context);
    if (_saving || _lifecycleLoading) return;

    setState(() {
      _saving = true;
      _errorMessage = null;
    });

    final notesText = _notesController.text.trim();
    final notesToSend = notesText.isEmpty ? null : notesText;

    try {
      await _apiClient.updateGuideTour(
        bookingId: _tour.bookingId,
        attended: _attended,
        notes: notesToSend,
      );

      final updatedTour = _tour.copyWith(
        attended: _attended,
        guideNotes: notesToSend,
      );

      if (!mounted) return;

      setState(() {
        _tour = updatedTour;
        _saving = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Tour updates saved successfully'),
          backgroundColor: colors.success,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _errorMessage = e.message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: colors.danger,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      const message = 'Failed to save updates. Please try again.';
      setState(() {
        _saving = false;
        _errorMessage = message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: colors.danger,
        ),
      );
    }
  }

  Future<void> _confirmClearNote() async {
    final colors = AppColors.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Clear Guide Note'),
        content: const Text('Remove this guide note?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: colors.danger),
            child: const Text('Clear'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await _clearNote();
    }
  }

  Future<void> _clearNote() async {
    final colors = AppColors.of(context);
    if (_saving || _lifecycleLoading) return;

    setState(() {
      _saving = true;
      _errorMessage = null;
    });

    try {
      await _apiClient.updateGuideTour(
        bookingId: _tour.bookingId,
        attended: _attended,
        notes: null,
      );

      final updatedTour = _tour.copyWith(
        attended: _attended,
        clearGuideNotes: true,
      );

      if (!mounted) return;

      _notesController.clear();
      setState(() {
        _tour = updatedTour;
        _saving = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Guide note cleared.'),
          backgroundColor: colors.success,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _errorMessage = e.message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: colors.danger),
      );
    } catch (_) {
      if (!mounted) return;
      const message = 'Failed to clear guide note. Please try again.';
      setState(() {
        _saving = false;
        _errorMessage = message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: colors.danger),
      );
    }
  }

  Future<void> _startTour() async {
    final colors = AppColors.of(context);
    if (_saving || _lifecycleLoading || !_tour.isAdvancePaid) return;

    setState(() {
      _lifecycleLoading = true;
      _errorMessage = null;
    });

    try {
      final updated = await _apiClient.startTour(_tour.bookingId);
      if (!mounted) return;

      setState(() {
        _tour = updated;
        _lifecycleLoading = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Tour started successfully.'),
          backgroundColor: colors.success,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _lifecycleLoading = false;
        _errorMessage = e.message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: colors.danger),
      );
    } catch (_) {
      if (!mounted) return;
      const message = 'Failed to start tour. Please try again.';
      setState(() {
        _lifecycleLoading = false;
        _errorMessage = message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: colors.danger),
      );
    }
  }

  Future<void> _endTour() async {
    final colors = AppColors.of(context);
    if (_saving || _lifecycleLoading) return;

    setState(() {
      _lifecycleLoading = true;
      _errorMessage = null;
    });

    try {
      final updated = await _apiClient.endTour(_tour.bookingId);
      if (!mounted) return;

      setState(() {
        _tour = updated;
        _lifecycleLoading = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Tour ended successfully.'),
          backgroundColor: colors.success,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _lifecycleLoading = false;
        _errorMessage = e.message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: colors.danger),
      );
    } catch (_) {
      if (!mounted) return;
      const message = 'Failed to end tour. Please try again.';
      setState(() {
        _lifecycleLoading = false;
        _errorMessage = message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: colors.danger),
      );
    }
  }

  Future<void> _loadItinerary() async {
    setState(() {
      _loadingItinerary = true;
      _itineraryErrorMessage = null;
    });

    try {
      final steps = await _apiClient.getItinerary(_tour.bookingId);
      if (!mounted) return;
      setState(() {
        _itinerarySteps = steps;
        _loadingItinerary = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadingItinerary = false;
        _itineraryErrorMessage = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingItinerary = false;
        _itineraryErrorMessage = 'Failed to load itinerary. Please try again.';
      });
    }
  }

  Future<void> _openItineraryEditor() async {
    final result = await Navigator.of(context).push<List<ItineraryStep>>(
      MaterialPageRoute(
        builder: (context) => GuideItineraryEditScreen(
          bookingId: _tour.bookingId,
          initialSteps: _itinerarySteps,
          apiClient: _apiClient,
        ),
      ),
    );

    if (result != null && mounted) {
      setState(() {
        _itinerarySteps = result;
      });
    } else if (mounted) {
      await _loadItinerary();
    }
  }

  Widget _buildItineraryList(List<ItineraryStep> steps) {
    final colors = AppColors.of(context);
    final grouped = <int, List<ItineraryStep>>{};
    for (final step in steps) {
      grouped.putIfAbsent(step.dayNumber, () => []).add(step);
    }
    final days = grouped.keys.toList()..sort();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final day in days) ...[
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Text(
              'Day $day',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: colors.fgMuted,
                letterSpacing: 0.5,
              ),
            ),
          ),
          for (final step in (grouped[day]!..sort((a, b) => a.startTime.compareTo(b.startTime)))) ...[
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 55,
                    child: Text(
                      step.formattedStartTime,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: colors.fg,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${step.activity} — ${step.location}',
                      style: TextStyle(
                        fontSize: 14,
                        color: colors.fg,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isCompleted = _tour.completed || _tour.tourEndedAt != null;

    return PopScope<AssignedTour>(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.of(context).pop(_tour);
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Tour Details'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(_tour),
          ),
        ),
        body: SingleChildScrollView(
          padding: AppSpacing.page,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Error banner if save failed
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: colors.dangerSoft,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: colors.border),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: colors.danger, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(color: colors.dangerFg, fontSize: 14),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Tour Info Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Top Row: Tour Package Name and Status Chip
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              _tour.tourPackageName,
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: StatusBadge(status: _tour.status),
                      ),
                      const SizedBox(height: 8),

                      // Theme Chip / Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: colors.brandSoft,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _tour.theme,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: colors.brandText,
                          ),
                        ),
                      ),
                      SizedBox(height: 12),

                      // Date Range
                      Row(
                        children: [
                          Icon(Icons.date_range, size: 16, color: colors.fgMuted),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '${_tour.startDate} to ${_tour.endDate}',
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 6),

                      // Group Size
                      Row(
                        children: [
                          Icon(Icons.people_outline, size: 16, color: colors.fgMuted),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              '${_tour.groupSize} ${_tour.groupSize == 1 ? 'traveler' : 'travelers'}',
                              style: const TextStyle(fontSize: 14),
                            ),
                          ),
                        ],
                      ),

                      // Locations (if any)
                      if (_tour.locations.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.location_on_outlined,
                              size: 16,
                              color: colors.fgMuted,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Locations: ${_tour.locations.join(', ')}',
                                style: const TextStyle(fontSize: 14),
                              ),
                            ),
                          ],
                        ),
                      ],

                      // Special Requests (when non-empty)
                      if (_tour.specialRequests != null &&
                          _tour.specialRequests!.trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: colors.warningSoft,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: colors.border),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.notes,
                                size: 16,
                                color: colors.warningFg,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Special requests: ${_tour.specialRequests}',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: colors.warningFg,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Guide Controls Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Tour Management',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Attendance switch
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text(
                          'Attended',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: const Text('Mark attendance for this tour group'),
                        value: _attended,
                        onChanged: _saving
                            ? null
                            : (val) {
                                setState(() {
                                  _attended = val;
                                });
                              },
                      ),
                      const SizedBox(height: 16),

                      // Notes text field
                      TextField(
                        controller: _notesController,
                        enabled: !_saving && !_lifecycleLoading,
                        maxLines: 4,
                        decoration: const InputDecoration(
                          labelText: 'Guide Notes',
                          hintText: 'Enter notes about the tour, traveler arrival, etc.',
                          border: OutlineInputBorder(),
                          alignLabelWithHint: true,
                        ),
                        onChanged: (_) {
                          setState(() {});
                        },
                      ),
                      if ((_tour.guideNotes != null && _tour.guideNotes!.trim().isNotEmpty) ||
                          _notesController.text.trim().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Align(
                          alignment: Alignment.centerRight,
                          child: OutlinedButton.icon(
                            onPressed: (_saving || _lifecycleLoading) ? null : _confirmClearNote,
                            icon: const Icon(Icons.delete_outline, size: 16),
                            label: const Text('Clear Note'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: colors.danger,
                              side: BorderSide(color: colors.border),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),

                      // Save button
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: FilledButton(
                          onPressed: (_saving || _lifecycleLoading) ? null : _save,
                          child: _saving
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'Save Updates',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Tour Lifecycle Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Tour Lifecycle',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),

                      if (_tour.tourEndedAt != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: colors.successSoft,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: colors.border),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.check_circle, color: colors.success, size: 20),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Tour Completed',
                                      style: TextStyle(
                                        color: colors.successFg,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 15,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (_tour.tourStartedAt != null) ...[
                                const SizedBox(height: 6),
                                Text(
                                  'Started at: ${_formatDateTime(_tour.tourStartedAt!)}',
                                  style: TextStyle(color: colors.successFg, fontSize: 13),
                                ),
                              ],
                              const SizedBox(height: 4),
                              Text(
                                'Ended at: ${_formatDateTime(_tour.tourEndedAt!)}',
                                style: TextStyle(color: colors.successFg, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ] else if (_tour.tourStartedAt != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: colors.warningSoft,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: colors.border),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.play_circle_filled, color: colors.warning, size: 20),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Tour Started',
                                    style: TextStyle(
                                      color: colors.warningFg,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Started at: ${_formatDateTime(_tour.tourStartedAt!)}',
                                style: TextStyle(color: colors.warningFg, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: FilledButton(
                            onPressed: (_lifecycleLoading || _saving) ? null : _endTour,
                            style: FilledButton.styleFrom(backgroundColor: colors.danger),
                            child: _lifecycleLoading
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text(
                                    'End Tour',
                                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                                  ),
                          ),
                        ),
                      ] else ...[
                        if (!_tour.isAdvancePaid) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: colors.warningSoft,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: colors.border),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.info_outline, color: colors.warningFg, size: 20),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    'Waiting for advance payment. Advance payment must be completed before starting this tour.',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: colors.warningFg,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: FilledButton(
                            onPressed: (_lifecycleLoading || _saving || !_tour.isAdvancePaid) ? null : _startTour,
                            style: FilledButton.styleFrom(backgroundColor: colors.brandText),
                            child: _lifecycleLoading
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Text(
                                    'Start Tour',
                                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                                  ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Itinerary Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          const Text(
                            'Itinerary',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (!isCompleted && !_loadingItinerary && _itineraryErrorMessage == null)
                            FilledButton.tonal(
                              key: const ValueKey('itineraryActionButton'),
                              onPressed: _openItineraryEditor,
                              child: Text(
                                _itinerarySteps.isEmpty ? 'Set Itinerary' : 'Edit Itinerary',
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      if (isCompleted) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: colors.surfaceSunken,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: colors.border),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.lock_outline, size: 16, color: colors.fgMuted),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Tour completed — itinerary is read-only.',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: colors.fg,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      if (_loadingItinerary) ...[
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: CircularProgressIndicator(),
                          ),
                        ),
                      ] else if (_itineraryErrorMessage != null) ...[
                        Text(
                          _itineraryErrorMessage!,
                          style: TextStyle(color: colors.danger),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: _loadItinerary,
                          child: const Text('Retry'),
                        ),
                      ] else if (_itinerarySteps.isEmpty) ...[
                        Text(
                          'No itinerary has been set for this trip yet.',
                          style: TextStyle(color: colors.fgMuted, fontSize: 14),
                        ),
                      ] else ...[
                        _buildItineraryList(_itinerarySteps),
                      ],
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
