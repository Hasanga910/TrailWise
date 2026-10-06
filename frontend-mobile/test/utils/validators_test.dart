import 'package:flutter_test/flutter_test.dart';
import 'package:trailwise_mobile/utils/validators.dart';

void main() {
  const message = 'Enter a valid phone number, for example +94 77 123 4567';

  test('validatePhone accepts the web pattern', () {
    expect(validatePhone('+94 77 123 4567'), isNull);
    expect(validatePhone('(011) 234-5678'), isNull);
  });

  test('validatePhone rejects empty, short and lettered values', () {
    expect(validatePhone(null), message);
    expect(validatePhone(''), message);
    expect(validatePhone('12345'), message);
    expect(validatePhone('077abc4567'), message);
  });

  test('validateOptionalPhone allows empty but not malformed values', () {
    expect(validateOptionalPhone(''), isNull);
    expect(validateOptionalPhone('  '), isNull);
    expect(validateOptionalPhone('abc'), message);
    expect(validateOptionalPhone('+94771234567'), isNull);
  });
}
