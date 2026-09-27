import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../models/guide.dart';

class EditGuideScreen extends StatefulWidget {
  const EditGuideScreen({
    super.key,
    required this.guide,
    this.apiClient,
  });

  final Guide guide;
  final ApiClient? apiClient;

  @override
  State<EditGuideScreen> createState() => _EditGuideScreenState();
}

class _EditGuideScreenState extends State<EditGuideScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _contactController;
  late final TextEditingController _languagesController;
  late final TextEditingController _specsController;
  late final TextEditingController _userIdController;

  bool _submitting = false;
  String? _serverError;
  final Map<String, String> _fieldErrors = {};

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.guide.name);
    _contactController = TextEditingController(text: widget.guide.contactInfo);
    _languagesController =
        TextEditingController(text: widget.guide.languages.join(', '));
    _specsController =
        TextEditingController(text: widget.guide.specializations.join(', '));
    _userIdController =
        TextEditingController(text: widget.guide.userId ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _contactController.dispose();
    _languagesController.dispose();
    _specsController.dispose();
    _userIdController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _serverError = null;
      _fieldErrors.clear();
    });

    if (!_formKey.currentState!.validate()) {
      return;
    }

    final name = _nameController.text.trim();
    final contact = _contactController.text.trim();
    final userId = _userIdController.text.trim();

    final languages = _languagesController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    final specs = _specsController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    setState(() => _submitting = true);

    try {
      await _apiClient.updateGuide(
        widget.guide.id,
        name: name,
        contactInfo: contact,
        languages: languages,
        specializations: specs,
        userId: userId.isNotEmpty ? userId : null,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Guide updated successfully'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _serverError = e.message;
        for (final fe in e.fieldErrors) {
          _fieldErrors[fe.field.toLowerCase()] = fe.message;
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message), backgroundColor: Colors.red),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _serverError = 'Failed to update guide.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Failed to update guide.'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final isAuthorized =
        user?.role == 'OperationsManager' || user?.role == 'Admin';

    if (!isAuthorized) {
      return Scaffold(
        appBar: AppBar(title: const Text('Edit Guide')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Access denied. Only Operations Managers and Admins can edit guides.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: Colors.red),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Edit Guide')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_serverError != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Text(
                    _serverError!,
                    style: TextStyle(color: Colors.red.shade900, fontSize: 13),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              TextFormField(
                controller: _nameController,
                decoration: InputDecoration(
                  labelText: 'Guide Name *',
                  errorText: _fieldErrors['name'],
                  border: const OutlineInputBorder(),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Guide name is required.';
                  }
                  if (val.trim().length > 200) {
                    return 'Guide name cannot exceed 200 characters.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _contactController,
                decoration: InputDecoration(
                  labelText: 'Contact Information',
                  errorText: _fieldErrors['contactinfo'],
                  border: const OutlineInputBorder(),
                ),
                validator: (val) {
                  if (val != null && val.trim().length > 200) {
                    return 'Contact info cannot exceed 200 characters.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _languagesController,
                decoration: const InputDecoration(
                  labelText: 'Languages (comma-separated)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _specsController,
                decoration: const InputDecoration(
                  labelText: 'Specializations (comma-separated)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _userIdController,
                decoration: InputDecoration(
                  labelText: 'Linked User ID (Optional)',
                  errorText: _fieldErrors['userid'],
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Save Changes'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
