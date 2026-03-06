import { EncryptionService } from '../encryption.service';

function createService(overrides: Record<string, string> = {}): EncryptionService {
  const env: Record<string, string> = {
    GITHUB_APP_PRIVATE_KEY: 'test-private-key-for-derivation',
    ...overrides,
  };

  const configService = {
    get: vi.fn().mockImplementation((key: string) => env[key]),
    getOrThrow: vi.fn().mockImplementation((key: string) => {
      if (!(key in env)) throw new Error(`Missing ${key}`);
      return env[key];
    }),
  };

  return new EncryptionService(configService as never);
}

describe('EncryptionService', () => {
  describe('encrypt and decrypt', () => {
    it('should roundtrip encrypt then decrypt', () => {
      const service = createService();
      const plaintext = 'ghs_abc123TokenValue456';

      const encrypted = service.encrypt({ plaintext });
      const decrypted = service.decrypt({ encrypted });

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext', () => {
      const service = createService();
      const plaintext = 'same-input-text';

      const encrypted1 = service.encrypt({ plaintext });
      const encrypted2 = service.encrypt({ plaintext });

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should produce ciphertext that differs from plaintext', () => {
      const service = createService();
      const plaintext = 'my-secret-token';

      const encrypted = service.encrypt({ plaintext });

      expect(encrypted).not.toContain(plaintext);
    });

    it('should use ENCRYPTION_KEY when provided', () => {
      const hexKey = 'a'.repeat(64);
      const service = createService({ ENCRYPTION_KEY: hexKey });
      const plaintext = 'test-value';

      const encrypted = service.encrypt({ plaintext });
      const decrypted = service.decrypt({ encrypted });

      expect(decrypted).toBe(plaintext);
    });

    it('should derive key from GITHUB_APP_PRIVATE_KEY when ENCRYPTION_KEY is absent', () => {
      const service = createService();
      const plaintext = 'derived-key-test';

      const encrypted = service.encrypt({ plaintext });
      const decrypted = service.decrypt({ encrypted });

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const service = createService();
      const plaintext = '';

      const encrypted = service.encrypt({ plaintext });
      const decrypted = service.decrypt({ encrypted });

      expect(decrypted).toBe('');
    });

    it('should handle unicode content', () => {
      const service = createService();
      const plaintext = 'Hello 🔐 émojis & ünïcödé';

      const encrypted = service.encrypt({ plaintext });
      const decrypted = service.decrypt({ encrypted });

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('tamper detection', () => {
    it('should throw on tampered ciphertext', () => {
      const service = createService();
      const encrypted = service.encrypt({ plaintext: 'sensitive' });

      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:${parts[1]}:${'ff'.repeat(parts[2].length / 2)}`;

      expect(() => service.decrypt({ encrypted: tampered })).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const service = createService();
      const encrypted = service.encrypt({ plaintext: 'sensitive' });

      const parts = encrypted.split(':');
      const tampered = `${parts[0]}:${'00'.repeat(16)}:${parts[2]}`;

      expect(() => service.decrypt({ encrypted: tampered })).toThrow();
    });

    it('should throw on invalid format', () => {
      const service = createService();

      expect(() => service.decrypt({ encrypted: 'not-valid-format' })).toThrow(
        'Invalid encrypted data format',
      );
    });

    it('should throw when only two parts provided', () => {
      const service = createService();

      expect(() => service.decrypt({ encrypted: 'part1:part2' })).toThrow(
        'Invalid encrypted data format',
      );
    });
  });

  describe('key isolation', () => {
    it('should fail to decrypt with a different key', () => {
      const service1 = createService({ ENCRYPTION_KEY: 'a'.repeat(64) });
      const service2 = createService({ ENCRYPTION_KEY: 'b'.repeat(64) });

      const encrypted = service1.encrypt({ plaintext: 'cross-key-test' });

      expect(() => service2.decrypt({ encrypted })).toThrow();
    });
  });
});
