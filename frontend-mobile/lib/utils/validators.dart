/// Same rule and message as the web `registerSchema` / profile form.
final RegExp _phonePattern = RegExp(r'^\+?[0-9\s\-()]{7,20}$');

const String phoneErrorMessage = 'Enter a valid phone number, for example +94 77 123 4567';

/// Required phone number (register, driver profile: the API requires it).
String? validatePhone(String? value) {
  final text = value?.trim() ?? '';
  return _phonePattern.hasMatch(text) ? null : phoneErrorMessage;
}

/// Optional phone number (guide profile: the API accepts an empty contact).
String? validateOptionalPhone(String? value) {
  final text = value?.trim() ?? '';
  return text.isEmpty ? null : validatePhone(text);
}
