import 'package:flutter/material.dart';

/// Design tokens ported from frontend-web/src/index.css.
class Brand {
  static const c50 = Color(0xFFECFDF7);
  static const c100 = Color(0xFFD1FAEC);
  static const c200 = Color(0xFFA5F2DC);
  static const c300 = Color(0xFF6DE3C8);
  static const c400 = Color(0xFF38CCB0);
  static const c500 = Color(0xFF1CAD95);
  static const c600 = Color(0xFF0F8A79);
  static const c700 = Color(0xFF0F6E63);
  static const c800 = Color(0xFF10574F);
  static const c900 = Color(0xFF0C3F3A);
  static const c950 = Color(0xFF052624);

  static const accent400 = Color(0xFFFBBF5C);
  static const accent500 = Color(0xFFF5A524);
  static const accent600 = Color(0xFFDD8C0F);
  static const accent700 = Color(0xFFB76F0A);
}

class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// Standard page padding.
  static const EdgeInsets page = EdgeInsets.all(lg);
}

class AppRadius {
  static const double card = 12;
  static const double input = 10;
  static const double badge = 999;
}

/// Semantic colours that don't exist in Material's ColorScheme
/// (success / warning / danger / info / orange / neutral soft+fg pairs).
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.surface,
    required this.surfaceRaised,
    required this.surfaceSunken,
    required this.border,
    required this.fg,
    required this.fgMuted,
    required this.success,
    required this.successSoft,
    required this.successFg,
    required this.warning,
    required this.warningSoft,
    required this.warningFg,
    required this.danger,
    required this.dangerSoft,
    required this.dangerFg,
    required this.info,
    required this.infoSoft,
    required this.infoFg,
    required this.orangeSoft,
    required this.orangeFg,
    required this.neutralSoft,
    required this.neutralFg,
    required this.brandSoft,
    required this.brandFg,
    required this.brandText,
  });

  final Color surface;
  final Color surfaceRaised;
  final Color surfaceSunken;
  final Color border;
  final Color fg;
  final Color fgMuted;
  final Color success;
  final Color successSoft;
  final Color successFg;
  final Color warning;
  final Color warningSoft;
  final Color warningFg;
  final Color danger;
  final Color dangerSoft;
  final Color dangerFg;
  final Color info;
  final Color infoSoft;
  final Color infoFg;
  final Color orangeSoft;
  final Color orangeFg;
  final Color neutralSoft;
  final Color neutralFg;
  final Color brandSoft;
  final Color brandFg;
  final Color brandText;

  static const light = AppColors(
    surface: Color(0xFFFFFFFF),
    surfaceRaised: Color(0xFFFFFFFF),
    surfaceSunken: Color(0xFFF8FAFC),
    border: Color(0xFFE2E8F0),
    fg: Color(0xFF0F172A),
    fgMuted: Color(0xFF475569),
    success: Color(0xFF15803D),
    successSoft: Color(0xFFDCFCE7),
    successFg: Color(0xFF14532D),
    warning: Color(0xFFB45309),
    warningSoft: Color(0xFFFEF3C7),
    warningFg: Color(0xFF78350F),
    danger: Color(0xFFDC2626),
    dangerSoft: Color(0xFFFEE2E2),
    dangerFg: Color(0xFF991B1B),
    info: Color(0xFF2563EB),
    infoSoft: Color(0xFFDBEAFE),
    infoFg: Color(0xFF1E3A8A),
    orangeSoft: Color(0xFFFFEDD5),
    orangeFg: Color(0xFF9A3412),
    neutralSoft: Color(0xFFF1F5F9),
    neutralFg: Color(0xFF334155),
    brandSoft: Color(0xFFD1FAEC),
    brandFg: Color(0xFF0C3F3A),
    brandText: Color(0xFF0F6E63),
  );

  static const dark = AppColors(
    surface: Color(0xFF0E1513),
    surfaceRaised: Color(0xFF16201E),
    surfaceSunken: Color(0xFF0A100F),
    border: Color(0xFF2A3835),
    fg: Color(0xFFE8F0EE),
    fgMuted: Color(0xFFA3B5B1),
    success: Color(0xFF4ADE80),
    successSoft: Color(0xFF0F2E1B),
    successFg: Color(0xFFBBF7D0),
    warning: Color(0xFFFBBF24),
    warningSoft: Color(0xFF33250A),
    warningFg: Color(0xFFFDE68A),
    danger: Color(0xFFF87171),
    dangerSoft: Color(0xFF3A1414),
    dangerFg: Color(0xFFFECACA),
    info: Color(0xFF60A5FA),
    infoSoft: Color(0xFF14233F),
    infoFg: Color(0xFFBFDBFE),
    orangeSoft: Color(0xFF38200D),
    orangeFg: Color(0xFFFED7AA),
    neutralSoft: Color(0xFF1F2A28),
    neutralFg: Color(0xFFCBD5D1),
    brandSoft: Color(0xFF0D3A34),
    brandFg: Color(0xFFA5F2DC),
    brandText: Color(0xFF6DE3C8),
  );

  /// Falls back to the light palette when a test pumps a bare MaterialApp
  /// without [AppTheme].
  static AppColors of(BuildContext context) =>
      Theme.of(context).extension<AppColors>() ?? light;

  @override
  AppColors copyWith() => this;

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) =>
      t < 0.5 ? this : (other as AppColors? ?? this);
}

