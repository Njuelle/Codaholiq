import { Controller, Get, Param, ParseIntPipe, Inject, UseGuards } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { DashboardService, type DashboardStats } from './dashboard.service';

@Controller('orgs/:orgId/dashboard')
@UseGuards(OrgGuard)
export class DashboardController {
  constructor(
    @Inject(DashboardService)
    private readonly dashboardService: DashboardService,
  ) {}

  @Get()
  async getStats(@Param('orgId', ParseIntPipe) orgId: number): Promise<DashboardStats> {
    return this.dashboardService.getStats({ orgId });
  }
}
