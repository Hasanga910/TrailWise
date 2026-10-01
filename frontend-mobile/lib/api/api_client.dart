import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;

import '../models/assigned_tour.dart';
import '../models/driver_assignment.dart';
import '../models/guide_profile.dart';
import '../models/itinerary_step.dart';

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
  static final String baseUrl = () {
    const envUrl = String.fromEnvironment('API_BASE_URL');
    if (envUrl.isNotEmpty) {
      return envUrl;
    }
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:5080';
    }
    return 'http://localhost:5080';
  }();

  final http.Client _httpClient;
  String? _token;

  ApiClient({http.Client? httpClient}) : _httpClient = httpClient ?? http.Client();

  String? get token => _token;
  Map<String, String> get headers => _headers;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_token != null) 'Authorization': 'Bearer $_token',
  };

  Future<Map<String, dynamic>> post(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _httpClient.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final response = await _httpClient.patch(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> put(String path, Map<String, dynamic> body) async {
    final response = await _httpClient.put(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> delete(String path) async {
    final response = await _httpClient.delete(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
    );
    return _decode(response);
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    final response = await _httpClient.get(_buildUri(path, query), headers: _headers);
    return _decode(response);
  }

  Future<dynamic> postMultipart(
    String path, {
    required Map<String, String> fields,
    required List<int> fileBytes,
    required String filename,
    String fileFieldName = 'bankSlip',
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final request = http.MultipartRequest('POST', uri);
    if (_token != null) {
      request.headers['Authorization'] = 'Bearer $_token';
    }
    request.fields.addAll(fields);
    request.files.add(
      http.MultipartFile.fromBytes(
        fileFieldName,
        fileBytes,
        filename: filename,
      ),
    );

    final streamedResponse = await _httpClient.send(request);
    final response = await http.Response.fromStream(streamedResponse);
    return _decode(response);
  }

  Future<GuideProfile> getGuideProfile() async {
    final response = await get('/api/guides/me');
    return GuideProfile.fromJson(response as Map<String, dynamic>);
  }

  Future<GuideProfile> updateGuideProfile({
    required String name,
    required String email,
    required String contactInfo,
    required List<String> languages,
    required List<String> specializations,
  }) async {
    final response = await put('/api/guides/me/profile', {
      'name': name,
      'email': email,
      'contactInfo': contactInfo,
      'languages': languages,
      'specializations': specializations,
    });
    return GuideProfile.fromJson(response as Map<String, dynamic>);
  }

  Future<void> deleteGuideProfile() async {
    await delete('/api/guides/me/profile');
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await put('/api/auth/me/password', {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
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

  Future<List<DriverAssignment>> getDriverAssignments() async {
    final response = await get('/api/drivers/me/assignments');
    if (response is List) {
      return response
          .whereType<Map<String, dynamic>>()
          .map(DriverAssignment.fromJson)
          .toList();
    }
    return [];
  }

  Future<void> updateGuideTour({
    required String bookingId,
    required bool attended,
    String? notes,
  }) async {
    await patch('/api/bookings/$bookingId/guide-notes', {
      'attended': attended,
      'notes': notes,
    });
  }

  Future<AssignedTour> startTour(String bookingId) async {
    final response = await post('/api/bookings/$bookingId/start-tour', {});
    return AssignedTour.fromJson(response);
  }

  Future<AssignedTour> endTour(String bookingId) async {
    final response = await post('/api/bookings/$bookingId/end-tour', {});
    return AssignedTour.fromJson(response);
  }

  Future<List<ItineraryStep>> getItinerary(String bookingId) async {
    final response = await get('/api/bookings/$bookingId/itinerary');
    if (response is List) {
      return response
          .whereType<Map<String, dynamic>>()
          .map(ItineraryStep.fromJson)
          .toList();
    }
    return [];
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
    return stringParams.isEmpty
        ? uri
        : uri.replace(queryParameters: stringParams);
  }

  dynamic _decode(http.Response response) {
    final isJson = response.headers['content-type']?.contains('json') ?? false;
    final decoded = response.body.isNotEmpty && isJson
        ? jsonDecode(response.body)
        : null;

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
        ? (decoded['title'] ??
                  decoded['detail'] ??
                  decoded['message'] ??
                  'Request failed')
              .toString()
        : 'Request failed with status ${response.statusCode}';
    throw ApiException(response.statusCode, message);
  }

  Future<Map<String, dynamic>> createSupportTicket({
    required String category,
    required String subject,
    required String description,
    String? bookingId,
  }) async {
    return post('/api/support/tickets', {
      'category': category,
      'subject': subject,
      'description': description,
      'bookingId': ?bookingId,
    });
  }

  Future<dynamic> getMySupportTickets({String? status, int page = 1, int pageSize = 10}) async {
    return get('/api/support/tickets/mine', query: {
      'status': ?status,
      'page': page,
      'pageSize': pageSize,
    });
  }

  Future<dynamic> getSupportTicket(String id) async {
    return get('/api/support/tickets/$id');
  }

  Future<Map<String, dynamic>> sendSupportMessage(String id, String message) async {
    return post('/api/support/tickets/$id/messages', {
      'message': message,
    });
  }
}
