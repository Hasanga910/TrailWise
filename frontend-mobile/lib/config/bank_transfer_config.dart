class BankTransferConfig {
  static const String bankName = String.fromEnvironment(
    'BANK_TRANSFER_BANK_NAME',
    defaultValue: 'TrailWise Demo Bank',
  );

  static const String accountName = String.fromEnvironment(
    'BANK_TRANSFER_ACCOUNT_NAME',
    defaultValue: 'TrailWise Tours',
  );

  static const String accountNumber = String.fromEnvironment(
    'BANK_TRANSFER_ACCOUNT_NUMBER',
    defaultValue: '1234567890',
  );

  static const String branch = String.fromEnvironment(
    'BANK_TRANSFER_BRANCH',
    defaultValue: 'Colombo',
  );
}
