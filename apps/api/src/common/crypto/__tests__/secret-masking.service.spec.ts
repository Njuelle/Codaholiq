import { SecretMaskingService } from '../secret-masking.service';

describe('SecretMaskingService', () => {
  let service: SecretMaskingService;

  beforeEach(() => {
    service = new SecretMaskingService();
  });

  describe('mask', () => {
    it('should mask JWT tokens', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = service.mask({ text: `Bearer ${jwt}` });

      expect(result).not.toContain('eyJ');
      expect(result).toContain('[REDACTED]');
    });

    it('should mask Bearer tokens', () => {
      const result = service.mask({ text: 'Authorization: Bearer my-secret-token' });

      expect(result).not.toContain('my-secret-token');
      expect(result).toContain('Bearer [REDACTED]');
    });

    it('should mask 64-char hex strings', () => {
      const hexKey = 'a'.repeat(64);
      const result = service.mask({ text: `SECRET_KEY=${hexKey}` });

      expect(result).not.toContain(hexKey);
      expect(result).toContain('[REDACTED]');
    });

    it('should mask passwords in URLs', () => {
      const result = service.mask({
        text: 'postgresql://user:secret_pass@localhost:5432/db',
      });

      expect(result).not.toContain('secret_pass');
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('user');
    });

    it('should mask GitHub token patterns', () => {
      const result = service.mask({ text: 'token=ghp_ABCDEFghijklmnopqrst' });

      expect(result).not.toContain('ghp_');
      expect(result).toContain('[REDACTED]');
    });

    it('should not mask normal text', () => {
      const result = service.mask({ text: 'Hello World' });

      expect(result).toBe('Hello World');
    });
  });

  describe('maskObject', () => {
    it('should mask sensitive keys', () => {
      const result = service.maskObject({
        obj: {
          username: 'user1',
          password: 'secret123',
          token: 'abc-token',
        },
      });

      expect(result.username).toBe('user1');
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
    });

    it('should mask case-variant keys', () => {
      const result = service.maskObject({
        obj: {
          Password: 'secret123',
          API_KEY: 'my-api-key',
          ClientSecret: 'my-client-secret',
        },
      });

      expect(result.Password).toBe('[REDACTED]');
      expect(result.API_KEY).toBe('[REDACTED]');
      expect(result.ClientSecret).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const result = service.maskObject({
        obj: {
          user: {
            name: 'test',
            refreshToken: 'some-refresh-token',
          },
        },
      });

      const user = result.user as Record<string, unknown>;
      expect(user.name).toBe('test');
      expect(user.refreshToken).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const result = service.maskObject({
        obj: {
          items: ['normal', 'text'],
          secrets: [{ token: 'abc' }],
        },
      });

      expect(result.items).toEqual(['normal', 'text']);
      const secrets = result.secrets as Record<string, unknown>[];
      expect(secrets[0]?.token).toBe('[REDACTED]');
    });

    it('should mask JWT tokens in string values', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = service.maskObject({
        obj: { header: `Bearer ${jwt}` },
      });

      expect(result.header).not.toContain('eyJ');
    });

    it('should handle null and undefined values', () => {
      const result = service.maskObject({
        obj: { name: null, description: undefined, count: 42 },
      });

      expect(result.name).toBeNull();
      expect(result.description).toBeUndefined();
      expect(result.count).toBe(42);
    });

    it('should mask deeply nested objects (3+ levels)', () => {
      const result = service.maskObject({
        obj: {
          level1: {
            level2: {
              level3: {
                password: 'deep-secret',
                name: 'visible',
              },
            },
          },
        },
      });

      const level1 = result.level1 as Record<string, unknown>;
      const level2 = level1.level2 as Record<string, unknown>;
      const level3 = level2.level3 as Record<string, unknown>;
      expect(level3.password).toBe('[REDACTED]');
      expect(level3.name).toBe('visible');
    });
  });
});
