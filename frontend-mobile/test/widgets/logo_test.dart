import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/theme/app_theme.dart';
import 'package:trailwise_mobile/widgets/widgets.dart';

String _asset(WidgetTester tester) {
  final image = tester.widget<Image>(find.byType(Image));
  return ((image.image) as AssetImage).assetName;
}

void main() {
  testWidgets('Logo uses the dark wordmark in dark mode and light otherwise', (tester) async {
    await tester.pumpWidget(MaterialApp(theme: AppTheme.light, home: const Scaffold(body: Logo())));
    expect(_asset(tester), 'assets/branding/logo-wordmark.png');
    await tester.pumpWidget(MaterialApp(theme: AppTheme.dark, home: const Scaffold(body: Logo())));
    await tester.pumpAndSettle();
    expect(_asset(tester), 'assets/branding/logo-wordmark-dark.png');
  });

  testWidgets('LogoMark picks the matching mark and carries a semantics label', (tester) async {
    await tester.pumpWidget(MaterialApp(theme: AppTheme.light, home: const Scaffold(body: LogoMark())));
    expect(_asset(tester), 'assets/branding/logo-mark.png');
    expect(find.bySemanticsLabel('TrailWise'), findsOneWidget);
    await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light, home: const Scaffold(body: LogoMark(onDark: true))));
    expect(_asset(tester), 'assets/branding/logo-mark-dark.png');
  });
}
