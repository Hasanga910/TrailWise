import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/guides/create_guide_screen.dart';
import 'package:trailwise_mobile/guides/edit_guide_screen.dart';
import 'package:trailwise_mobile/guides/guide_list_screen.dart';
import 'package:trailwise_mobile/models/guide.dart';

import '../fakes/fake_api_client.dart';

class _MockAuthProvider extends ChangeNotifier implements AuthProvider {
  _MockAuthProvider(this.user, this._apiClient);

  final ApiClient _apiClient;

  @override
  CurrentUser? user;

  @override
  AuthStatus status = AuthStatus.authenticated;

  @override
  ApiClient get apiClient => _apiClient;

  @override
  String? errorMessage;

  @override
  Future<bool> login(String email, String password) async => true;

  @override
  Future<bool> register(String name, String email, String password) async =>
      true;

  @override
  Future<void> restoreSession() async {}

  @override
  Future<void> logout() async {}
}

void main() {
  final opsUser = CurrentUser(
    id: 'user-ops',
    name: 'Ops Manager',
    email: 'ops@trailwise.com',
    role: 'OperationsManager',
  );

  final guideUser = CurrentUser(
    id: 'user-guide',
    name: 'Kasun Guide',
    email: 'kasun@trailwise.com',
    role: 'TourGuide',
  );

  final sampleGuide = Guide(
    id: 'guide-1',
    name: 'Kasun Perera',
    languages: ['English', 'Sinhala'],
    specializations: ['Wildlife', 'Hiking'],
    contactInfo: '+94 77 123 4567',
    userId: 'user-guide',
  );

  group('GuideListScreen', () {
    testWidgets('OperationsManager sees list of guides', (tester) async {
      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides': [
            sampleGuide.toJson(),
            {
              'id': 'guide-2',
              'name': 'Ruwan Silva',
              'languages': ['German'],
              'specializations': ['Cultural'],
              'contactInfo': '+94 77 987 6543',
            },
          ],
        },
      );

      final authProvider = _MockAuthProvider(opsUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: GuideListScreen(apiClient: fakeApi),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Kasun Perera'), findsOneWidget);
      expect(find.text('Ruwan Silva'), findsOneWidget);
      expect(find.text('+94 77 123 4567'), findsOneWidget);
      expect(find.text('Wildlife'), findsOneWidget);
      expect(find.text('Add Guide'), findsOneWidget);
    });

    testWidgets('TourGuide cannot access GuideListScreen', (tester) async {
      final fakeApi = FakeApiClient();
      final authProvider = _MockAuthProvider(guideUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: GuideListScreen(apiClient: fakeApi),
          ),
        ),
      );

      await tester.pump();

      expect(find.textContaining('Access denied'), findsOneWidget);
      expect(find.text('Kasun Perera'), findsNothing);
    });
  });

  group('CreateGuideScreen', () {
    testWidgets('OperationsManager creates guide with validation', (tester) async {
      final fakeApi = FakeApiClient(
        postResponses: {
          '/api/guides': sampleGuide.toJson(),
        },
      );

      final authProvider = _MockAuthProvider(opsUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: CreateGuideScreen(apiClient: fakeApi),
          ),
        ),
      );

      // Try empty submit
      await tester.tap(find.text('Create Guide Profile'));
      await tester.pump();

      expect(find.text('Guide name is required.'), findsOneWidget);

      // Enter valid fields
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Guide Name *'),
        'Kasun Perera',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Contact Information'),
        '+94 77 123 4567',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Languages (comma-separated)'),
        'English, Sinhala',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Specializations (comma-separated)'),
        'Wildlife, Hiking',
      );

      await tester.tap(find.text('Create Guide Profile'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(fakeApi.postCalls.length, 1);
      expect(fakeApi.postCalls.first['path'], '/api/guides');
      expect(fakeApi.postCalls.first['body']['name'], 'Kasun Perera');
    });

    testWidgets('TourGuide cannot access CreateGuideScreen', (tester) async {
      final fakeApi = FakeApiClient();
      final authProvider = _MockAuthProvider(guideUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: CreateGuideScreen(apiClient: fakeApi),
          ),
        ),
      );

      await tester.pump();
      expect(find.textContaining('Access denied'), findsOneWidget);
    });
  });

  group('EditGuideScreen', () {
    testWidgets('pre-fills existing values and updates guide', (tester) async {
      final fakeApi = FakeApiClient(
        putResponses: {
          '/api/guides/guide-1': sampleGuide.toJson(),
        },
      );

      final authProvider = _MockAuthProvider(opsUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: EditGuideScreen(guide: sampleGuide, apiClient: fakeApi),
          ),
        ),
      );

      expect(find.text('Kasun Perera'), findsOneWidget);
      expect(find.text('+94 77 123 4567'), findsOneWidget);

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Guide Name *'),
        'Kasun Perera Senior',
      );

      await tester.tap(find.text('Save Changes'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(fakeApi.putCalls.length, 1);
      expect(fakeApi.putCalls.first['path'], '/api/guides/guide-1');
      expect(fakeApi.putCalls.first['body']['name'], 'Kasun Perera Senior');
    });

    testWidgets('TourGuide cannot access EditGuideScreen', (tester) async {
      final fakeApi = FakeApiClient();
      final authProvider = _MockAuthProvider(guideUser, fakeApi);

      await tester.pumpWidget(
        ChangeNotifierProvider<AuthProvider>.value(
          value: authProvider,
          child: MaterialApp(
            home: EditGuideScreen(guide: sampleGuide, apiClient: fakeApi),
          ),
        ),
      );

      await tester.pump();
      expect(find.textContaining('Access denied'), findsOneWidget);
    });
  });
}
