export interface User {
  readonly id: number;
  readonly username: string;
  readonly email: string | null;
  readonly avatarUrl: string | null;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

export interface JwtPayload {
  readonly sub: number;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly iat: number;
  readonly exp: number;
}

export type Role = 'owner' | 'admin' | 'member';
