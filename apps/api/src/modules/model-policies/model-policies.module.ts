import { Module, forwardRef } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ModelPoliciesController } from './model-policies.controller';
import { ModelPoliciesRepository } from './model-policies.repository';
import { ModelPoliciesService } from './model-policies.service';

@Module({
  imports: [forwardRef(() => OrganizationsModule)],
  controllers: [ModelPoliciesController],
  providers: [ModelPoliciesRepository, ModelPoliciesService],
  exports: [ModelPoliciesService],
})
export class ModelPoliciesModule {}
