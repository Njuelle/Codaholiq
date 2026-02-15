import { decodeJwtPayload, isTokenExpired } from '../jwt';

function createTestJwt({
  sub = 1,
  username = 'testuser',
  avatarUrl = null as string | null,
  exp = Math.floor(Date.now() / 1000) + 900,
} = {}): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({ sub, username, avatarUrl, iat: Math.floor(Date.now() / 1000), exp }),
  );
  const signature = 'test-signature';
  return `${header}.${payload}.${signature}`;
}

describe('decodeJwtPayload', () => {
  it('should decode a valid JWT payload', () => {
    const token = createTestJwt({ sub: 42, username: 'alice' });
    const payload = decodeJwtPayload(token);

    expect(payload.sub).toBe(42);
    expect(payload.username).toBe('alice');
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it('should throw on invalid JWT format', () => {
    expect(() => decodeJwtPayload('not-a-jwt')).toThrow('Invalid JWT format');
    expect(() => decodeJwtPayload('only.two')).toThrow('Invalid JWT format');
  });

  it('should throw when payload is missing required fields', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const payload = btoa(JSON.stringify({ foo: 'bar' }));
    const token = `${header}.${payload}.sig`;

    expect(() => decodeJwtPayload(token)).toThrow('Invalid JWT payload: missing required fields');
  });

  it('should throw when sub is not a number', () => {
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const payload = btoa(
      JSON.stringify({ sub: 'string', username: 'alice', avatarUrl: null, iat: 1, exp: 2 }),
    );
    const token = `${header}.${payload}.sig`;

    expect(() => decodeJwtPayload(token)).toThrow('Invalid JWT payload: missing required fields');
  });

  it('should handle base64url encoded payloads', () => {
    // Use base64url encoding (- and _ instead of + and /)
    const header = btoa(JSON.stringify({ alg: 'HS256' }));
    const payloadObj = {
      sub: 1,
      username: 'test+user/name',
      avatarUrl: null,
      iat: 1000,
      exp: 2000,
    };
    const payloadB64 = btoa(JSON.stringify(payloadObj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const token = `${header}.${payloadB64}.sig`;

    const result = decodeJwtPayload(token);
    expect(result.sub).toBe(1);
    expect(result.username).toBe('test+user/name');
  });
});

describe('isTokenExpired', () => {
  it('should return false for a non-expired token', () => {
    const token = createTestJwt({ exp: Math.floor(Date.now() / 1000) + 900 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('should return true for an expired token', () => {
    const token = createTestJwt({ exp: Math.floor(Date.now() / 1000) - 10 });
    expect(isTokenExpired(token)).toBe(true);
  });
});
