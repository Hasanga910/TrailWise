import 'package:trailwise_mobile/api/api_client.dart';

class FakeApiClient extends ApiClient {
  FakeApiClient({
    this.getResponses = const {},
    this.postResponses = const {},
    this.getError,
    this.postError,
  });

  final Map<String, dynamic> getResponses;
  final Map<String, dynamic> postResponses;
  final ApiException? getError;
  final ApiException? postError;

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
}
