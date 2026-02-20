import { Controller, Get } from '@nestjs/common';
import { WORKFLOW_TEMPLATE } from '../../common/constants/workflow-template';

@Controller()
export class WorkflowTemplateController {
  @Get('workflow-template')
  getWorkflowTemplate(): { template: string } {
    return { template: WORKFLOW_TEMPLATE };
  }
}
