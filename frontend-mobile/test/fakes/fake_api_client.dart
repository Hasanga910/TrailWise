import 'package:trailwise_mobile/api/api_client.dart';

class FakeApiClient extends ApiClient {
  FakeApiClient({
    this.getResponses = const {},
    this.postResponses = const {},
    this.patchResponses = const {},
    this.getError,
    this.postError,
    this.patchError,
  });

  final Map<String, dynamic> getResponses;
  final Map<String, dynamic> postResponses;
  final Map<String, dynamic> patchResponses;
  final ApiException? getError;
  final ApiException? postError;
  final ApiException? patchError;

  final List<Map<String, dynamic>> patchCalls = [];

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    if (getError != null) throw getError!;
    return getResponses[path];
  }

  @override
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    if (postError != null) throw postError!;
    return postResponses[path] as Map<String, dynamic>;
  }

  @override
  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    patchCalls.add({'path': path, 'body': body});
    if (patchError != null) throw patchError!;
    return patchResponses[path];
  }
}

