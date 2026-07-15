import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

describe('password hashing', () => {
  it('verifies a correct password', () => {
    const hash = hashPassword('SecretPass1');
    expect(verifyPassword('SecretPass1', hash)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const hash = hashPassword('SecretPass1');
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  it('produces unique salts', () => {
    const a = hashPassword('SamePassword');
    const b = hashPassword('SamePassword');
    expect(a).not.toBe(b);
    expect(verifyPassword('SamePassword', a)).toBe(true);
    expect(verifyPassword('SamePassword', b)).toBe(true);
  });
});
