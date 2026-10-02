import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/models/itinerary_step.dart';

class FakeApiClient extends ApiClient {
  FakeApiClient({
    this.getResponses = const {},
    this.postResponses = const {},
    this.patchResponses = const {},
    this.putResponses = const {},
    this.getError,
    this.postError,
    this.patchError,
    this.putError,
    this.deleteError,
  });

  final Map<String, dynamic> getResponses;
  final Map<String, dynamic> postResponses;
  final Map<String, dynamic> patchResponses;
  final Map<String, dynamic> putResponses;
  final ApiException? getError;
  final ApiException? postError;
  final ApiException? patchError;
  final ApiException? putError;
  final ApiException? deleteError;

  final List<Map<String, dynamic>> patchCalls = [];
  final List<Map<String, dynamic>> postCalls = [];
  final List<Map<String, dynamic>> putCalls = [];
  final List<String> deleteCalls = [];

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    if (getError != null) throw getError!;
    return getResponses[path];
  }

  @override
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    postCalls.add({'path': path, 'body': body});
    if (postError != null) throw postError!;
    return (postResponses[path] as Map<String, dynamic>?) ?? <String, dynamic>{};
  }

  @override
  Future<List<ItineraryStep>> setItinerary(
    String bookingId,
    List<Map<String, dynamic>> steps,
  ) async {
    final path = '/api/bookings/$bookingId/itinerary';
    postCalls.add({'path': path, 'body': {'steps': steps}});
    if (postError != null) throw postError!;
    final resp = postResponses[path];
    if (resp is List) {
      return resp
          .whereType<Map<String, dynamic>>()
          .map(ItineraryStep.fromJson)
          .toList();
    }
    return steps.map((s) => ItineraryStep(
      id: 'step-${s['dayNumber']}',
      bookingId: bookingId,
      dayNumber: (s['dayNumber'] as num).toInt(),
      activity: s['activity'] as String,
      location: s['location'] as String,
      startTime: s['startTime'] as String,
    )).toList();
  }

  @override
  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    patchCalls.add({'path': path, 'body': body});
    if (patchError != null) throw patchError!;
    return patchResponses[path];
  }

  @override
  Future<dynamic> put(String path, Map<String, dynamic> body) async {
    putCalls.add({'path': path, 'body': body});
    if (putError != null) throw putError!;
    return putResponses[path] ?? body;
  }

  @override
  Future<dynamic> delete(String path) async {
    deleteCalls.add(path);
    if (deleteError != null) throw deleteError!;
    return null;
  }

  @override
  Future<dynamic> postMultipart(
    String path, {
    required Map<String, String> fields,
    required List<int> fileBytes,
    required String filename,
    String fileFieldName = 'bankSlip',
  }) async {
    if (postError != null) throw postError!;
    return postResponses[path];
  }
}
