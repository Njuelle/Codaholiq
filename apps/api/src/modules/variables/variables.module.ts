import { Module, forwardRef } from '@nestjs/common';
import { GitHubModule } from '../github/github.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { VariablesController } from './variables.controller';
import { VariablesRepository } from './variables.repository';
import { VariablesService } from './variables.service';

@Module({
  imports: [forwardRef(() => GitHubModule), forwardRef(() => OrganizationsModule)],
  controllers: [VariablesController],
  providers: [VariablesRepository, VariablesService],
  exports: [VariablesService],
})
export class VariablesModule {}
