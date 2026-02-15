import { Global, Module } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { SecretMaskingService } from '../../common/crypto/secret-masking.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Global()
@Module({
  imports: [OrganizationsModule],
  controllers: [AuditController],
  providers: [AuditRepository, AuditService, SecretMaskingService],
  exports: [AuditService, AuditRepository],
})
export class AuditModule {}
