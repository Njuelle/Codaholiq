import { Controller, Get, Inject } from '@nestjs/common';
import { WorkflowTemplateService } from '../../common/workflow-template/workflow-template.service';

@Controller()
export class WorkflowTemplateController {
  constructor(
    @Inject(WorkflowTemplateService)
    private readonly templateService: WorkflowTemplateService,
  ) {}

  @Get('workflow-template')
  async getWorkflowTemplate(): Promise<{ template: string }> {
    const template = await this.templateService.getTemplate();
    return { template };
  }
}
