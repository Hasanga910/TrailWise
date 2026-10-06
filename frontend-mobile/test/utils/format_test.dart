import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/utils/format.dart';

void main() {
  test('formatPrice rounds to whole dollars with thousands separators', () {
    expect(formatPrice(0), r'$0');
    expect(formatPrice(90), r'$90');
    expect(formatPrice(250.4), r'$250');
    expect(formatPrice(999.5), r'$1,000');
    expect(formatPrice(1250), r'$1,250');
    expect(formatPrice(1234567), r'$1,234,567');
    expect(formatPrice(-1250), r'-$1,250');
  });

  test('pluralize', () {
    expect(pluralize(1, 'day'), '1 day');
    expect(pluralize(4, 'day'), '4 days');
  });
}
