import type { JwtPayload } from '../modules/auth/dto/auth.dto';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      orgMember?: {
        orgId: number;
        userId: number;
        role: 'owner' | 'admin' | 'member';
        permissions?: readonly string[];
      };
      rawBody?: Buffer;
    }
  }
}
