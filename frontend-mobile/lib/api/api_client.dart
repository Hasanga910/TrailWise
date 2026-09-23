import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/assigned_tour.dart';

class FieldError {
  final String field;
  final String message;

  FieldError(this.field, this.message);

  factory FieldError.fromJson(Map<String, dynamic> json) =>
      FieldError(json['field'] as String, json['message'] as String);
}

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final List<FieldError> fieldErrors;

  ApiException(this.statusCode, this.message, {this.fieldErrors = const []});

  @override
  String toString() => message;
}

class ApiClient {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:5080',
  );

  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final response = await http.patch(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    final response = await http.get(_buildUri(path, query), headers: _headers);
    return _decode(response);
  }

  Future<List<AssignedTour>> getAssignedTours() async {
    final response = await get('/api/guides/me/assigned-tours');
    if (response is List) {
      return response
          .whereType<Map<String, dynamic>>()
          .map(AssignedTour.fromJson)
          .toList();
    }
    return [];
  }

  Future<void> updateGuideTour({
    required String bookingId,
    required bool attended,
    required bool completed,
    String? notes,
  }) async {
    await patch('/api/bookings/$bookingId/guide-notes', {
      'attended': attended,
      'completed': completed,
      'notes': notes,
    });
  }


  Uri _buildUri(String path, [Map<String, dynamic>? query]) {
    final uri = Uri.parse('$baseUrl$path');
    if (query == null || query.isEmpty) {
      return uri;
    }
    final stringParams = <String, String>{};
    query.forEach((key, value) {
      if (value != null) {
        stringParams[key] = value.toString();
      }
    });
    return stringParams.isEmpty ? uri : uri.replace(queryParameters: stringParams);
  }

  dynamic _decode(http.Response response) {
    final isJson = response.headers['content-type']?.contains('json') ?? false;
    final decoded = response.body.isNotEmpty && isJson ? jsonDecode(response.body) : null;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return decoded;
    }

    if (decoded is Map<String, dynamic> && decoded['errors'] is List) {
      final fieldErrors = (decoded['errors'] as List)
          .whereType<Map<String, dynamic>>()
          .map(FieldError.fromJson)
          .toList();
      throw ApiException(
        response.statusCode,
        'Please correct the highlighted fields.',
        fieldErrors: fieldErrors,
      );
    }

    final message = decoded is Map<String, dynamic>
        ? (decoded['title'] ?? decoded['detail'] ?? 'Request failed').toString()
        : 'Request failed with status ${response.statusCode}';
    throw ApiException(response.statusCode, message);
  }
}
