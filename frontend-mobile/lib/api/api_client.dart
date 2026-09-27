import 'dart:convert';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;

import '../models/assigned_tour.dart';
import '../models/guide.dart';
import '../models/guide_availability.dart';
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

  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Future<dynamic> put(String path, Map<String, dynamic> body) async {
    final response = await http.put(
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

  Future<List<Guide>> getGuides({String? specialization, String? language}) async {
    final query = <String, dynamic>{};
    if (specialization != null && specialization.isNotEmpty) {
      query['specialization'] = specialization;
    }
    if (language != null && language.isNotEmpty) {
      query['language'] = language;
    }
    final response = await get('/api/guides', query: query);
    if (response is List) {
      return response
          .whereType<Map<String, dynamic>>()
          .map(Guide.fromJson)
          .toList();
    }
    return [];
  }

  Future<Guide> getGuideById(String id) async {
    final response = await get('/api/guides/$id');
    return Guide.fromJson(response as Map<String, dynamic>);
  }

  Future<Guide> createGuide({
    required String name,
    List<String> languages = const [],
    List<String> specializations = const [],
    required String contactInfo,
    String? userId,
  }) async {
    final body = <String, dynamic>{
      'name': name,
      'languages': languages,
      'specializations': specializations,
      'contactInfo': contactInfo,
      if (userId != null && userId.isNotEmpty) 'userId': userId,
    };
    final response = await post('/api/guides', body);
    return Guide.fromJson(response as Map<String, dynamic>);
  }

  Future<Guide> updateGuide(
    String id, {
    required String name,
    List<String> languages = const [],
    List<String> specializations = const [],
    required String contactInfo,
    String? userId,
  }) async {
    final body = <String, dynamic>{
      'name': name,
      'languages': languages,
      'specializations': specializations,
      'contactInfo': contactInfo,
      if (userId != null && userId.isNotEmpty) 'userId': userId,
    };
    final response = await put('/api/guides/$id', body);
    return Guide.fromJson(response as Map<String, dynamic>);
  }

  Future<List<GuideAvailability>> getGuideAvailability(
    String guideId, {
    String? from,
    String? to,
  }) async {
    final query = <String, dynamic>{};
    if (from != null) query['from'] = from;
    if (to != null) query['to'] = to;
    final response = await get('/api/guides/$guideId/availability', query: query);
    if (response is List) {
      return response
          .whereType<Map<String, dynamic>>()
          .map(GuideAvailability.fromJson)
          .toList();
    }
    return [];
  }

  Future<List<GuideAvailability>> updateGuideAvailability(
    String guideId,
    List<Map<String, dynamic>> dates,
  ) async {
    final response = await put('/api/guides/$guideId/availability', {
      'dates': dates,
    });
    if (response is List) {
      return response
          .whereType<Map<String, dynamic>>()
          .map(GuideAvailability.fromJson)
          .toList();
    }
    return [];
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

  Future<List<ItineraryStep>> setItinerary(
    String bookingId,
    List<Map<String, dynamic>> steps,
  ) async {
    final response = await post('/api/bookings/$bookingId/itinerary', {
      'steps': steps,
    });
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