class AppTheme {
  static final ThemeData light = _build(Brightness.light);
  static final ThemeData dark = _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final c = isDark ? AppColors.dark : AppColors.light;
    final primary = isDark ? Brand.c500 : Brand.c700;
    final onPrimary = isDark ? Brand.c950 : Colors.white;

    final scheme = ColorScheme(
      brightness: brightness,
      primary: primary,
      onPrimary: onPrimary,
      primaryContainer: c.brandSoft,
      onPrimaryContainer: c.brandFg,
      secondary: Brand.accent500,
      onSecondary: Brand.c950,
      secondaryContainer: isDark ? const Color(0xFF38200D) : const Color(0xFFFEF3C7),
      onSecondaryContainer: isDark ? const Color(0xFFFDE68A) : const Color(0xFF78350F),
      tertiary: c.info,
      onTertiary: Colors.white,
      error: c.danger,
      onError: isDark ? Brand.c950 : Colors.white,
      errorContainer: c.dangerSoft,
      onErrorContainer: c.dangerFg,
      surface: c.surface,
      onSurface: c.fg,
      onSurfaceVariant: c.fgMuted,
      surfaceContainerLowest: c.surface,
      surfaceContainerLow: c.surfaceSunken,
      surfaceContainer: c.surfaceSunken,
      surfaceContainerHigh: c.surfaceRaised,
      surfaceContainerHighest: c.neutralSoft,
      outline: c.border,
      outlineVariant: c.border,
      shadow: Colors.black,
      scrim: Colors.black,
      inverseSurface: c.fg,
      onInverseSurface: c.surface,
      inversePrimary: Brand.c300,
      surfaceTint: Colors.transparent,
    );

    final textTheme = _textTheme(c);
    final inputRadius = BorderRadius.circular(AppRadius.input);
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(borderRadius: inputRadius, borderSide: BorderSide(color: color, width: width));

