import { Global, Module, forwardRef } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PermissionsController } from './permissions.controller';
import { PermissionsRepository } from './permissions.repository';
import { PermissionsService } from './permissions.service';

@Global()
@Module({
  imports: [forwardRef(() => OrganizationsModule)],
  controllers: [PermissionsController],
  providers: [PermissionsRepository, PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
