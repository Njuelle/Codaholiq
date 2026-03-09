import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ExecutionsModule } from '../executions/executions.module';
import { AutomationsModule } from '../automations/automations.module';
import { GitHubModule } from '../github/github.module';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    ExecutionsModule,
    forwardRef(() => AutomationsModule),
    forwardRef(() => GitHubModule),
  ],
  controllers: [OrganizationsController, DashboardController, AnalyticsController],
  providers: [OrganizationsRepository, OrganizationsService, DashboardService, AnalyticsService],
  exports: [OrganizationsRepository, OrganizationsService],
})
export class OrganizationsModule {}
