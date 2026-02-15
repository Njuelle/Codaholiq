import type { JwtPayload } from '@/modules/auth/types';

function base64UrlDecode(str: string): string {
  // Replace base64url chars with standard base64
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.sub === 'number' &&
    typeof obj.username === 'string' &&
    (typeof obj.avatarUrl === 'string' || obj.avatarUrl === null) &&
    typeof obj.iat === 'number' &&
    typeof obj.exp === 'number'
  );
}

export function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) {
    throw new Error('Invalid JWT format');
  }
  const payload: unknown = JSON.parse(base64UrlDecode(parts[1]));
  if (!isJwtPayload(payload)) {
    throw new Error('Invalid JWT payload: missing required fields');
  }
  return payload;
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  return payload.exp * 1000 < Date.now();
}
