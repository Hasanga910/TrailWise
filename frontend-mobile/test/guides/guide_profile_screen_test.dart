import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:trailwise_mobile/api/api_client.dart';
import 'package:trailwise_mobile/auth/auth_provider.dart';
import 'package:trailwise_mobile/auth/current_user.dart';
import 'package:trailwise_mobile/guides/guide_profile_screen.dart';

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

  bool loggedOut = false;

  @override
  void updateUser(CurrentUser updated) {
    user = updated;
    notifyListeners();
  }

  @override
  Future<bool> login(String email, String password) async => true;

  @override
  Future<bool> register(String name, String email, String password) async => true;

  @override
  Future<void> restoreSession() async {}

  @override
  Future<void> logout() async {
    loggedOut = true;
    user = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}

Map<String, dynamic> _sampleProfileJson({
  String id = 'guide-123',
  String userId = 'user-456',
  String name = 'Kasun Perera',
  String email = 'kasun@trailwise.local',
  String contactInfo = '+94771234567',
  List<String> languages = const ['English', 'Sinhala'],
  List<String> specializations = const ['Wildlife', 'Hiking'],
}) =>
    {
      'id': id,
      'userId': userId,
      'name': name,
      'email': email,
      'contactInfo': contactInfo,
      'languages': languages,
      'specializations': specializations,
    };

Widget _buildScreen(ApiClient apiClient, AuthProvider authProvider) {
  return ChangeNotifierProvider<AuthProvider>.value(
    value: authProvider,
    child: MaterialApp(
      home: GuideProfileScreen(apiClient: apiClient),
    ),
  );
}

void _setViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
}

