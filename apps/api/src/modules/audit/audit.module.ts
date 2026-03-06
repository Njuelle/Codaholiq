import { Global, Module } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { OrganizationsModule } from '../organizations/organizations.module';

@Global()
@Module({
  imports: [OrganizationsModule],
  controllers: [AuditController],
  providers: [AuditRepository, AuditService],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
