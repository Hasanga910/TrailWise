import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../auth/auth_provider.dart';
import '../auth/current_user.dart';
import '../models/guide_profile.dart';
import '../theme/app_theme.dart';
import '../utils/validators.dart';
import '../theme/theme_toggle_button.dart';
import '../widgets/widgets.dart';

const List<String> availableGuideLanguages = [
  'Afrikaans',
  'Albanian',
  'Amharic',
  'Arabic',
  'Armenian',
  'Azerbaijani',
  'Basque',
  'Bengali',
  'Bosnian',
  'Bulgarian',
  'Burmese',
  'Catalan',
  'Chinese',
  'Croatian',
  'Czech',
  'Danish',
  'Dutch',
  'English',
  'Estonian',
  'Filipino',
  'Finnish',
  'French',
  'Georgian',
  'German',
  'Greek',
  'Gujarati',
  'Hebrew',
  'Hindi',
  'Hungarian',
  'Icelandic',
  'Indonesian',
  'Irish',
  'Italian',
  'Japanese',
  'Kannada',
  'Kazakh',
  'Khmer',
  'Korean',
  'Lao',
  'Latvian',
  'Lithuanian',
  'Malay',
  'Malayalam',
  'Marathi',
  'Mongolian',
  'Nepali',
  'Norwegian',
  'Persian',
  'Polish',
  'Portuguese',
  'Punjabi',
  'Romanian',
  'Russian',
  'Serbian',
  'Sinhala',
  'Slovak',
  'Slovenian',
  'Spanish',
  'Swahili',
  'Swedish',
  'Tamil',
  'Telugu',
  'Thai',
  'Turkish',
  'Ukrainian',
  'Urdu',
  'Uzbek',
  'Vietnamese',
  'Welsh',
];

class GuideProfileScreen extends StatefulWidget {
  const GuideProfileScreen({super.key, this.apiClient});

  final ApiClient? apiClient;

  @override
  State<GuideProfileScreen> createState() => _GuideProfileScreenState();
}

class _GuideProfileScreenState extends State<GuideProfileScreen> {
  late final ApiClient _apiClient =
      widget.apiClient ?? context.read<AuthProvider>().apiClient;

  final _profileFormKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _contactController = TextEditingController();

  // Languages: List<String> state
  List<String> _languages = [];
  String? _languageError;

  // Specializations: List<String> + tag input controller
  List<String> _specializations = [];
  final _specializationInputController = TextEditingController();
  String? _specializationError;

  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  GuideProfile? _profile;
  bool _loading = true;
  String? _loadError;

  bool _savingProfile = false;
  bool _savingPassword = false;
  bool _deletingProfile = false;

