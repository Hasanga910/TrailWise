import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../auth/current_user.dart';
import '../theme/app_theme.dart';
import '../theme/theme_toggle_button.dart';
import '../utils/validators.dart';

class DriverProfileScreen extends StatefulWidget {
  const DriverProfileScreen({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  State<DriverProfileScreen> createState() => _DriverProfileScreenState();
}

class _DriverProfileScreenState extends State<DriverProfileScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  final _profileFormKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();

  late TextEditingController _nameController;
  late TextEditingController _emailController;
  late TextEditingController _contactController;

  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _savingProfile = false;
  bool _savingPassword = false;
  bool _deletingAccount = false;

  String? _profileError;
  String? _profileSuccess;
  String? _passwordError;
  String? _passwordSuccess;
  String? _deleteError;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _nameController = TextEditingController(text: user?.name ?? '');
    _emailController = TextEditingController(text: user?.email ?? '');
    _contactController = TextEditingController(text: '');
    _loadProfile();
  }

  /// CurrentUser has no contact number, so read the full profile from /api/auth/me.
  /// Only fills fields the driver has not started typing in.
  Future<void> _loadProfile() async {
    try {
      final res = await _apiClient.get('/api/auth/me');
      if (!mounted || res is! Map<String, dynamic>) return;
      void fill(TextEditingController controller, Object? value) {
        if (controller.text.isEmpty && value is String) controller.text = value;
      }

      fill(_nameController, res['name']);
      fill(_emailController, res['email']);
      fill(_contactController, res['contactNumber']);
    } catch (_) {
      // Best-effort prefill; the driver can still type the details in.
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _contactController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSaveProfile() async {
    if (!_profileFormKey.currentState!.validate()) return;

    setState(() {
      _savingProfile = true;
      _profileError = null;
      _profileSuccess = null;
    });

    try {
      final res = await _apiClient.put('/api/auth/me', {
        'name': _nameController.text.trim(),
        'email': _emailController.text.trim(),
        'contactNumber': _contactController.text.trim(),
      });

      if (mounted) {
        if (res is Map<String, dynamic>) {
          final updated = CurrentUser.fromJson(res);
          context.read<AuthProvider>().updateUser(updated);
        }
        setState(() {
          _savingProfile = false;
          _profileSuccess = 'Profile updated successfully!';
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _savingProfile = false;
          _profileError = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _savingProfile = false;
          _profileError = 'Could not update profile. Please try again.';
        });
      }
    }
  }

  Future<void> _handleChangePassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;

    if (_newPasswordController.text != _confirmPasswordController.text) {
      setState(() {
        _passwordError = 'New passwords do not match.';
      });
      return;
    }

    setState(() {
      _savingPassword = true;
      _passwordError = null;
      _passwordSuccess = null;
    });

    try {
      await _apiClient.put('/api/auth/me/password', {
        'currentPassword': _currentPasswordController.text,
        'newPassword': _newPasswordController.text,
      });

      if (mounted) {
        setState(() {
          _savingPassword = false;
          _passwordSuccess = 'Password updated successfully!';
          _currentPasswordController.clear();
          _newPasswordController.clear();
          _confirmPasswordController.clear();
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _savingPassword = false;
          _passwordError = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _savingPassword = false;
          _passwordError = 'Could not change password. Please check your current password.';
        });
      }
    }
  }

  Future<void> _handleDeleteAccount() async {
    setState(() {
      _deletingAccount = true;
      _deleteError = null;
    });

    try {
      await _apiClient.delete('/api/auth/me');
      if (mounted) {
        Navigator.of(context).pop(); // dismiss modal
        await context.read<AuthProvider>().logout();
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _deletingAccount = false;
          _deleteError = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _deletingAccount = false;
          _deleteError = 'Could not delete account. Please try again.';
        });
      }
    }
  }

  void _showDeleteConfirmDialog() {
    final colors = AppColors.of(context);
    showDialog(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Delete Driver Account'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Are you sure you want to delete your driver account? You will immediately be signed out and lose access to your driving tasks.',
                style: TextStyle(fontSize: 14),
              ),
              if (_deleteError != null) ...[
                SizedBox(height: 12),
                Text(
                  _deleteError!,
                  style: TextStyle(color: colors.danger, fontSize: 13),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: _deletingAccount ? null : () => Navigator.of(dialogCtx).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: _deletingAccount
                  ? null
                  : () async {
                      setDialogState(() {
                        _deleteError = null;
                      });
                      await _handleDeleteAccount();
                      if (mounted && _deleteError != null) {
                        setDialogState(() {});
                      }
                    },
              style: FilledButton.styleFrom(backgroundColor: colors.danger),
              child: _deletingAccount
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Delete Account'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver Profile & Settings'),
        actions: const [ThemeToggleButton()],
      ),
      body: ListView(
        padding: AppSpacing.page,
        children: [
          // Header Card
          Card(
            elevation: 0,
            color: colors.brandSoft,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: colors.border),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: colors.brandText,
                    child: Text(
                      (user?.name.isNotEmpty ?? false) ? user!.name[0].toUpperCase() : 'D',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.name ?? 'Driver',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          user?.email ?? '',
                          style: TextStyle(color: colors.fgMuted, fontSize: 13),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: colors.brandSoft,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Professional Driver',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: colors.brandText,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Personal Details Section
          Text(
            'Personal Details',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 12),
          Form(
            key: _profileFormKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    prefixIcon: Icon(Icons.person_outline),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Name is required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email Address',
                    prefixIcon: Icon(Icons.email_outlined),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Email is required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _contactController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Contact / Mobile Number',
                    prefixIcon: Icon(Icons.phone_outlined),
                    border: OutlineInputBorder(),
                  ),
                  validator: validatePhone,
                ),
                if (_profileError != null) ...[
                  SizedBox(height: 10),
                  Text(_profileError!, style: TextStyle(color: colors.danger, fontSize: 13)),
                ],
                if (_profileSuccess != null) ...[
                  SizedBox(height: 10),
                  Text(_profileSuccess!, style: TextStyle(color: colors.brandText, fontSize: 13, fontWeight: FontWeight.bold)),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _savingProfile ? null : _handleSaveProfile,
                    child: _savingProfile
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Save Profile'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          // Change Password Section
          Text(
            'Change Password',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 12),
          Form(
            key: _passwordFormKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _currentPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Current Password',
                    prefixIcon: Icon(Icons.lock_outline),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Current password is required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _newPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'New Password',
                    prefixIcon: Icon(Icons.lock_reset),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'New password is required';
                    if (v.length < 6) return 'Minimum 6 characters required';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Confirm New Password',
                    prefixIcon: Icon(Icons.lock_reset),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.isEmpty ? 'Please confirm new password' : null,
                ),
                if (_passwordError != null) ...[
                  SizedBox(height: 10),
                  Text(_passwordError!, style: TextStyle(color: colors.danger, fontSize: 13)),
                ],
                if (_passwordSuccess != null) ...[
                  SizedBox(height: 10),
                  Text(_passwordSuccess!, style: TextStyle(color: colors.brandText, fontSize: 13, fontWeight: FontWeight.bold)),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _savingPassword ? null : _handleChangePassword,
                    child: _savingPassword
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Update Password'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 36),

          // Danger Zone Card
          Card(
            elevation: 0,
            color: colors.dangerSoft,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: colors.border),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Danger Zone',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: colors.dangerFg,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Deleting your driver account will immediately deactivate your login credentials and sign you out.',
                    style: TextStyle(fontSize: 13, color: colors.dangerFg),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    icon: const Icon(Icons.delete_forever, size: 18),
                    label: const Text('Delete Driver Account'),
                    onPressed: _showDeleteConfirmDialog,
                    style: FilledButton.styleFrom(
                      backgroundColor: colors.danger,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
