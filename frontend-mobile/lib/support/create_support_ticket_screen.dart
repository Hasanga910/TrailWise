import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/booking.dart';
import '../models/paged_result.dart';

class CreateSupportTicketScreen extends StatefulWidget {
  final ApiClient? apiClient;
  final String? preselectedBookingId;

  const CreateSupportTicketScreen({
    super.key,
    this.apiClient,
    this.preselectedBookingId,
  });

  @override
  State<CreateSupportTicketScreen> createState() => _CreateSupportTicketScreenState();
}

class _CreateSupportTicketScreenState extends State<CreateSupportTicketScreen> {
  late final ApiClient _apiClient = widget.apiClient ?? context.read<AuthProvider>().apiClient;
  final _formKey = GlobalKey<FormState>();
  final _subjectController = TextEditingController();
  final _descriptionController = TextEditingController();

  String _selectedCategory = 'Trip';
  String? _selectedBookingId;
  List<Booking> _bookings = [];
  bool _loadingBookings = true;
  bool _submitting = false;
  String? _submitError;

  static const _categories = [
    'Trip',
    'Payment',
    'Booking',
    'Account',
    'App',
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    _selectedBookingId = widget.preselectedBookingId;
    _fetchBookings();
  }

  @override
  void dispose() {
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _fetchBookings() async {
    try {
      final json = await _apiClient.get('/api/bookings/mine', query: {'pageSize': 50});
      if (json != null && mounted) {
        final paged = PagedResult<Booking>.fromJson(
          json as Map<String, dynamic>,
          Booking.fromJson,
        );
        setState(() {
          _bookings = paged.items;
          _loadingBookings = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loadingBookings = false);
      }
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _submitting = true;
      _submitError = null;
    });

    try {
      await _apiClient.createSupportTicket(
        category: _selectedCategory,
        subject: _subjectController.text.trim(),
        description: _descriptionController.text.trim(),
        bookingId: _selectedBookingId,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Support ticket created successfully.')),
      );

      Navigator.of(context).pop(true);
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
        _submitError = 'Could not create support ticket. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Support Ticket'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_submitError != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(
                    _submitError!,
                    style: TextStyle(color: Colors.red.shade800),
                  ),
                ),

              // Category dropdown
              DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _selectedCategory,
                decoration: const InputDecoration(
                  labelText: 'Category',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.category_outlined),
                ),
                items: _categories.map((cat) {
                  return DropdownMenuItem(
                    value: cat,
                    child: Text(
                      cat,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedCategory = val);
                },
              ),
              const SizedBox(height: 16),

              // Optional Booking selector
              if (_loadingBookings)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: LinearProgressIndicator(),
                )
              else if (_bookings.isNotEmpty) ...[
                DropdownButtonFormField<String?>(
                  isExpanded: true,
                  initialValue: _bookings.any((b) => b.id == _selectedBookingId)
                      ? _selectedBookingId
                      : null,
                  decoration: const InputDecoration(
                    labelText: 'Linked Booking (Optional)',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.bookmark_outline),
                  ),
                  items: [
                    const DropdownMenuItem<String?>(
                      value: null,
                      child: Text(
                        'None (General Inquiry)',
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    ..._bookings.map((b) => DropdownMenuItem<String?>(
                          value: b.id,
                          child: Text(
                            '${b.tourPackageName} (${b.status})',
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        )),
                  ],
                  onChanged: (val) => setState(() => _selectedBookingId = val),
                ),
                const SizedBox(height: 16),
              ],

              // Subject input
              TextFormField(
                key: const Key('ticket-subject-field'),
                controller: _subjectController,
                decoration: const InputDecoration(
                  labelText: 'Subject',
                  hintText: 'Brief summary of the issue (at least 5 characters)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.title),
                ),
                validator: (val) {
                  if (val == null || val.trim().length < 5) {
                    return 'Subject must be at least 5 characters.';
                  }
                  if (val.trim().length > 200) {
                    return 'Subject cannot exceed 200 characters.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Description input
              TextFormField(
                key: const Key('ticket-description-field'),
                controller: _descriptionController,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  hintText: 'Describe your issue or question in detail...',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please enter a description.';
                  }
                  if (val.trim().length > 4000) {
                    return 'Description cannot exceed 4000 characters.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Submit button
              FilledButton.icon(
                key: const Key('ticket-submit-button'),
                icon: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.send),
                label: Text(_submitting ? 'Submitting...' : 'Submit Support Ticket'),
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