  String? _profileError;
  String? _profileSuccess;
  String? _passwordError;
  String? _passwordSuccess;
  String? _deleteError;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _contactController.dispose();
    _specializationInputController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });

    try {
      final profile = await _apiClient.getGuideProfile();
      if (mounted) {
        setState(() {
          _profile = profile;
          _nameController.text = profile.name;
          _emailController.text = profile.email;
          _contactController.text = profile.contactInfo;
          _languages = List<String>.from(profile.languages);
          _specializations = List<String>.from(profile.specializations);
          _specializationInputController.clear();
          _languageError = null;
          _specializationError = null;
          _loading = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadError = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadError = 'Could not load profile. Please try again.';
        });
      }
    }
  }

  void _addLanguage(String lang) {
    final trimmed = lang.trim();
    if (trimmed.isEmpty) return;
    if (_languages.any((l) => l.toLowerCase() == trimmed.toLowerCase())) {
      setState(() {
        _languageError = '"$trimmed" is already added.';
      });
      return;
    }
    setState(() {
      _languageError = null;
      _languages.add(trimmed);
    });
  }

  void _removeLanguage(String lang) {
    setState(() {
      _languages.removeWhere((l) => l.toLowerCase() == lang.toLowerCase());
      _languageError = null;
    });
  }

  Future<void> _showLanguageSelector() async {
    final colors = AppColors.of(context);
    String searchQuery = '';
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final trimmedQuery = searchQuery.trim().toLowerCase();
            final filtered = availableGuideLanguages.where((lang) {
              if (trimmedQuery.isEmpty) return true;
              return lang.toLowerCase().contains(trimmedQuery);
            }).toList();

            return SafeArea(
              child: Container(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.8,
                ),
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Select Languages',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          TextButton(
                            key: const Key('done-languages-btn'),
                            onPressed: () => Navigator.of(sheetContext).pop(),
                            child: const Text('Done'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: TextField(
                        key: const Key('language-search-field'),
                        decoration: InputDecoration(
                          hintText: 'Search languages...',
                          prefixIcon: const Icon(Icons.search),
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        onChanged: (val) {
                          setSheetState(() {
                            searchQuery = val;
                          });
                        },
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Divider(),
                    Expanded(
                      child: filtered.isEmpty
                          ? Center(
                              child: Padding(
                                padding: EdgeInsets.all(20),
                                child: Text(
                                  'No languages found',
                                  style: TextStyle(color: colors.fgMuted, fontSize: 14),
                                ),
                              ),
                            )
                          : ListView.builder(
                              itemCount: filtered.length,
                              itemBuilder: (context, index) {
                                final lang = filtered[index];
                                final isSelected = _languages.any(
                                  (l) => l.toLowerCase() == lang.toLowerCase(),
                                );
                                return CheckboxListTile(
                                  key: Key('checkbox-lang-$lang'),
                                  title: Text(lang),
                                  value: isSelected,
                                  onChanged: (bool? checked) {
                                    if (checked == true) {
                                      _addLanguage(lang);
                                    } else {
                                      _removeLanguage(lang);
                                    }
                                    setSheetState(() {});
                                  },
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _addSpecialization([String? value]) {
    final raw = value ?? _specializationInputController.text;
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return;
    if (_specializations.any((s) => s.toLowerCase() == trimmed.toLowerCase())) {
      setState(() {
        _specializationError = '"$trimmed" is already added.';
      });
      return;
    }
    setState(() {
      _specializationError = null;
      _specializations.add(trimmed);
      _specializationInputController.clear();
    });
  }

  void _removeSpecialization(String spec) {
    setState(() {
      _specializations.removeWhere((s) => s.toLowerCase() == spec.toLowerCase());
      _specializationError = null;
    });
  }

  Future<void> _handleSaveProfile() async {
    if (!_profileFormKey.currentState!.validate()) return;

    setState(() {
      _savingProfile = true;
      _profileError = null;
      _profileSuccess = null;
    });

    try {
      final updated = await _apiClient.updateGuideProfile(
        name: _nameController.text.trim(),
        email: _emailController.text.trim(),
        contactInfo: _contactController.text.trim(),
        languages: _languages,
        specializations: _specializations,
      );

      if (mounted) {
        setState(() {
          _profile = updated;
          _nameController.text = updated.name;
          _emailController.text = updated.email;
          _contactController.text = updated.contactInfo;
          _languages = List<String>.from(updated.languages);
          _specializations = List<String>.from(updated.specializations);
          _savingProfile = false;
          _profileSuccess = 'Profile updated successfully!';
        });

        // Update in-memory auth provider user so headers & app state stay fresh
        final user = context.read<AuthProvider>().user;
        if (user != null) {
          context.read<AuthProvider>().updateUser(CurrentUser(
                id: user.id,
                name: updated.name,
                email: updated.email,
                role: user.role,
              ));
        }
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
      await _apiClient.changePassword(
        currentPassword: _currentPasswordController.text,
        newPassword: _newPasswordController.text,
      );

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

  Future<void> _handleDeleteProfile(StateSetter setDialogState) async {
    setDialogState(() {
      _deletingProfile = true;
      _deleteError = null;
    });

    try {
      await _apiClient.deleteGuideProfile();
      if (mounted) {
        Navigator.of(context).pop(); // dismiss modal
        await context.read<AuthProvider>().logout();
      }
    } on ApiException catch (e) {
      if (mounted) {
        setDialogState(() {
          _deletingProfile = false;
          if (e.statusCode == 409 || e.message.toLowerCase().contains('assigned tour')) {
            _deleteError = 'Your profile cannot be deleted because you still have assigned tours.';
          } else {
            _deleteError = e.message;
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setDialogState(() {
          _deletingProfile = false;
          _deleteError = 'Could not delete profile. Please try again.';
        });
      }
    }
  }

  void _showDeleteConfirmDialog() {
    final colors = AppColors.of(context);
    _deleteError = null;
    showDialog(
      context: context,
      builder: (dialogCtx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Delete Tour Guide Profile'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Are you sure you want to delete your Tour Guide profile? You cannot delete your profile while tours are assigned to you.',
                style: TextStyle(fontSize: 14),
              ),
              if (_deleteError != null) ...[
                SizedBox(height: 12),
                Text(
                  _deleteError!,
                  style: TextStyle(color: colors.danger, fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: _deletingProfile ? null : () => Navigator.of(dialogCtx).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: _deletingProfile
                  ? null
                  : () => _handleDeleteProfile(setDialogState),
              style: FilledButton.styleFrom(backgroundColor: colors.danger),
              child: _deletingProfile
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Delete'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tour Guide Profile & Settings'),
        actions: const [ThemeToggleButton()],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    final colors = AppColors.of(context);
    if (_loading) {
      return const LoadingView();
    }

    if (_loadError != null) {
      return ErrorState(message: _loadError!, onRetry: _loadProfile);
    }

    final guideName = _profile?.name ?? '';
    final guideEmail = _profile?.email ?? '';

    return ListView(
      padding: AppSpacing.page,
      children: [
        // Profile Card
        Card(
          elevation: 0,
          color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  child: Text(
                    (guideName.isNotEmpty ? guideName[0] : 'G').toUpperCase(),
                    style: const TextStyle(
                      fontSize: 26,
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
                        guideName.isNotEmpty ? guideName : 'Tour Guide',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        guideEmail,
                        style: TextStyle(
                          fontSize: 13,
                          color: colors.fgMuted,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: colors.brandSoft,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: colors.border),
                        ),
                        child: Text(
                          'ROLE: TOUR GUIDE',
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
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Name is required' : null,
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
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Email is required';
                  if (!v.contains('@')) return 'Enter a valid email address';
                  return null;
                },
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
                validator: validateOptionalPhone,
              ),
              const SizedBox(height: 16),
              // Languages Section
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        'Languages',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: colors.fg,
                        ),
                      ),
                      TextButton.icon(
                        key: const Key('add-language-btn'),
                        onPressed: _showLanguageSelector,
                        icon: const Icon(Icons.add, size: 16),
                        label: const Text('Add Language'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  if (_languages.isEmpty)
                    InkWell(
                      key: const Key('open-language-selector-empty'),
                      onTap: _showLanguageSelector,
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          border: Border.all(color: colors.border),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.language_outlined, size: 20, color: colors.border),
                            const SizedBox(width: 8),
                            Text(
                              'Tap to select languages...',
                              style: TextStyle(color: colors.fgMuted, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    Wrap(
                      key: const Key('languages-wrap'),
                      spacing: 8,
                      runSpacing: 4,
                      children: _languages.map((lang) {
                        return Chip(
                          key: Key('chip-lang-$lang'),
                          label: Text(lang),
                          labelStyle: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: colors.brandText,
                          ),
                          backgroundColor: colors.brandSoft,
                          side: BorderSide(color: colors.border),
                          deleteIcon: Icon(Icons.close, size: 16, color: colors.brandText),
                          onDeleted: () => _removeLanguage(lang),
                        );
                      }).toList(),
                    ),
                  if (_languageError != null)
                    Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        _languageError!,
                        style: TextStyle(color: colors.danger, fontSize: 12),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),

              // Specializations Section
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Specializations',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: colors.fg,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (_specializations.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Wrap(
                        key: const Key('specializations-wrap'),
                        spacing: 8,
                        runSpacing: 4,
                        children: _specializations.map((spec) {
                          return Chip(
                            key: Key('chip-spec-$spec'),
                            label: Text(spec),
                            labelStyle: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: colors.fg,
                            ),
                            backgroundColor: colors.neutralSoft,
                            side: BorderSide(color: colors.border),
                            deleteIcon: Icon(Icons.close, size: 16, color: colors.fgMuted),
                            onDeleted: () => _removeSpecialization(spec),
                          );
                        }).toList(),
                      ),
                    ),
                  TextFormField(
                    controller: _specializationInputController,
                    decoration: InputDecoration(
                      labelText: 'Add Specialization',
                      hintText: 'e.g. Wildlife, Hiking, Cultural',
                      prefixIcon: const Icon(Icons.star_outline),
                      border: const OutlineInputBorder(),
                      suffixIcon: IconButton(
                        key: const Key('add-specialization-btn'),
                        icon: const Icon(Icons.add_circle_outline),
                        tooltip: 'Add Specialization',
                        onPressed: () => _addSpecialization(),
                      ),
                    ),
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (v) => _addSpecialization(v),
                  ),
                  if (_specializationError != null)
                    Padding(
                      padding: EdgeInsets.only(top: 4),
                      child: Text(
                        _specializationError!,
                        style: TextStyle(color: colors.danger, fontSize: 12),
                      ),
                    ),
                ],
              ),
              if (_profileError != null) ...[
                SizedBox(height: 10),
                Text(_profileError!,
                    style: TextStyle(color: colors.danger, fontSize: 13)),
              ],
              if (_profileSuccess != null) ...[
                const SizedBox(height: 10),
                Text(_profileSuccess!,
                    style: TextStyle(
                        color: colors.brandText,
                        fontSize: 13,
                        fontWeight: FontWeight.bold)),
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
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
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
                validator: (v) =>
                    v == null || v.isEmpty ? 'Current password is required' : null,
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
                  if (v.length < 8) return 'Password must be at least 8 characters';
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
                validator: (v) =>
                    v == null || v.isEmpty ? 'Please confirm new password' : null,
              ),
              if (_passwordError != null) ...[
                SizedBox(height: 10),
                Text(_passwordError!,
                    style: TextStyle(color: colors.danger, fontSize: 13)),
              ],
              if (_passwordSuccess != null) ...[
                const SizedBox(height: 10),
                Text(_passwordSuccess!,
                    style: TextStyle(
                        color: colors.brandText,
                        fontSize: 13,
                        fontWeight: FontWeight.bold)),
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
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
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
                  'Delete Profile',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: colors.dangerFg,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'This permanently removes your Tour Guide profile. You cannot delete your profile while tours are assigned to you.',
                  style: TextStyle(fontSize: 13, color: colors.dangerFg),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  icon: const Icon(Icons.delete_forever, size: 18),
                  label: const Text('Delete Profile'),
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
    );
  }
}
