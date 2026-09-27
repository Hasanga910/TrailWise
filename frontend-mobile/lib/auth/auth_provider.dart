import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/api_client.dart';
import 'current_user.dart';

enum AuthStatus { unknown, authenticating, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  static const _tokenKey = 'trailwise_token';

  final ApiClient _apiClient;
  final FlutterSecureStorage _storage;

  AuthStatus status = AuthStatus.unknown;
  CurrentUser? user;
  String? errorMessage;

  AuthProvider({ApiClient? apiClient, FlutterSecureStorage? storage})
      : _apiClient = apiClient ?? ApiClient(),
        _storage = storage ?? const FlutterSecureStorage();

  ApiClient get apiClient => _apiClient;

  Future<void> restoreSession() async {
    String? token;
    try {
      token = await _storage.read(key: _tokenKey);
    } catch (_) {
      token = null;
    }

    if (token == null) {
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }

    _apiClient.setToken(token);
    try {
      final me = await _apiClient.get('/api/auth/me');
      user = CurrentUser.fromJson(me as Map<String, dynamic>);
      status = AuthStatus.authenticated;
    } catch (_) {
      try {
        await _storage.delete(key: _tokenKey);
      } catch (_) {
        // Best-effort cleanup; nothing more we can do if secure storage is unavailable.
      }
      _apiClient.setToken(null);
      status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> register(String name, String email, String password) async {
    return _authenticate(() => _apiClient.post('/api/auth/register', {
          'name': name,
          'email': email,
          'password': password,
        }));
  }

  Future<bool> login(String email, String password) async {
    return _authenticate(() => _apiClient.post('/api/auth/login', {
          'email': email,
          'password': password,
        }));
  }

  Future<bool> _authenticate(Future<Map<String, dynamic>> Function() request) async {
    status = AuthStatus.authenticating;
    errorMessage = null;
    notifyListeners();

    try {
      final response = await request();
      final token = response['token'] as String;
      await _storage.write(key: _tokenKey, value: token);
      _apiClient.setToken(token);
      user = CurrentUser.fromJson(response['user'] as Map<String, dynamic>);
      status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      errorMessage = e.message;
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    } catch (_) {
      errorMessage = 'Could not reach the server. Please try again.';
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
    _apiClient.setToken(null);
    user = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