    final buttonShape = RoundedRectangleBorder(borderRadius: inputRadius);
    const buttonPadding = EdgeInsets.symmetric(horizontal: 16, vertical: 12);
    const buttonMin = Size(0, 44);
    const buttonText = TextStyle(fontSize: 15, fontWeight: FontWeight.w600);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: c.surface,
      canvasColor: c.surface,
      dividerColor: c.border,
      extensions: [c],
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: c.surface,
        foregroundColor: c.fg,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        shape: Border(bottom: BorderSide(color: c.border)),
        titleTextStyle: textTheme.titleLarge,
      ),
      cardTheme: CardThemeData(
        color: c.surfaceRaised,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.card),
          side: BorderSide(color: c.border),
        ),
      ),
      dividerTheme: DividerThemeData(color: c.border, space: 1, thickness: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surfaceRaised,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: border(c.border),
        enabledBorder: border(c.border),
        focusedBorder: border(isDark ? Brand.c400 : Brand.c600, 2),
        errorBorder: border(c.danger),
        focusedErrorBorder: border(c.danger, 2),
        disabledBorder: border(c.border),
        labelStyle: TextStyle(color: c.fgMuted),
        hintStyle: TextStyle(color: c.fgMuted),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          disabledBackgroundColor: primary.withValues(alpha: 0.5),
          disabledForegroundColor: onPrimary.withValues(alpha: 0.8),
          minimumSize: buttonMin,
          padding: buttonPadding,
          shape: buttonShape,
          textStyle: buttonText,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: onPrimary,
          elevation: 0,
          minimumSize: buttonMin,
          padding: buttonPadding,
          shape: buttonShape,
          textStyle: buttonText,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          backgroundColor: c.surfaceRaised,
          foregroundColor: c.fg,
          side: BorderSide(color: c.border),
          minimumSize: buttonMin,
          padding: buttonPadding,
          shape: buttonShape,
          textStyle: buttonText,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: c.brandText,
          minimumSize: const Size(0, 40),
          shape: buttonShape,
          textStyle: buttonText,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: c.fgMuted),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: c.neutralSoft,
        selectedColor: c.brandSoft,
        labelStyle: TextStyle(color: c.neutralFg, fontSize: 13, fontWeight: FontWeight.w500),
        secondaryLabelStyle: TextStyle(color: c.brandFg, fontSize: 13, fontWeight: FontWeight.w500),
        side: BorderSide(color: c.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.badge)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: c.surfaceRaised,
        surfaceTintColor: Colors.transparent,
        indicatorColor: c.brandSoft,
        elevation: 0,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected) ? c.brandFg : c.fgMuted,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: states.contains(WidgetState.selected) ? c.brandText : c.fgMuted,
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: c.fg,
        contentTextStyle: TextStyle(color: c.surface, fontSize: 14),
        shape: RoundedRectangleBorder(borderRadius: inputRadius),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: c.surfaceRaised,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card + 4)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.surfaceRaised,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card + 4)),
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: primary),
      listTileTheme: ListTileThemeData(iconColor: c.fgMuted, textColor: c.fg),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? onPrimary : c.fgMuted,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? primary : c.neutralSoft,
        ),
      ),
    );
  }

  /// Type scale from the web (h1 32 … caption 13), tracking converted to px.
  static TextTheme _textTheme(AppColors c) {
    TextStyle s(double size, double height, FontWeight w, {double letter = 0, Color? color}) =>
        TextStyle(
          fontSize: size,
          height: height,
          fontWeight: w,
          letterSpacing: letter,
          color: color ?? c.fg,
        );

    return TextTheme(
      displaySmall: s(32, 1.15, FontWeight.w700, letter: -0.8),
      headlineMedium: s(24, 1.2, FontWeight.w700, letter: -0.5),
      headlineSmall: s(22, 1.25, FontWeight.w700, letter: -0.4),
      titleLarge: s(20, 1.3, FontWeight.w700, letter: -0.3),
      titleMedium: s(16, 1.4, FontWeight.w600),
      titleSmall: s(14, 1.4, FontWeight.w600),
      bodyLarge: s(18, 1.6, FontWeight.w400),
      bodyMedium: s(15, 1.55, FontWeight.w400),
      bodySmall: s(13, 1.4, FontWeight.w400, color: c.fgMuted),
      labelLarge: s(15, 1.3, FontWeight.w600),
      labelMedium: s(13, 1.3, FontWeight.w500),
      labelSmall: s(12, 1.3, FontWeight.w700, letter: 1),
    );
  }
}
