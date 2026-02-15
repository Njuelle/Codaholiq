import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REDIS } from '../../modules/redis/redis.constants';
import type { JwtPayload } from '../../modules/auth/dto/auth.dto';

export const TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly previousSecret: string | undefined;

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.previousSecret = this.configService.get<string>('JWT_SECRET_PREVIOUS');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    // Check if token has been blacklisted (logout)
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const isBlacklisted = await this.redis.get(`${TOKEN_BLACKLIST_PREFIX}${tokenHash}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Access token has been revoked');
    }

    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token);
      request.user = payload;
    } catch {
      // Try previous secret for rotation support
      if (this.previousSecret) {
        try {
          const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
            secret: this.previousSecret,
          });
          request.user = payload;
          return true;
        } catch {
          // Both secrets failed
        }
      }
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authorization = request.headers.authorization;
    if (!authorization) return undefined;

    const [type, token] = authorization.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
