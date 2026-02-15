import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request;
    const user = request.user;
    if (user?.sub) {
      return Promise.resolve(`user:${String(user.sub)}`);
    }
    return Promise.resolve(`ip:${request.ip ?? 'unknown'}`);
  }
}
