import { Global, Module } from '@nestjs/common';
import { WorkflowTemplateService } from './workflow-template.service';

@Global()
@Module({
  providers: [WorkflowTemplateService],
  exports: [WorkflowTemplateService],
})
export class WorkflowTemplateModule {}
