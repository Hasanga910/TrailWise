import 'package:trailwise_mobile/api/api_client.dart';

class FakeApiClient extends ApiClient {
  FakeApiClient({
    this.getResponses = const {},
    this.postResponses = const {},
    this.putResponses = const {},
    this.patchResponses = const {},
    this.getError,
    this.postError,
    this.putError,
    this.patchError,
  });

  final Map<String, dynamic> getResponses;
  final Map<String, dynamic> postResponses;
  final Map<String, dynamic> putResponses;
  final Map<String, dynamic> patchResponses;
  final ApiException? getError;
  final ApiException? postError;
  final ApiException? putError;
  final ApiException? patchError;

  final List<Map<String, dynamic>> getCalls = [];
  final List<Map<String, dynamic>> postCalls = [];
  final List<Map<String, dynamic>> putCalls = [];
  final List<Map<String, dynamic>> patchCalls = [];

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    getCalls.add({'path': path, 'query': query});
    if (getError != null) throw getError!;
    return getResponses[path];
  }

  @override
  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    postCalls.add({'path': path, 'body': body});
    if (postError != null) throw postError!;
    final res = postResponses[path];
    if (res is Map<String, dynamic>) return res;
    return <String, dynamic>{};
  }

  @override
  Future<dynamic> put(String path, Map<String, dynamic> body) async {
    putCalls.add({'path': path, 'body': body});
    if (putError != null) throw putError!;
    return putResponses[path];
  }

  @override
  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    patchCalls.add({'path': path, 'body': body});
    if (patchError != null) throw patchError!;
    return patchResponses[path];
  }
}
