import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'auth/auth_provider.dart';
import 'auth/login_screen.dart';
import 'navigation/main_shell.dart';

void main() {
  runApp(const TrailWiseApp());
}

class TrailWiseApp extends StatelessWidget {
  const TrailWiseApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider()..restoreSession(),
      child: MaterialApp(
        title: 'TrailWise',
        theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal)),
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    switch (auth.status) {
      case AuthStatus.unknown:
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      case AuthStatus.authenticated:
        return const MainShell();
      case AuthStatus.authenticating:
      case AuthStatus.unauthenticated:
        return const LoginScreen();
    }
  }
}