void main() {
  group('GuideProfileScreen Searchable Language Picker & Settings', () {
    // 1. tapping language field opens selector
    testWidgets('1. tapping language field opens selector', (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      final addLangBtn = find.byKey(const Key('add-language-btn'));
      await tester.ensureVisible(addLangBtn);
      await tester.tap(addLangBtn);
      await tester.pumpAndSettle();

      expect(find.text('Select Languages'), findsOneWidget);
    });

    // 2. search field is visible
    testWidgets('2. search field is visible in language selector',
        (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('add-language-btn')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('language-search-field')), findsOneWidget);
      expect(find.text('Search languages...'), findsOneWidget);
    });

    // 3. typing filters languages
    testWidgets('3. typing filters languages case-insensitively',
        (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('add-language-btn')));
      await tester.pumpAndSettle();

      final searchField = find.byKey(const Key('language-search-field'));
      await tester.enterText(searchField, 'ger');
      await tester.pumpAndSettle();

      expect(find.text('German'), findsOneWidget);
      expect(find.text('French'), findsNothing);
    });

    // 4. selecting language adds it
    testWidgets('4. selecting language adds it immediately', (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('add-language-btn')));
      await tester.pumpAndSettle();

      final searchField = find.byKey(const Key('language-search-field'));
      await tester.enterText(searchField, 'ger');
      await tester.pumpAndSettle();

      // Tap German tile
      await tester.tap(find.byKey(const Key('checkbox-lang-German')));
      await tester.pumpAndSettle();

      // Tap Done
      await tester.tap(find.byKey(const Key('done-languages-btn')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('chip-lang-German')), findsOneWidget);
    });

    // 5. selected language shows check
    testWidgets('5. selected language shows checkmark/checkbox',
        (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(languages: ['English', 'German']),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('add-language-btn')));
      await tester.pumpAndSettle();

      final germanTile = tester.widget<CheckboxListTile>(
        find.byKey(const Key('checkbox-lang-German')),
      );
      expect(germanTile.value, isTrue);

      final frenchTile = tester.widget<CheckboxListTile>(
        find.byKey(const Key('checkbox-lang-French')),
      );
      expect(frenchTile.value, isFalse);
    });

    // 6. duplicate cannot occur
    testWidgets('6. duplicate language cannot occur', (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(languages: ['English']),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('chip-lang-English')), findsOneWidget);

      await tester.tap(find.byKey(const Key('add-language-btn')));
      await tester.pumpAndSettle();

      // Tapping already-selected English unchecks it rather than duplicating
      await tester.tap(find.byKey(const Key('checkbox-lang-English')));
      await tester.pumpAndSettle();

      // Tap it again to re-check
      await tester.tap(find.byKey(const Key('checkbox-lang-English')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('done-languages-btn')));
      await tester.pumpAndSettle();

      // Exactly 1 English chip exists
      expect(find.byKey(const Key('chip-lang-English')), findsOneWidget);
    });

    // 7. chip removal works
    testWidgets('7. chip removal works', (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('chip-lang-English')), findsOneWidget);

      final englishChipDelete = find.descendant(
        of: find.byKey(const Key('chip-lang-English')),
        matching: find.byIcon(Icons.close),
      );
      await tester.tap(englishChipDelete);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('chip-lang-English')), findsNothing);
      expect(find.byKey(const Key('chip-lang-Sinhala')), findsOneWidget);
    });

    // 8. no separate Add action for languages
    testWidgets('8. no separate Add action for languages inside selector',
        (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('add-language-btn')));
      await tester.pumpAndSettle();

      // In the modal, only Done exists, no Add button
      expect(find.byKey(const Key('done-languages-btn')), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Add'), findsNothing);
      expect(find.widgetWithText(ElevatedButton, 'Add'), findsNothing);
    });

    // 9. save sends List<String>
    testWidgets('9. save sends List<String> directly in API request',
        (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
        putResponses: {
          '/api/guides/me/profile': _sampleProfileJson(
            name: 'Kasun Updated',
            languages: ['Sinhala', 'German'],
            specializations: ['Hiking', 'Adventure'],
          ),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      // Remove English
      final removeEnglish = find.descendant(
        of: find.byKey(const Key('chip-lang-English')),
        matching: find.byIcon(Icons.close),
      );
      await tester.tap(removeEnglish);
      await tester.pumpAndSettle();

      // Add German
      await tester.tap(find.byKey(const Key('add-language-btn')));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('language-search-field')),
        'German',
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('checkbox-lang-German')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('done-languages-btn')));
      await tester.pumpAndSettle();

      // Remove Wildlife
      final removeWildlife = find.descendant(
        of: find.byKey(const Key('chip-spec-Wildlife')),
        matching: find.byIcon(Icons.close),
      );
      await tester.tap(removeWildlife);
      await tester.pumpAndSettle();

      // Add Adventure
      final specField = find.widgetWithText(TextFormField, 'Add Specialization');
      await tester.ensureVisible(specField);
      await tester.enterText(specField, 'Adventure');
      await tester.tap(find.byKey(const Key('add-specialization-btn')));
      await tester.pumpAndSettle();

      // Tap Save Profile
      final saveButton = find.widgetWithText(FilledButton, 'Save Profile');
      await tester.ensureVisible(saveButton);
      await tester.tap(saveButton);
      await tester.pumpAndSettle();

      expect(find.text('Profile updated successfully!'), findsOneWidget);
      expect(fakeApi.putCalls, isNotEmpty);
      final call =
          fakeApi.putCalls.firstWhere((c) => c['path'] == '/api/guides/me/profile');
      expect(call['body']['languages'], equals(['Sinhala', 'German']));
      expect(call['body']['languages'], isA<List<String>>());
      expect(call['body']['specializations'], equals(['Hiking', 'Adventure']));
    });

    testWidgets('specialization tag can be added and duplicate blocked',
        (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      final specField = find.widgetWithText(TextFormField, 'Add Specialization');
      await tester.ensureVisible(specField);
      await tester.enterText(specField, 'wildlife');
      await tester.tap(find.byKey(const Key('add-specialization-btn')));
      await tester.pumpAndSettle();

      expect(find.text('"wildlife" is already added.'), findsOneWidget);
    });

    testWidgets('Change Password calls /api/auth/me/password', (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      final currentPassField =
          find.widgetWithText(TextFormField, 'Current Password');
      final newPassField = find.widgetWithText(TextFormField, 'New Password');
      final confirmPassField =
          find.widgetWithText(TextFormField, 'Confirm New Password');

      await tester.ensureVisible(currentPassField);
      await tester.enterText(currentPassField, 'OldPassword123');
      await tester.enterText(newPassField, 'NewSecretPass123');
      await tester.enterText(confirmPassField, 'NewSecretPass123');

      final updatePassBtn =
          find.widgetWithText(FilledButton, 'Update Password');
      await tester.ensureVisible(updatePassBtn);
      await tester.tap(updatePassBtn);
      await tester.pumpAndSettle();

      expect(find.text('Password updated successfully!'), findsOneWidget);
      final passCall = fakeApi.putCalls
          .firstWhere((c) => c['path'] == '/api/auth/me/password');
      expect(passCall['body']['currentPassword'], 'OldPassword123');
      expect(passCall['body']['newPassword'], 'NewSecretPass123');
    });

    testWidgets('Delete Profile shows confirmation dialog', (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      final deleteProfileBtn =
          find.widgetWithText(FilledButton, 'Delete Profile');
      await tester.ensureVisible(deleteProfileBtn);
      await tester.tap(deleteProfileBtn);
      await tester.pumpAndSettle();

      expect(find.text('Delete Tour Guide Profile'), findsOneWidget);
      expect(
          find.text(
              'Are you sure you want to delete your Tour Guide profile? You cannot delete your profile while tours are assigned to you.'),
          findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Delete'), findsOneWidget);
    });

    testWidgets('Successful delete calls API and logs user out',
        (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      final deleteProfileBtn =
          find.widgetWithText(FilledButton, 'Delete Profile');
      await tester.ensureVisible(deleteProfileBtn);
      await tester.tap(deleteProfileBtn);
      await tester.pumpAndSettle();

      final confirmDeleteBtn = find.widgetWithText(FilledButton, 'Delete');
      await tester.tap(confirmDeleteBtn);
      await tester.pumpAndSettle();

      expect(fakeApi.deleteCalls, contains('/api/guides/me/profile'));
      expect(mockAuth.loggedOut, isTrue);
    });

    testWidgets('Assigned-tour conflict shows exact conflict message',
        (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getResponses: {
          '/api/guides/me': _sampleProfileJson(),
        },
        deleteError: ApiException(
          409,
          'Guide profile cannot be deleted while assigned tours exist.',
        ),
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      final deleteProfileBtn =
          find.widgetWithText(FilledButton, 'Delete Profile');
      await tester.ensureVisible(deleteProfileBtn);
      await tester.tap(deleteProfileBtn);
      await tester.pumpAndSettle();

      final confirmDeleteBtn = find.widgetWithText(FilledButton, 'Delete');
      await tester.tap(confirmDeleteBtn);
      await tester.pumpAndSettle();

      expect(
          find.text(
              'Your profile cannot be deleted because you still have assigned tours.'),
          findsOneWidget);
      expect(mockAuth.loggedOut, isFalse);
    });

    testWidgets('Profile load failure displays error and Retry button',
        (tester) async {
      _setViewport(tester);

      final fakeApi = FakeApiClient(
        getError: ApiException(500, 'Server unavailable'),
      );
      final mockAuth = _MockAuthProvider(
        CurrentUser(
            id: 'user-456',
            name: 'Kasun Perera',
            email: 'kasun@trailwise.local',
            role: 'TourGuide'),
        fakeApi,
      );

      await tester.pumpWidget(_buildScreen(fakeApi, mockAuth));
      await tester.pumpAndSettle();

      expect(find.text('Server unavailable'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Retry'), findsOneWidget);
    });
  });
}
