/// Whole-dollar price with thousands separators, e.g. "$1,250" (same as the
/// web `formatPrice`; the app shows prices in dollars everywhere).
String formatPrice(num amount) {
  final digits = amount.round().abs().toString();
  final grouped = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) grouped.write(',');
    grouped.write(digits[i]);
  }
  return '${amount < 0 ? '-' : ''}\$$grouped';
}

String pluralize(int count, String singular, [String? plural]) =>
    '$count ${count == 1 ? singular : (plural ?? '${singular}s')}';
