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
  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    if (patchError != null) throw patchError!;
    return patchResponses[path] as Map<String, dynamic>;
  }
}
