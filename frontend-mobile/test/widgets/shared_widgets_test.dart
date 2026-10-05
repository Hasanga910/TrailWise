import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';
import 'package:trailwise_mobile/widgets/widgets.dart';

Widget _wrap(Widget child, {ThemeData? theme}) => MaterialApp(
      theme: theme ?? AppTheme.light,
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('StatusBadge shows readable labels', (tester) async {
    const expected = {
      'PendingApproval': 'Pending Approval',
      'NeedsManualReview': 'Needs Manual Review',
      'PlanProposed': 'Plan Proposed',
      'Confirmed': 'Confirmed',
      'Cancelled': 'Cancelled',
      'Completed': 'Completed',
      'Requested': 'Requested',
    };
    for (final e in expected.entries) {
      await tester.pumpWidget(_wrap(StatusBadge(status: e.key)));
      expect(find.text(e.value), findsOneWidget, reason: e.key);
    }
  });

  test('statusLabel splits unknown CamelCase values', () {
    expect(statusLabel('SomethingNew'), 'Something New');
  });

  testWidgets('StatusBadge uses the web tone colours', (tester) async {
    await tester.pumpWidget(_wrap(const StatusBadge(status: 'PendingApproval')));
    final box = tester.widget<Container>(find.descendant(
        of: find.byType(AppBadge), matching: find.byType(Container)));
    expect((box.decoration as BoxDecoration).color, AppColors.light.warningSoft);
  });

  testWidgets('AppButton variants render as Material buttons and fire taps', (tester) async {
    var taps = 0;
    await tester.pumpWidget(_wrap(Column(children: [
      AppButton(label: 'Primary', onPressed: () => taps++),
      AppButton.secondary(label: 'Secondary', onPressed: () => taps++),
      AppButton.danger(label: 'Danger', onPressed: () => taps++),
    ])));
    expect(find.widgetWithText(FilledButton, 'Primary'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'Secondary'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Danger'), findsOneWidget);
    await tester.tap(find.text('Primary'));
    await tester.tap(find.text('Secondary'));
    await tester.tap(find.text('Danger'));
    expect(taps, 3);
  });

  testWidgets('AppButton loading disables the button', (tester) async {
    await tester.pumpWidget(_wrap(AppButton(label: 'Save', loading: true, onPressed: () {})));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
  });

  testWidgets('EmptyState, LoadingView and SectionHeader render', (tester) async {
    await tester.pumpWidget(_wrap(const Column(children: [
      SectionHeader(title: 'Upcoming', subtitle: '3 tours'),
      Expanded(child: EmptyState(title: 'Nothing here', message: 'Check back later')),
    ])));
    expect(find.text('Upcoming'), findsOneWidget);
    expect(find.text('Nothing here'), findsOneWidget);
    await tester.pumpWidget(_wrap(const LoadingView()));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('ErrorState shows message and Retry calls back', (tester) async {
    var retried = false;
    await tester.pumpWidget(_wrap(ErrorState(message: 'Boom', onRetry: () => retried = true)));
    expect(find.text('Boom'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    expect(retried, isTrue);
  });

  testWidgets('shared widgets do not overflow at 360 dp in dark theme', (tester) async {
    tester.view.physicalSize = const Size(360, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_wrap(
      ListView(children: const [
        AppCard(child: Row(children: [Expanded(child: Text('A very long title that should wrap or ellipsize nicely')), StatusBadge(status: 'NeedsManualReview')])),
        SizedBox(height: 300, child: ErrorState(message: 'Could not load', onRetry: null)),
        SizedBox(height: 300, child: EmptyState(title: 'Empty')),
      ]),
      theme: AppTheme.dark,
    ));
    expect(tester.takeException(), isNull);
  });
}
