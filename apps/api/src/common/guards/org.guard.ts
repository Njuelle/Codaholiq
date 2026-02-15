import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { OrganizationsRepository } from '../../modules/organizations/organizations.repository';

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    @Inject(OrganizationsRepository) private readonly orgRepository: OrganizationsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const orgId = Number(request.params.orgId);
    if (!orgId || isNaN(orgId)) {
      throw new ForbiddenException('Invalid organization ID');
    }

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const role = await this.orgRepository.getMemberRole({ orgId, userId: user.sub });
    if (!role) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    request.orgMember = { orgId, userId: user.sub, role };

    return true;
  }
}
