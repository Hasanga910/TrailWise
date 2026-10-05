import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';
import 'package:trailwise_mobile/widgets/widgets.dart';

void main() {
  test('initials uses the first and last word', () {
    expect(UserAvatar.initials('Amal Silva'), 'AS');
    expect(UserAvatar.initials('amal'), 'A');
    expect(UserAvatar.initials('  Amal   de  Silva '), 'AS');
    expect(UserAvatar.initials(''), '?');
  });

  testWidgets('avatar shows initials and is labelled with the name', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(
          body: Center(child: UserAvatar(name: 'Amal Silva')),
        ),
      ),
    );
    expect(find.text('AS'), findsOneWidget);
    expect(find.bySemanticsLabel('Amal Silva'), findsOneWidget);
  });
}
