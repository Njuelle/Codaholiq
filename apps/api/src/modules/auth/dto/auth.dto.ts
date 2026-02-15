import { z } from 'zod';

export enum Role {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

export interface JwtPayload {
  readonly sub: number;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly iat: number;
  readonly exp: number;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export const ExchangeCodeSchema = z.object({
  code: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid authorization code format'),
});

export type ExchangeCodeDto = z.infer<typeof ExchangeCodeSchema>;
