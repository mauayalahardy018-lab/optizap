import 'package:flutter_test/flutter_test.dart';
import 'package:optizap_mobile/inventory.dart';

void main() {
  test('rejects invalid and out-of-stock movements', () {
    expect(validateMovement('', 1, 3), isNotNull);
    expect(validateMovement('0', 1, 3), isNotNull);
    expect(validateMovement('1.5', 1, 3), isNotNull);
    expect(validateMovement('4', -1, 3), isNotNull);
    expect(validateMovement('2', -1, 3), isNull);
    expect(validateMovement('2', 1, 0), isNull);
  });
}
