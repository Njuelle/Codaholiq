import { Controller, Get, Param, ParseIntPipe, Query, Inject, UseGuards } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AnalyticsService, type AnalyticsData } from './analytics.service';
import { analyticsQuerySchema, type AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('orgs/:orgId/analytics')
@UseGuards(OrgGuard)
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('cost-over-time')
  async getCostOverTime(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query(new ZodValidationPipe(analyticsQuerySchema))
    query: AnalyticsQueryDto,
  ): Promise<AnalyticsData> {
    return this.analyticsService.getCostAnalytics({
      orgId,
      from: query.from,
      to: query.to,
      repoId: query.repoId,
    });
  }
}
