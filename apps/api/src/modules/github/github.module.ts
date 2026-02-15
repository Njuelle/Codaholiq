import { Module, forwardRef } from '@nestjs/common';
import { AutomationsModule } from '../automations/automations.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { GitHubEntityRepository } from './github-entity.repository';
import { GitHubApiService } from './github-api.service';
import { InstallationService } from './installation.service';
import { RepoSyncService } from './repo-sync.service';
import { RepositoriesService } from './repositories.service';
import { RepositoriesController } from './repositories.controller';

@Module({
  imports: [forwardRef(() => AutomationsModule), forwardRef(() => OrganizationsModule)],
  controllers: [RepositoriesController],
  providers: [
    GitHubEntityRepository,
    GitHubApiService,
    InstallationService,
    RepoSyncService,
    RepositoriesService,
  ],
  exports: [
    GitHubEntityRepository,
    GitHubApiService,
    InstallationService,
    RepoSyncService,
    RepositoriesService,
  ],
})
export class GitHubModule {}
