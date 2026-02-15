import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';

export const CurrentOrgMember = createParamDecorator(
  (
    _data: unknown,
    ctx: ExecutionContext,
  ): { orgId: number; userId: number; role: 'owner' | 'admin' | 'member' } => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.orgMember) {
      throw new InternalServerErrorException(
        'OrgGuard must be applied before using @CurrentOrgMember',
      );
    }
    return request.orgMember;
  },
);
