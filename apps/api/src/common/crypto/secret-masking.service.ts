import { Injectable } from '@nestjs/common';

const SENSITIVE_KEYS_LOWER = new Set([
  'password',
  'token',
  'secret',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'api_token',
  'privatekey',
  'private_key',
  'clientsecret',
  'client_secret',
  'webhooksecret',
  'webhook_secret',
  'value',
  'jwt_secret',
  'jwt_refresh_secret',
  'github_app_private_key',
  'github_webhook_secret',
  'github_client_secret',
  'bearer',
  'oauth_token',
  'access_key',
  'secret_key',
  'credentials',
  'signing_key',
  'encryption_key',
  'database_url',
  'redis_url',
  'connection_string',
]);

const JWT_PATTERN = /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
const BEARER_PATTERN = /Bearer\s+\S+/gi;
const HEX_KEY_PATTERN = /\b[0-9a-fA-F]{64}\b/g;
const PASSWORD_IN_URL_PATTERN = /:\/\/([^:]+):([^@]+)@/g;
const GITHUB_TOKEN_PATTERN = /\b(ghp_|ghs_|ghu_|gho_|github_pat_)[a-zA-Z0-9_]+\b/g;
const SK_LIVE_PATTERN = /\bsk_live_[a-zA-Z0-9]+\b/g;

const MASK = '[REDACTED]';

@Injectable()
export class SecretMaskingService {
  mask({ text }: { text: string }): string {
    let result = text;
    result = result.replace(JWT_PATTERN, MASK);
    result = result.replace(BEARER_PATTERN, `Bearer ${MASK}`);
    result = result.replace(HEX_KEY_PATTERN, MASK);
    result = result.replace(PASSWORD_IN_URL_PATTERN, `://$1:${MASK}@`);
    result = result.replace(GITHUB_TOKEN_PATTERN, MASK);
    result = result.replace(SK_LIVE_PATTERN, MASK);
    return result;
  }

  maskObject({ obj }: { obj: Record<string, unknown> }): Record<string, unknown> {
    return this.deepMask(obj) as Record<string, unknown>;
  }

  private deepMask(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.mask({ text: value });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.deepMask(item));
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEYS_LOWER.has(key.toLowerCase())) {
          result[key] = MASK;
        } else {
          result[key] = this.deepMask(val);
        }
      }
      return result;
    }

    return value;
  }
}
