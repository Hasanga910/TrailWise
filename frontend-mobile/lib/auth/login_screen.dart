import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'auth_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/widgets.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit(AuthProvider auth) async {
    if (!_formKey.currentState!.validate()) return;
    await auth.login(_emailController.text.trim(), _passwordController.text);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isLoading = auth.status == AuthStatus.authenticating;

    return AuthScaffold(
      appBarTitle: 'TrailWise Login',
      tagline: 'Your next Sri Lankan adventure starts here.',
      heading: 'Welcome back',
      subtitle: 'Log in to your TrailWise account.',
      footer: TextButton(
        onPressed: isLoading
            ? null
            : () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const RegisterScreen()),
                ),
        child: const Text(
          "Don't have an account? Register as a Traveler",
          textAlign: TextAlign.center,
        ),
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
              validator: (value) =>
                  (value == null || !value.contains('@')) ? 'Enter a valid email' : null,
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _passwordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password'),
              validator: (value) =>
                  (value == null || value.isEmpty) ? 'Password is required' : null,
            ),
            const SizedBox(height: AppSpacing.lg),
            if (auth.errorMessage != null)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: Text(
                  auth.errorMessage!,
                  style: TextStyle(color: AppColors.of(context).danger),
                ),
              ),
            AppButton(
              label: 'Log in',
              expand: true,
              loading: isLoading,
              onPressed: isLoading ? null : () => _submit(auth),
            ),
          ],
        ),
      ),
    );
  }
}
