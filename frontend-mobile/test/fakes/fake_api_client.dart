import 'package:trailwise_mobile/api/api_client.dart';

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
